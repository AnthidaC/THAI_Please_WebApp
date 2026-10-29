import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { BadgeConditionRegistry } from '../services/achievements/conditionRegistry';
import { registerAchievementHandlers } from '../services/achievements/handlers';
import {
  createReferralCountHandler,
  ReferralProgressClient,
} from '../services/achievements/handlers/referralCount';
import { createReviewCountHandler, ReviewProgressClient } from '../services/achievements/handlers/reviewCount';
import {
  createTotalSpendingHandler,
  SpendingProgressClient,
} from '../services/achievements/handlers/totalSpending';
import {
  createTransactionCountHandler,
  TransactionProgressClient,
} from '../services/achievements/handlers/transactionCount';
import {
  awardAfterActivity,
  evaluateCondition,
  getNextTier,
  planAwards,
  sortTiers,
  TierView,
} from '../services/achievements/badgeAwardEngine';

const tiers: TierView[] = [
  { tierId: 'gold', tierName: 'Gold', tierLevel: 3, requiredCount: 100 },
  { tierId: 'bronze', tierName: 'Bronze', tierLevel: 1, requiredCount: 10 },
  { tierId: 'silver', tierName: 'Silver', tierLevel: 2, requiredCount: 50 },
];

type CountArgs = { where: Record<string, any> };

const captureCount = (result: number) => {
  const calls: CountArgs[] = [];
  const client = {
    transactions: { count: async (args: CountArgs) => { calls.push(args); return result; } },
    referrals: { count: async (args: CountArgs) => { calls.push(args); return result; } },
    reviews: { count: async (args: CountArgs) => { calls.push(args); return result; } },
  };
  return { calls, client };
};

const spendingFake = (sum: Prisma.Decimal | null) => {
  const calls: CountArgs[] = [];
  const client = {
    transactions: {
      aggregate: async (args: CountArgs) => { calls.push(args); return { _sum: { citizen_paid_amount: sum } }; },
    },
  };
  return { calls, client };
};

const testHandlers = async () => {
  const transactionFake = captureCount(7);
  const transactionHandler = createTransactionCountHandler(
    transactionFake.client as unknown as TransactionProgressClient
  );
  assert.equal(await transactionHandler.getProgress('user-1'), 7);
  assert.deepEqual(transactionFake.calls[0].where, {
    user_id: 'user-1',
    status: { in: ['SUCCESS', 'FLAGGED'] },
  }, 'only settled, paid transactions count');

  const referralFake = captureCount(3);
  const referralHandler = createReferralCountHandler(
    referralFake.client as unknown as ReferralProgressClient
  );
  assert.equal(await referralHandler.getProgress('user-2'), 3);
  assert.deepEqual(referralFake.calls[0].where, {
    referrer_user_id: 'user-2',
    status: 'redeemed',
    converted_at: { not: null },
  }, 'only converted referrals count for the referrer');

  const reviewFake = captureCount(2);
  const reviewHandler = createReviewCountHandler(
    reviewFake.client as unknown as ReviewProgressClient
  );
  assert.equal(await reviewHandler.getProgress('user-3'), 2);
  assert.deepEqual(reviewFake.calls[0].where, {
    user_id: 'user-3',
    is_verified_purchase: true,
    transactions: { status: { in: ['SUCCESS', 'FLAGGED'] } },
  }, 'only verified reviews on settled transactions count');

  const spendingSum = spendingFake(new Prisma.Decimal('1234.55'));
  const spendingHandler = createTotalSpendingHandler(
    spendingSum.client as unknown as SpendingProgressClient
  );
  assert.equal(await spendingHandler.getProgress('user-4'), 1234.55);
  assert.deepEqual(spendingSum.calls[0].where, {
    user_id: 'user-4',
    status: { in: ['SUCCESS', 'FLAGGED'] },
  });
  assert.deepEqual(Object.keys(spendingSum.calls[0]), ['where', '_sum']);

  const emptySpending = spendingFake(null);
  const emptySpendingHandler = createTotalSpendingHandler(
    emptySpending.client as unknown as SpendingProgressClient
  );
  assert.equal(await emptySpendingHandler.getProgress('user-5'), 0, 'a user with no activity has zero progress');

  // Decimal summation avoids float drift: 0.1 + 0.2 is exactly 0.30 here.
  const driftSum = spendingFake(new Prisma.Decimal('0.1').plus(new Prisma.Decimal('0.2')));
  const driftHandler = createTotalSpendingHandler(
    driftSum.client as unknown as SpendingProgressClient
  );
  assert.equal(await driftHandler.getProgress('user-6'), 0.3);
};

const testTierPlanning = () => {
  assert.deepEqual(sortTiers(tiers).map((tier) => tier.tierLevel), [1, 2, 3]);

  assert.deepEqual(planAwards({
    tiers, progress: 0, unlockedTierIds: new Set(), currentTierLevel: 0,
  }), { tiersToRecord: [], promoteTo: null }, 'no eligible tier below the first threshold');

  assert.equal(planAwards({
    tiers, progress: 10, unlockedTierIds: new Set(), currentTierLevel: 0,
  }).promoteTo?.tierId, 'bronze', 'first tier unlocks at its threshold');

  const multiple = planAwards({
    tiers, progress: 120, unlockedTierIds: new Set(), currentTierLevel: 0,
  });
  assert.deepEqual(multiple.tiersToRecord.map((tier) => tier.tierName), ['Bronze', 'Silver', 'Gold']);
  assert.equal(multiple.promoteTo?.tierName, 'Gold', 'crossing several thresholds promotes to the highest');

  const alreadyEarned = planAwards({
    tiers,
    progress: 75,
    unlockedTierIds: new Set(['bronze', 'silver']),
    currentTierLevel: 2,
  });
  assert.deepEqual(alreadyEarned, { tiersToRecord: [], promoteTo: null }, 'repeated evaluation grants nothing twice');

  const partialHistory = planAwards({
    tiers,
    progress: 60,
    unlockedTierIds: new Set(['silver']),
    currentTierLevel: 2,
  });
  assert.deepEqual(partialHistory.tiersToRecord.map((tier) => tier.tierName), ['Bronze'], 'missing lower tiers are backfilled');

  const noDowngrade = planAwards({
    tiers, progress: 5, unlockedTierIds: new Set(['bronze', 'silver']), currentTierLevel: 2,
  });
  assert.deepEqual(noDowngrade, { tiersToRecord: [], promoteTo: null }, 'the stored tier never drops');

  assert.equal(getNextTier(tiers, 1)?.tierName, 'Silver');
  assert.equal(getNextTier(tiers, 3), null, 'the last tier has no next tier');
  assert.equal(getNextTier(tiers, 0)?.tierName, 'Bronze');
};

const testRegistryAndEngine = async () => {
  const registry = new BadgeConditionRegistry();
  assert.equal(registry.has('transaction_count'), false);
  registerAchievementHandlers(registry);
  assert.deepEqual(
    registry.listConditionTypes(),
    ['referral_count', 'review_count', 'total_spending', 'transaction_count'],
    'Admin condition discovery reads the same registry'
  );
  assert.throws(
    () => registerAchievementHandlers(registry),
    /already registered/i,
    'double registration is rejected instead of silently overwriting a handler'
  );

  const unknown = await evaluateCondition('00000000-0000-0000-0000-000000000000', 'not_registered');
  assert.deepEqual(unknown, {
    conditionType: 'not_registered',
    status: 'unregistered',
    progress: null,
    awarded: [],
  }, 'unknown conditions fail closed without touching the database');

  const results = await awardAfterActivity(
    '00000000-0000-0000-0000-000000000000',
    ['not_registered'],
    'unit test'
  );
  assert.equal(results[0].status, 'unregistered', 'the business-flow hook never throws for an unknown condition');
};

const main = async () => {
  await testHandlers();
  testTierPlanning();
  await testRegistryAndEngine();
  console.log('Badge award engine unit checks passed');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
