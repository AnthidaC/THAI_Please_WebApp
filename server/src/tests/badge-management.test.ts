import assert from 'node:assert/strict';
import { badgeCreateSchema, badgeUpdateSchema } from '../validations/badge-management.validation';
import {
  assertEarnedTiersUnchanged,
  getBadgeActivationBlocker,
} from '../services/badge-management.rules';
import { toBadgeCreateData } from '../services/adminBadge.service';
import { BadgeConditionRegistry } from '../services/achievements/conditionRegistry';

const validBadge = {
  badgeName: 'Referral Master',
  description: 'Successfully refer other users',
  conditionType: 'referral_count',
  tiers: [
    { tierName: 'Bronze', tierLevel: 1, requiredCount: 5 },
    { tierName: 'Silver', tierLevel: 2, requiredCount: 20 },
    { tierName: 'Gold', tierLevel: 3, requiredCount: 50 },
  ],
};

assert.equal(badgeCreateSchema.safeParse(validBadge).success, true);
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  status: 'active',
}).success, false, 'creation cannot override the inactive default');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  implementationStatus: 'ready',
}).success, false, 'creation cannot override the pending default');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [validBadge.tiers[0], { ...validBadge.tiers[1], tierLevel: 1 }],
}).success, false, 'duplicate tier levels must be rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [validBadge.tiers[0], { ...validBadge.tiers[1], requiredCount: 5 }],
}).success, false, 'duplicate thresholds must be rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [{ ...validBadge.tiers[0], requiredCount: 0 }],
}).success, false, 'non-positive thresholds must be rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [validBadge.tiers[0], { ...validBadge.tiers[1], requiredCount: 4 }],
}).success, false, 'thresholds must increase by tier level');
assert.equal(badgeUpdateSchema.safeParse({ conditionType: 'new_type' }).success, false, 'condition type must be immutable');
assert.equal(badgeUpdateSchema.safeParse({ badgeName: 'Updated Badge Name' }).success, true, 'metadata updates do not require tier data');
assert.equal(badgeUpdateSchema.safeParse({}).success, false, 'empty updates must be rejected');
const createData = toBadgeCreateData(validBadge);
assert.equal(createData.badge_tiers.create.length, 3, 'Badge and tiers are submitted as one nested Prisma create');
assert.equal('status' in createData, false, 'client cannot set activation status during creation');
assert.equal('implementation_status' in createData, false, 'client cannot set implementation status during creation');

assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'ready',
  conditionType: 'referral_count',
  tierCount: 3,
  handlerRegistered: false,
}), 'No backend handler is registered for this condition type');
assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'pending',
  conditionType: 'referral_count',
  tierCount: 3,
  handlerRegistered: true,
}), 'Implementation status must be ready before activation');
assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'ready',
  conditionType: 'referral_count',
  tierCount: 0,
  handlerRegistered: true,
}), 'At least one valid tier is required before activation');
assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'ready',
  conditionType: 'referral_count',
  tierCount: 3,
  handlerRegistered: true,
}), null);

assert.doesNotThrow(() => assertEarnedTiersUnchanged(
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }],
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }]
));
assert.throws(() => assertEarnedTiersUnchanged(
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }],
  []
), /earned achievement/i);
assert.throws(() => assertEarnedTiersUnchanged(
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }],
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 6, iconUrl: null }]
), /earned achievement/i);

async function testRegistry() {
  const registry = new BadgeConditionRegistry();
  assert.deepEqual(registry.listConditionTypes(), []);
  assert.equal(registry.has('review_count'), false);
  registry.register({ conditionType: 'review_count', getProgress: async () => 4 });
  assert.equal(registry.has('review_count'), true);
  assert.deepEqual(registry.listConditionTypes(), ['review_count']);
  assert.equal(await registry.getProgress('review_count', 'user-1'), 4);
  await assert.rejects(() => registry.getProgress('unregistered', 'user-1'), /not registered/i);
  registry.register({ conditionType: 'spend_total', getProgress: async () => Number.NaN });
  await assert.rejects(() => registry.getProgress('spend_total', 'user-1'), /invalid progress/i);
}

void testRegistry().then(() => console.log('Badge management unit checks passed'));
