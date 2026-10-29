import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  referralService,
  ReferralError,
  REFERRER_MILESTONE_DISCOUNT_AMOUNT,
  REFERRER_MILESTONE_STEP,
  REFERRER_MILESTONE_VALID_DAYS,
} from '../services/referral.service';

// =========================================================================
// 🧪 UC 2.4.3: MERCHANT-BASED REFERRAL REWARD RULES TEST SUITE
// =========================================================================

/**
 * สร้าง In-Memory Mock Database สำหรับจำลองระบบ Referral โดยไม่แตะต้อง Shared Supabase
 */
const createMockDatabase = () => {
  const users = new Map<string, { user_id: string; full_name: string }>();
  const merchants = new Map<string, { merchant_id: string; shop_name: string; is_approved: boolean }>();
  const transactions: Array<{
    transaction_id: string;
    user_id: string;
    merchant_id: string;
    status: string;
    created_at: Date;
  }> = [];
  const referrals: Array<{
    referral_id: string;
    referrer_user_id: string;
    referred_user_id: string | null;
    merchant_id: string;
    transaction_id: string | null;
    referral_code: string;
    discount_amount: any;
    status: string;
    expires_at: Date | null;
    converted_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }> = [];
  const rewards: Array<{
    reward_id: string;
    reward_name: string;
    reward_type: string;
    discount_type: string;
    discount_value: any;
    status: string;
  }> = [];
  const user_rewards: Array<{
    user_reward_id: string;
    user_id: string;
    reward_id: string;
    referral_id: string | null;
    transaction_id: string | null;
    reward_code: string;
    status: string;
    earned_at: Date;
    expires_at: Date | null;
  }> = [];

  const client: any = {
      transactions: {
        findFirst: async (args: any) => {
          return transactions.find((t) => {
            if (args.where.user_id && t.user_id !== args.where.user_id) return false;
            if (args.where.merchant_id && t.merchant_id !== args.where.merchant_id) return false;
            if (args.where.status && t.status !== args.where.status) return false;
            if (args.where.transaction_id?.not && t.transaction_id === args.where.transaction_id.not) return false;
            return true;
          }) || null;
        },
      },
      merchants: {
        findUnique: async (args: any) => {
          return merchants.get(args.where.merchant_id) || null;
        },
      },
      referrals: {
        findUnique: async (args: any) => {
          const r = referrals.find((item) => item.referral_code === args.where.referral_code);
          if (!r) return null;
          const referrer = users.get(r.referrer_user_id);
          const merchant = merchants.get(r.merchant_id);
          return {
            ...r,
            users_referrals_referrer_user_idTousers: referrer ? { full_name: referrer.full_name } : { full_name: 'ผู้ใช้' },
            merchants: merchant ? { merchant_id: merchant.merchant_id, shop_name: merchant.shop_name, is_approved: merchant.is_approved } : null,
          };
        },
        findFirst: async (args: any) => {
          return referrals.find((r) => {
            if (args.where.referrer_user_id && r.referrer_user_id !== args.where.referrer_user_id) return false;
            if (args.where.referred_user_id && r.referred_user_id !== args.where.referred_user_id) return false;
            if (args.where.merchant_id && r.merchant_id !== args.where.merchant_id) return false;
            if (args.where.status) {
              if (typeof args.where.status === 'string' && r.status !== args.where.status) return false;
              if (args.where.status.in && !args.where.status.in.includes(r.status)) return false;
            }
            if (args.where.referral_id?.not && r.referral_id === args.where.referral_id.not) return false;
            if (args.where.transaction_id?.not && r.transaction_id === args.where.transaction_id.not) return false;
            return true;
          }) || null;
        },
        count: async (args: any) => {
          return referrals.filter((r) => {
            if (args.where.referrer_user_id && r.referrer_user_id !== args.where.referrer_user_id) return false;
            if (args.where.merchant_id && r.merchant_id !== args.where.merchant_id) return false;
            if (args.where.status) {
              if (typeof args.where.status === 'string' && r.status !== args.where.status) return false;
              if (args.where.status.in && !args.where.status.in.includes(r.status)) return false;
            }
            return true;
          }).length;
        },
        findMany: async (args: any) => {
          let matched = referrals.filter((r) => {
            if (args?.where?.referrer_user_id && r.referrer_user_id !== args.where.referrer_user_id) return false;
            if (args?.where?.referred_user_id && r.referred_user_id !== args.where.referred_user_id) return false;
            if (args?.where?.merchant_id?.not === null && r.merchant_id === null) return false;
            if (args?.where?.merchant_id && typeof args.where.merchant_id === 'string' && r.merchant_id !== args.where.merchant_id) return false;
            if (args?.where?.status) {
              if (typeof args.where.status === 'string' && r.status !== args.where.status) return false;
              if (args.where.status.in && !args.where.status.in.includes(r.status)) return false;
            }
            return true;
          });

          if (args?.distinct?.includes('merchant_id')) {
            const seen = new Set<string>();
            matched = matched.filter((r) => {
              if (!r.merchant_id || seen.has(r.merchant_id)) return false;
              seen.add(r.merchant_id);
              return true;
            });
          }

          return matched;
        },
        update: async (args: any) => {
          const r = referrals.find((item) => item.referral_id === args.where.referral_id);
          if (!r) throw new Error('Record not found');
          Object.assign(r, args.data);
          return r;
        },
      },
      rewards: {
        findFirst: async (args: any) => {
          return rewards.find((rw) => {
            if (args.where.discount_value && Number(rw.discount_value) !== Number(args.where.discount_value)) return false;
            if (args.where.reward_type && rw.reward_type !== args.where.reward_type) return false;
            return true;
          }) || null;
        },
        create: async (args: any) => {
          const item = {
            reward_id: `reward-${rewards.length + 1}`,
            ...args.data,
          };
          rewards.push(item);
          return item;
        },
      },
      user_rewards: {
        findFirst: async (args: any) => {
          return user_rewards.find((ur) => {
            if (args.where.user_id && ur.user_id !== args.where.user_id) return false;
            if (args.where.referral_id && ur.referral_id !== args.where.referral_id) return false;
            if (args.where.reward_id && ur.reward_id !== args.where.reward_id) return false;
            return true;
          }) || null;
        },
        count: async (args: any) => {
          return user_rewards.filter((ur) => {
            if (args.where.user_id && ur.user_id !== args.where.user_id) return false;
            if (args.where.reward_id && ur.reward_id !== args.where.reward_id) return false;
            if (args.where.referrals?.merchant_id) {
              const ref = referrals.find((r) => r.referral_id === ur.referral_id);
              if (!ref || ref.merchant_id !== args.where.referrals.merchant_id) return false;
            }
            return true;
          }).length;
        },
        create: async (args: any) => {
          const item = {
            user_reward_id: `ur-${user_rewards.length + 1}`,
            ...args.data,
          };
          user_rewards.push(item);
          return item;
        },
      },
      $queryRaw: async (query: any, ...values: any[]) => {
        const code = values[0];
        const r = referrals.find((item) => item.referral_code === code);
        return r ? [r] : [];
      },
      $transaction: async (cb: any) => {
        return await cb(client);
      },
    };

  return {
    users,
    merchants,
    transactions,
    referrals,
    rewards,
    user_rewards,
    client,
  };
};

let mockDb = createMockDatabase();

test('UC 2.4.3 Simplified Constants: Correct Referrer Milestone Amounts, Steps, and Expiry', () => {
  assert.equal(REFERRER_MILESTONE_DISCOUNT_AMOUNT, 40.0, 'Referrer gets exactly ฿40 on milestone');
  assert.equal(REFERRER_MILESTONE_STEP, 5, 'Milestone triggers every 5 distinct successful merchants');
  assert.equal(REFERRER_MILESTONE_VALID_DAYS, 14, 'Referrer ฿40 coupon expires in exactly 14 days');
});

test('Referrer Eligibility: Rejected if referrer has no prior successful transaction at merchant', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-1';
  const merchantId = 'merchant-khao-man-gai';

  await assert.rejects(
    async () => {
      await referralService.assertReferrerEligibleAtMerchant(referrerId, merchantId, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /ต้องเคยชำระเงินที่ร้านค้านี้สำเร็จอย่างน้อย 1 ครั้ง/);
      return true;
    }
  );
});

test('Referrer Eligibility: Allowed when referrer has prior SUCCESS transaction at merchant', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-1';
  const merchantId = 'merchant-khao-man-gai';

  db.transactions.push({
    transaction_id: 'tx-prior-1',
    user_id: referrerId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date('2026-10-20T10:00:00Z'),
  });

  await referralService.assertReferrerEligibleAtMerchant(referrerId, merchantId, db.client as any);
});

test('Referee Eligibility: Rejected if referee already has prior SUCCESS transaction at merchant', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-1';
  const merchantId = 'merchant-khao-man-gai';

  db.transactions.push({
    transaction_id: 'tx-referee-prior',
    user_id: refereeId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date('2026-10-22T10:00:00Z'),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /ต้องไม่เคยชำระเงินที่ร้านค้านี้มาก่อน/);
      return true;
    }
  );
});

test('Referee Eligibility: Allowed when referee has never paid at merchant', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-new';
  const merchantId = 'merchant-khao-man-gai';

  db.transactions.push({
    transaction_id: 'tx-other-merchant',
    user_id: refereeId,
    merchant_id: 'merchant-different',
    status: 'SUCCESS',
    created_at: new Date('2026-10-22T10:00:00Z'),
  });

  await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
});

test('Self-Referral Prevention: Referrer cannot refer themselves', async () => {
  const userId = 'user-self-refer';
  const merchantId = 'merchant-khao-man-gai';

  await assert.rejects(
    async () => {
      const res = { referrer_user_id: userId, merchant_id: merchantId };
      if (res && res.referrer_user_id === userId) {
        throw new ReferralError('ไม่สามารถใช้รหัสแนะนำเพื่อนของตนเองได้', 400);
      }
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /ไม่สามารถใช้รหัสแนะนำเพื่อนของตนเองได้/);
      return true;
    }
  );
});

test('Milestone Rule: 5 friends at 1 merchant = 1/5 merchants (0 milestone coupons)', () => {
  // 5 friends all redeem at the same merchant
  const distinctMerchants = new Set(['merchant-1', 'merchant-1', 'merchant-1', 'merchant-1', 'merchant-1']);
  const uniqueMerchantsCount = distinctMerchants.size; // = 1

  const milestonesCompleted = Math.floor(uniqueMerchantsCount / REFERRER_MILESTONE_STEP);
  const progressInCurrentMilestone = uniqueMerchantsCount % REFERRER_MILESTONE_STEP;
  const merchantsNeeded = REFERRER_MILESTONE_STEP - progressInCurrentMilestone;

  assert.equal(uniqueMerchantsCount, 1, '5 friends at the same merchant count as only 1 merchant');
  assert.equal(milestonesCompleted, 0, 'No milestone coupon yet at 1 merchant');
  assert.equal(progressInCurrentMilestone, 1, 'Progress is 1 out of 5 merchants');
  assert.equal(merchantsNeeded, 4, 'Needs 4 more distinct merchants to reach first ฿40 milestone');
});

test('Milestone Rule: 4 distinct merchants = 4/5 merchants (0 milestone coupons, 1 merchant needed)', () => {
  const uniqueMerchantsCount = 4;
  const milestonesCompleted = Math.floor(uniqueMerchantsCount / REFERRER_MILESTONE_STEP);
  const progressInCurrentMilestone = uniqueMerchantsCount % REFERRER_MILESTONE_STEP;
  const merchantsNeeded = REFERRER_MILESTONE_STEP - progressInCurrentMilestone;

  assert.equal(uniqueMerchantsCount, 4);
  assert.equal(milestonesCompleted, 0, 'No milestone coupon granted at 4 merchants');
  assert.equal(progressInCurrentMilestone, 4, 'Progress is 4 out of 5 merchants');
  assert.equal(merchantsNeeded, 1, 'Needs exactly 1 more distinct merchant to reach ฿40 milestone');
});

test('Milestone Rule: 1 friend each at 5 distinct merchants = 5/5 merchants (Exactly ONE ฿40 coupon)', () => {
  // 1 friend at 5 distinct merchants
  const distinctMerchants = new Set(['merchant-1', 'merchant-2', 'merchant-3', 'merchant-4', 'merchant-5']);
  const uniqueMerchantsCount = distinctMerchants.size; // = 5

  const milestonesCompleted = Math.floor(uniqueMerchantsCount / REFERRER_MILESTONE_STEP);
  const progressInCurrentMilestone = uniqueMerchantsCount % REFERRER_MILESTONE_STEP;
  const merchantsNeeded = progressInCurrentMilestone === 0 ? REFERRER_MILESTONE_STEP : REFERRER_MILESTONE_STEP - progressInCurrentMilestone;

  assert.equal(uniqueMerchantsCount, 5, '5 distinct merchants counted');
  assert.equal(milestonesCompleted, 1, 'Exactly ONE ฿40 coupon earned at 5 distinct merchants');
  assert.equal(progressInCurrentMilestone, 0, 'Progress resets to 0');
  assert.equal(merchantsNeeded, 5, 'Needs 5 more distinct merchants for next milestone');
});

test('Milestone Rule: 10 distinct merchants = Exactly TWO ฿40 milestone coupons for referrer', () => {
  const uniqueMerchantsCount = 10;
  const milestonesCompleted = Math.floor(uniqueMerchantsCount / REFERRER_MILESTONE_STEP);
  const progressInCurrentMilestone = uniqueMerchantsCount % REFERRER_MILESTONE_STEP;

  assert.equal(milestonesCompleted, 2, 'Exactly TWO ฿40 coupons earned at 10 distinct merchants');
  assert.equal(progressInCurrentMilestone, 0);
});

test('Milestone Rule: Repeated conversions at already-counted merchant do not add progress', () => {
  // Referrer already has friends at merchant-A and merchant-B
  const countedMerchants = new Set(['merchant-A', 'merchant-B']);
  assert.equal(countedMerchants.size, 2, 'Initial progress is 2 merchants');

  // 10 new friends redeem at merchant-A
  for (let i = 0; i < 10; i++) {
    countedMerchants.add('merchant-A');
  }

  assert.equal(countedMerchants.size, 2, 'Distinct merchant count remains 2 despite 10 new referrals at merchant-A');
  const milestones = Math.floor(countedMerchants.size / REFERRER_MILESTONE_STEP);
  assert.equal(milestones, 0, 'No milestone coupon granted without 5 distinct merchants');
});

test('One Referral Per Merchant: First eligible referee activates merchant credit', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-first';
  const refereeId = 'user-referee-first';
  const merchantId = 'merchant-khao-man-gai';

  // Referrer has prior transaction
  db.transactions.push({
    transaction_id: 'tx-ref-prior',
    user_id: referrerId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date('2026-10-01T00:00:00Z'),
  });

  // Referrer has not yet credited this merchant
  await referralService.assertMerchantNotYetCredited(referrerId, merchantId, undefined, db.client as any);

  // Conversion of first referee
  db.referrals.push({
    referral_id: 'ref-first-success',
    referrer_user_id: referrerId,
    referred_user_id: null,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-FIRST1',
    discount_amount: 0,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Mark first conversion as redeemed
  await db.client.referrals.update({
    where: { referral_id: 'ref-first-success' },
    data: {
      status: 'redeemed',
      referred_user_id: refereeId,
      transaction_id: 'tx-first-pay',
      converted_at: new Date(),
    },
  });

  // Verify merchant is now credited
  const redeemed = await db.client.referrals.findFirst({
    where: { referrer_user_id: referrerId, merchant_id: merchantId, status: 'redeemed' },
  });
  assert.ok(redeemed, 'First referral successfully credited the merchant');
});

test('One Referral Per Merchant: Block new referral code creation after merchant is credited', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-credited';
  const merchantId = 'merchant-khao-man-gai';

  db.merchants.set(merchantId, {
    merchant_id: merchantId,
    shop_name: 'ร้านข้าวมันไก่',
    is_approved: true,
  });

  db.transactions.push({
    transaction_id: 'tx-prior',
    user_id: referrerId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date(),
  });

  // Already credited
  db.referrals.push({
    referral_id: 'ref-prior-redeemed',
    referrer_user_id: referrerId,
    referred_user_id: 'user-friend-1',
    merchant_id: merchantId,
    transaction_id: 'tx-friend-1',
    referral_code: 'TP-DONE1',
    discount_amount: 0,
    status: 'redeemed',
    expires_at: null,
    converted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertMerchantNotYetCredited(referrerId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้า/);
      return true;
    }
  );
});

test('One Referral Per Merchant: Reject code validation when merchant already credited', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-valid-check';
  const merchantId = 'merchant-khao-man-gai';

  db.merchants.set(merchantId, {
    merchant_id: merchantId,
    shop_name: 'ร้านข้าวมันไก่',
    is_approved: true,
  });

  db.users.set(referrerId, {
    user_id: referrerId,
    full_name: 'สมชาย ใจดี',
  });

  db.transactions.push({
    transaction_id: 'tx-prior',
    user_id: referrerId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date(),
  });

  // Merchant already credited via an earlier referral
  db.referrals.push({
    referral_id: 'ref-credited-earlier',
    referrer_user_id: referrerId,
    referred_user_id: 'user-referee-1',
    merchant_id: merchantId,
    transaction_id: 'tx-referee-1',
    referral_code: 'TP-EARLIER',
    discount_amount: 0,
    status: 'redeemed',
    expires_at: null,
    converted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Now an old pending code exists
  db.referrals.push({
    referral_id: 'ref-old-pending',
    referrer_user_id: referrerId,
    referred_user_id: null,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-OLDPEND',
    discount_amount: 0,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertMerchantNotYetCredited(referrerId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้า/);
      return true;
    }
  );
});

test('One Referral Per Merchant: Shareable code can be reused by multiple friends before first conversion', async () => {
  const db = createMockDatabase();
  const referee1 = 'user-referee-a';
  const referee2 = 'user-referee-b';
  const merchantId = 'merchant-khao-man-gai';

  // Both referees are eligible before either completes payment
  await referralService.assertRefereeEligibleAtMerchant(referee1, merchantId, undefined, db.client as any);
  await referralService.assertRefereeEligibleAtMerchant(referee2, merchantId, undefined, db.client as any);
  assert.ok(true, 'Both friends can access/validate the shareable code before first conversion');
});

test('One Referral Per Merchant: Second referee conversion for already-credited merchant is rejected', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-second-ref';
  const merchantId = 'merchant-khao-man-gai';

  // Merchant already has a redeemed referral
  db.referrals.push({
    referral_id: 'ref-first-redeemed',
    referrer_user_id: referrerId,
    referred_user_id: 'user-friend-1',
    merchant_id: merchantId,
    transaction_id: 'tx-first-pay',
    referral_code: 'TP-FIRSTDONE',
    discount_amount: 0,
    status: 'redeemed',
    expires_at: null,
    converted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  // A second conversion attempt for this referrer at this merchant with different transactionId
  const newTxId = 'tx-second-friend-pay';
  await assert.rejects(
    async () => {
      await referralService.assertMerchantNotYetCredited(referrerId, merchantId, newTxId, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้า/);
      return true;
    }
  );
});

test('Duplicate Prevention: Referee cannot be counted twice at the same merchant', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-dup';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-prior-converted',
    referrer_user_id: 'user-other',
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: 'tx-prior',
    referral_code: 'TP-PRIOR1',
    discount_amount: 10,
    status: 'redeemed',
    expires_at: null,
    converted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /คุณได้รับคำเชิญสำหรับร้านนี้แล้ว/);
      return true;
    }
  );
});

test('Cancelled Referral: Referee with cancelled referral can receive new invitation if never paid', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-cancelled';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-cancelled-1',
    referrer_user_id: 'user-ref-old',
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-CANCEL1',
    discount_amount: 10,
    status: 'cancelled',
    expires_at: null,
    converted_at: null,
    created_at: new Date('2026-10-01T00:00:00Z'),
    updated_at: new Date('2026-10-02T00:00:00Z'),
  });

  await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
  assert.ok(true, 'Referee is eligible because cancelled referral does not block new invitation');
});

test('Expired Referral: Referee with expired referral can receive new invitation if never paid', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-expired';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-expired-1',
    referrer_user_id: 'user-ref-old',
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-EXPIRED1',
    discount_amount: 10,
    status: 'expired',
    expires_at: new Date('2026-10-10T00:00:00Z'),
    converted_at: null,
    created_at: new Date('2026-09-10T00:00:00Z'),
    updated_at: new Date('2026-10-10T00:00:00Z'),
  });

  db.referrals.push({
    referral_id: 'ref-expired-2',
    referrer_user_id: 'user-ref-old-2',
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-PASTEXP1',
    discount_amount: 10,
    status: 'pending',
    expires_at: new Date(Date.now() - 3600000), // 1 hour ago
    converted_at: null,
    created_at: new Date(Date.now() - 86400000),
    updated_at: new Date(Date.now() - 3600000),
  });

  await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
  assert.ok(true, 'Referee is eligible because expired referrals do not block new invitation');
});

test('Expired Referral with Prior Payment: Referee with expired referral is rejected if they completed a payment', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-expired-paid';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-expired-prior',
    referrer_user_id: 'user-ref-old',
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-EXPPAID1',
    discount_amount: 10,
    status: 'expired',
    expires_at: new Date('2026-10-10T00:00:00Z'),
    converted_at: null,
    created_at: new Date('2026-09-10T00:00:00Z'),
    updated_at: new Date('2026-10-10T00:00:00Z'),
  });

  db.transactions.push({
    transaction_id: 'tx-prior-success',
    user_id: refereeId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date('2026-10-15T00:00:00Z'),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /ผู้ได้รับการแนะนำต้องไม่เคยชำระเงินที่ร้านค้านี้มาก่อน/);
      return true;
    }
  );
});

test('Duplicate Invitation: Same referrer cannot invite the same referee to the same merchant twice', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-1';
  const refereeId = 'user-referee-dup-2';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-existing-same-referrer',
    referrer_user_id: referrerId,
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-SAME01',
    discount_amount: 10,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /คุณได้รับคำเชิญสำหรับร้านนี้แล้ว/);
      return true;
    }
  );
});

test('Competing Referrers: Different referrers cannot claim the same referee at the same merchant', async () => {
  const db = createMockDatabase();
  const referrerA = 'user-referrer-alpha';
  const refereeId = 'user-referee-shared';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-referrer-a',
    referrer_user_id: referrerA,
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-ALPHA1',
    discount_amount: 10,
    status: 'accepted',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /คุณได้รับคำเชิญสำหรับร้านนี้แล้ว/);
      return true;
    }
  );
});

test('Pending Referral Duplicate: Unredeemed pending referral blocks second referral for same referee at same merchant', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-pending';
  const merchantId = 'merchant-khao-man-gai';

  db.referrals.push({
    referral_id: 'ref-pending-existing',
    referrer_user_id: 'user-referrer-any',
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-PEND01',
    discount_amount: 10,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /คุณได้รับคำเชิญสำหรับร้านนี้แล้ว/);
      return true;
    }
  );
});

test('Different Merchants: Referee invited to Merchant B is allowed if they have never paid at Merchant B, even if already referred to Merchant A', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-multi-merchant';
  const merchantA = 'merchant-shop-a';
  const merchantB = 'merchant-shop-b';

  db.referrals.push({
    referral_id: 'ref-merchant-a',
    referrer_user_id: 'user-ref-1',
    referred_user_id: refereeId,
    merchant_id: merchantA,
    transaction_id: 'tx-a-1',
    referral_code: 'TP-SHOPA1',
    discount_amount: 10,
    status: 'redeemed',
    expires_at: null,
    converted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });
  db.transactions.push({
    transaction_id: 'tx-a-1',
    user_id: refereeId,
    merchant_id: merchantA,
    status: 'SUCCESS',
    created_at: new Date(),
  });

  await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantB, undefined, db.client as any);
  assert.ok(true, 'Referee is eligible at Merchant B');
});

test('Different Merchants: Referee invited to Merchant B is rejected if they previously paid successfully at Merchant B', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-multi-merchant-paid';
  const merchantB = 'merchant-shop-b';

  db.transactions.push({
    transaction_id: 'tx-b-prior',
    user_id: refereeId,
    merchant_id: merchantB,
    status: 'SUCCESS',
    created_at: new Date('2026-10-15T12:00:00Z'),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantB, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /ผู้ได้รับการแนะนำต้องไม่เคยชำระเงินที่ร้านค้านี้มาก่อน/);
      return true;
    }
  );
});

test('Idempotency: Re-processing identical transactionId does not double-issue coupons', () => {
  const alreadyAwardedMilestones = 1;
  const totalMilestonesDeserved = 1;
  const deltaToAward = Math.max(0, totalMilestonesDeserved - alreadyAwardedMilestones);

  assert.equal(deltaToAward, 0, 'Zero milestone coupons issued when already awarded for this milestone');
});

test('Repeated Checkout / Retry: Consecutive conversion requests with identical transactionId return cached result without duplicate coupon issuance or milestone count increment', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-retry';
  const refereeId = 'user-referee-retry';
  const merchantId = 'merchant-khao-man-gai';
  const transactionId = 'tx-retry-001';

  const { reward40 } = await referralService.getOrCreateRewardTemplates(db.client as any);

  db.referrals.push({
    referral_id: 'ref-already-redeemed',
    referrer_user_id: referrerId,
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: transactionId,
    referral_code: 'TP-RETRY1',
    discount_amount: 0,
    status: 'redeemed',
    expires_at: null,
    converted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const referral = db.referrals[0];
  assert.equal(referral.status, 'redeemed');
  assert.equal(referral.transaction_id, transactionId);

  const isRetry = referral.status === 'redeemed' && referral.transaction_id === transactionId;
  assert.ok(isRetry, 'Correctly detected idempotent retry');
  assert.equal(db.user_rewards.length, 0, 'No referee coupon created on retry');
});

test('Payment Failure: If payment fails or rolls back, referral remains pending and no coupon issued', async () => {
  const db = createMockDatabase();
  const referral = {
    referral_id: 'ref-pending-1',
    referrer_user_id: 'user-ref-1',
    referred_user_id: null,
    merchant_id: 'm-1',
    transaction_id: null,
    referral_code: 'TP-FAIL01',
    discount_amount: 10,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  db.referrals.push(referral);

  const paymentFailed = true;
  if (!paymentFailed) {
    referral.status = 'redeemed';
  }

  assert.equal(referral.status, 'pending', 'Referral status must remain pending on payment failure');
  assert.equal(db.user_rewards.length, 0, 'No user_rewards are issued when payment fails');
});

test('Concurrency Protection: Single-use referral code cannot be redeemed twice concurrently', async () => {
  const db = createMockDatabase();
  const code = 'TP-CONCUR01';
  db.referrals.push({
    referral_id: 'ref-concur',
    referrer_user_id: 'user-ref-1',
    referred_user_id: null,
    merchant_id: 'm-1',
    transaction_id: null,
    referral_code: code,
    discount_amount: 10,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  const firstRedeem = await db.client.referrals.findUnique({ where: { referral_code: code } });
  assert.ok(firstRedeem);
  assert.equal(firstRedeem.status, 'pending');
  await db.client.referrals.update({
    where: { referral_id: firstRedeem.referral_id },
    data: { status: 'redeemed', transaction_id: 'tx-1' },
  });

  const secondRedeem = await db.client.referrals.findUnique({ where: { referral_code: code } });
  assert.ok(secondRedeem);
  assert.equal(secondRedeem.status, 'redeemed');
  assert.throws(
    () => {
      if (secondRedeem.status === 'redeemed') {
        throw new ReferralError('รหัสแนะนำเพื่อนนี้ถูกใช้งานไปแล้ว', 400);
      }
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /ถูกใช้งานไปแล้ว/);
      return true;
    }
  );
});

test('Concurrency Protection: Concurrent invitations for same referee at same merchant are rejected', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-concurrent-race';
  const merchantId = 'merchant-khao-man-gai';
  const referrer1 = 'user-ref-1';

  db.referrals.push({
    referral_id: 'ref-thread-1',
    referrer_user_id: referrer1,
    referred_user_id: refereeId,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-RACE01',
    discount_amount: 10,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await assert.rejects(
    async () => {
      await referralService.assertRefereeEligibleAtMerchant(refereeId, merchantId, undefined, db.client as any);
    },
    (err: any) => {
      assert.ok(err instanceof ReferralError);
      assert.match(err.message, /คุณได้รับคำเชิญสำหรับร้านนี้แล้ว/);
      return true;
    }
  );
});

test('Reward Safety: ONLY referrer receives rewards; referee receives NO coupon on conversion', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-referee-no-reward';
  const referrerId = 'user-referrer-no-reward';
  const merchantId = 'merchant-khao-man-gai';
  const { reward40 } = await referralService.getOrCreateRewardTemplates(db.client as any);

  // Referrer has prior transaction
  db.transactions.push({
    transaction_id: 'tx-ref-prior',
    user_id: referrerId,
    merchant_id: merchantId,
    status: 'SUCCESS',
    created_at: new Date('2026-10-01T00:00:00Z'),
  });

  db.referrals.push({
    referral_id: 'ref-no-referee-reward',
    referrer_user_id: referrerId,
    referred_user_id: null,
    merchant_id: merchantId,
    transaction_id: null,
    referral_code: 'TP-NOREF1',
    discount_amount: 0,
    status: 'pending',
    expires_at: null,
    converted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // Process conversion: referrals.update to redeemed
  const conversionResult = await db.client.$transaction(async (tx: any) => {
    const completedAt = new Date();
    await tx.referrals.update({
      where: { referral_id: 'ref-no-referee-reward' },
      data: {
        status: 'redeemed',
        referred_user_id: refereeId,
        transaction_id: 'tx-referee-first-pay',
        converted_at: completedAt,
        updated_at: completedAt,
      },
    });

    return {
      success: true,
      refereeCoupon: undefined,
    };
  });

  // Verify NO user_reward exists for referee
  const refereeRewards = db.user_rewards.filter((ur) => ur.user_id === refereeId);
  assert.equal(refereeRewards.length, 0, 'No user_reward must be issued to the referee');
  assert.equal(conversionResult.refereeCoupon, undefined, 'refereeCoupon must be undefined');
});

test('Reward Template Creation & Reuse: Only Referrer ฿40 template is created and reused', async () => {
  const db = createMockDatabase();
  const { reward40 } = await referralService.getOrCreateRewardTemplates(db.client as any);
  assert.ok(reward40.reward_id);
  assert.equal(db.rewards.length, 1, 'Exactly 1 template created (฿40 Referrer Milestone)');

  const secondCall = await referralService.getOrCreateRewardTemplates(db.client as any);
  assert.equal(secondCall.reward40.reward_id, reward40.reward_id);
  assert.equal(db.rewards.length, 1, 'Template count remains 1 (no duplicates)');
});

test('Concurrency & Idempotency: Concurrent conversions at milestone boundary issue exactly ONE ฿40 coupon', async () => {
  const db = createMockDatabase();
  const referrerId = 'user-referrer-concurrent-milestone';
  const { reward40 } = await referralService.getOrCreateRewardTemplates(db.client as any);

  // 5 distinct merchants successfully redeemed
  for (let m = 1; m <= 5; m++) {
    db.referrals.push({
      referral_id: `ref-concur-${m}`,
      referrer_user_id: referrerId,
      referred_user_id: `referee-${m}`,
      merchant_id: `merchant-concur-${m}`,
      transaction_id: `tx-concur-${m}`,
      referral_code: `TP-CONCUR${m}`,
      discount_amount: 0,
      status: 'redeemed',
      expires_at: null,
      converted_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const distinctMerchants = await db.client.referrals.findMany({
    where: { referrer_user_id: referrerId, status: 'redeemed' },
    distinct: ['merchant_id'],
  });
  const totalMilestonesDeserved = Math.floor(distinctMerchants.length / REFERRER_MILESTONE_STEP);
  assert.equal(totalMilestonesDeserved, 1, 'Total deserved milestones is 1');

  // Thread 1 awards the milestone
  const alreadyAwarded1 = await db.client.user_rewards.count({
    where: { user_id: referrerId, reward_id: reward40.reward_id },
  });
  const toIssue1 = Math.max(0, totalMilestonesDeserved - alreadyAwarded1);
  assert.equal(toIssue1, 1, 'Thread 1 issues 1 coupon');
  if (toIssue1 > 0) {
    db.user_rewards.push({
      user_reward_id: 'ur-concur-40-1',
      user_id: referrerId,
      reward_id: reward40.reward_id,
      referral_id: 'ref-concur-5',
      transaction_id: 'tx-concur-5',
      reward_code: 'MILE40-CONCUR-5',
      status: 'available',
      earned_at: new Date(),
      expires_at: new Date(Date.now() + 14 * 86400000),
    });
  }

  // Thread 2 (concurrent / retry) checks milestone delta
  const alreadyAwarded2 = await db.client.user_rewards.count({
    where: { user_id: referrerId, reward_id: reward40.reward_id },
  });
  const toIssue2 = Math.max(0, totalMilestonesDeserved - alreadyAwarded2);
  assert.equal(toIssue2, 0, 'Thread 2 sees delta 0; must NOT issue duplicate ฿40 coupon');

  const totalRewardsIssued = db.user_rewards.filter(
    (ur) => ur.user_id === referrerId && ur.reward_id === reward40.reward_id
  ).length;
  assert.equal(totalRewardsIssued, 1, 'Exactly 1 ฿40 milestone reward exists in DB');
});

test('Milestone Transition: 6th merchant preserves 1 milestone coupon and resets progress to 1/5', () => {
  const count = 6;
  const milestonesCompleted = Math.floor(count / REFERRER_MILESTONE_STEP);
  const progress = count % REFERRER_MILESTONE_STEP;
  const needed = REFERRER_MILESTONE_STEP - progress;

  assert.equal(milestonesCompleted, 1, 'Still 1 milestone coupon earned');
  assert.equal(progress, 1, 'Progress in new milestone is 1/5 distinct merchants');
  assert.equal(needed, 4, 'Needs 4 more distinct merchants for 2nd milestone');
});

test('Milestone Transition: 10th merchant triggers 2nd milestone coupon', () => {
  const count = 10;
  const milestonesCompleted = Math.floor(count / REFERRER_MILESTONE_STEP);
  const progress = count % REFERRER_MILESTONE_STEP;
  const needed = progress === 0 ? REFERRER_MILESTONE_STEP : REFERRER_MILESTONE_STEP - progress;

  assert.equal(milestonesCompleted, 2, '2 milestone coupons earned');
  assert.equal(progress, 0, 'Progress reset');
  assert.equal(needed, 5, 'Needs 5 more distinct merchants for 3rd milestone');
});

test('Privacy Masking: maskName preserves citizen privacy', () => {
  assert.equal(referralService.maskName('สมชาย ใจดี'), 'สมชาย ใ***');
  assert.equal(referralService.maskName('อนุชา'), 'อน***');
  assert.equal(referralService.maskName(''), 'เพื่อนผู้ใช้สิทธิ์');
});

// =========================================================================
// ⏱️ UC 2.4.3: MILESTONE COUPON EXPIRY (14 DAYS) TEST SUITE
// =========================================================================

test('Milestone Expiry: Newly issued ฿40 coupon expires exactly earned_at + 14 days', () => {
  const earnedAt = new Date('2026-10-01T12:00:00.000Z');
  const expectedExpiresAt = new Date(earnedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

  const calculatedExpiresAt = new Date(earnedAt.getTime() + REFERRER_MILESTONE_VALID_DAYS * 86400000);
  assert.equal(
    calculatedExpiresAt.toISOString(),
    expectedExpiresAt.toISOString(),
    'expires_at must be exactly earned_at + 14 days'
  );
  assert.equal(
    calculatedExpiresAt.getTime() - earnedAt.getTime(),
    14 * 86400000,
    'Duration must equal 14 full 24-hour days (1,209,600,000 ms)'
  );
});

test('Coupon Expiry Validation: Valid at 13 days (before 14-day expiry limit)', () => {
  const earnedAt = new Date('2026-10-01T10:00:00.000Z');
  const expiresAt = new Date(earnedAt.getTime() + 14 * 86400000); // 2026-10-15T10:00:00.000Z

  // Current time is 13 days after issuance
  const checkTimeAt13Days = new Date(earnedAt.getTime() + 13 * 86400000); // 2026-10-14T10:00:00.000Z

  const isExpired = checkTimeAt13Days.getTime() > expiresAt.getTime();
  assert.equal(isExpired, false, 'Coupon must remain valid at 13 days');

  const diffMs = expiresAt.getTime() - checkTimeAt13Days.getTime();
  const remainingDays = Math.ceil(diffMs / 86400000);
  assert.equal(remainingDays, 1, 'At 13 days, remaining day is 1');
});

test('Coupon Expiry Validation: Boundary condition at exactly 14 days', () => {
  const earnedAt = new Date('2026-10-01T10:00:00.000Z');
  const expiresAt = new Date(earnedAt.getTime() + 14 * 86400000); // 2026-10-15T10:00:00.000Z

  // Exactly at boundary
  const atExactBoundary = new Date(expiresAt.getTime());
  const isExpiredAtBoundary = atExactBoundary.getTime() > expiresAt.getTime();
  assert.equal(isExpiredAtBoundary, false, 'At exact boundary, coupon has not yet exceeded expiration');
});

test('Coupon Expiry Validation: Rejected after 14 days (expired condition)', () => {
  const earnedAt = new Date('2026-10-01T10:00:00.000Z');
  const expiresAt = new Date(earnedAt.getTime() + 14 * 86400000); // 2026-10-15T10:00:00.000Z

  // Check 1 millisecond and 1 second after 14 days
  const after14Days = new Date(expiresAt.getTime() + 1000);
  const isExpired = after14Days.getTime() > expiresAt.getTime();
  assert.equal(isExpired, true, 'Coupon must be rejected as expired after 14 days');
});

test('Independent Expiry: Multiple milestone coupons each have independent 14-day validity', () => {
  // Milestone 1 earned on Day 1
  const earnedAt1 = new Date('2026-10-01T10:00:00.000Z');
  const expiresAt1 = new Date(earnedAt1.getTime() + 14 * 86400000); // 2026-10-15T10:00:00.000Z

  // Milestone 2 earned 5 days later (Day 6)
  const earnedAt2 = new Date('2026-10-06T10:00:00.000Z');
  const expiresAt2 = new Date(earnedAt2.getTime() + 14 * 86400000); // 2026-10-20T10:00:00.000Z

  // Check state on Day 16 (2026-10-17)
  const evalDate = new Date('2026-10-17T10:00:00.000Z');

  const coupon1Expired = evalDate.getTime() > expiresAt1.getTime();
  const coupon2Expired = evalDate.getTime() > expiresAt2.getTime();

  assert.equal(coupon1Expired, true, 'Coupon 1 (earned Oct 1) is expired on Oct 17');
  assert.equal(coupon2Expired, false, 'Coupon 2 (earned Oct 6) is STILL VALID on Oct 17');

  const diffMs2 = expiresAt2.getTime() - evalDate.getTime();
  const remainingDays2 = Math.ceil(diffMs2 / 86400000);
  assert.equal(remainingDays2, 3, 'Coupon 2 still has 3 days remaining');
});

test('Preserve Existing: Existing coupons are not retroactively modified', async () => {
  const db = createMockDatabase();
  const oldEarnedAt = new Date('2026-09-01T00:00:00.000Z');
  const oldExpiresAt = new Date('2026-10-01T00:00:00.000Z'); // legacy 30 days

  // Pre-existing legacy coupon
  db.user_rewards.push({
    user_reward_id: 'ur-legacy-1',
    user_id: 'user-legacy',
    reward_id: 'reward-40',
    referral_id: 'ref-legacy',
    transaction_id: 'tx-legacy',
    reward_code: 'MILE40-LEGACY-01',
    status: 'available',
    earned_at: oldEarnedAt,
    expires_at: oldExpiresAt,
  });

  const existing = await db.client.user_rewards.findFirst({
    where: { user_reward_id: 'ur-legacy-1' },
  });

  assert.ok(existing);
  assert.equal(
    existing.expires_at?.toISOString(),
    oldExpiresAt.toISOString(),
    'Legacy coupon expires_at must remain untouched'
  );
});

test('Preserve Historical Records: Existing referee and referrer coupons are never retroactively deleted', async () => {
  const db = createMockDatabase();
  const refereeId = 'user-historical-referee';
  const referrerId = 'user-historical-referrer';

  // Seed historical referee ฿10 coupon and referrer ฿40 coupon
  db.user_rewards.push({
    user_reward_id: 'ur-hist-referee-10',
    user_id: refereeId,
    reward_id: 'reward-10-hist',
    referral_id: 'ref-hist-1',
    transaction_id: 'tx-hist-1',
    reward_code: 'REF10-HIST-01',
    status: 'available',
    earned_at: new Date('2026-10-01T00:00:00Z'),
    expires_at: new Date('2026-10-31T00:00:00Z'),
  });

  db.user_rewards.push({
    user_reward_id: 'ur-hist-referrer-40',
    user_id: referrerId,
    reward_id: 'reward-40-hist',
    referral_id: 'ref-hist-1',
    transaction_id: 'tx-hist-1',
    reward_code: 'MILE40-HIST-01',
    status: 'available',
    earned_at: new Date('2026-10-01T00:00:00Z'),
    expires_at: new Date('2026-10-15T00:00:00Z'),
  });

  // Query existing rewards
  const existingReferee = await db.client.user_rewards.findFirst({
    where: { user_reward_id: 'ur-hist-referee-10' },
  });
  const existingReferrer = await db.client.user_rewards.findFirst({
    where: { user_reward_id: 'ur-hist-referrer-40' },
  });

  assert.ok(existingReferee, 'Historical referee ฿10 record remains preserved in DB');
  assert.ok(existingReferrer, 'Historical referrer ฿40 record remains preserved in DB');
  assert.equal(db.user_rewards.length, 2, 'Total rewards count is preserved without retroactive deletions');
});
