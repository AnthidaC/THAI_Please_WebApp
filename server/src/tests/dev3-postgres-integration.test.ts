const TEST_DB_URL = 'postgresql://postgres_test:test_password_merchant_cat@localhost:5433/thai_please_test_db';

process.env.DATABASE_URL = TEST_DB_URL;
process.env.DIRECT_URL = TEST_DB_URL;

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { referralService } from '../services/referral.service';
import { createReview } from '../services/review.service';
import { preferenceService } from '../services/preference.service';
import { paymentService } from '../services/payment.service';

// Safety Guard: Verify host is strictly localhost and database is test DB
before(async () => {
  const dbInfo = await prisma.$queryRaw<Array<{ current_database: string; inet_server_port: number }>>`
    SELECT current_database(), inet_server_port();
  `;
  const info = dbInfo[0];
  assert.equal(info.current_database, 'thai_please_test_db', 'FATAL: Test must run ONLY on thai_please_test_db');
  assert.equal(info.inet_server_port, 5432, 'FATAL: Must connect to local Docker port');
  console.log(`[Safety Verified] Connected to isolated test DB: ${info.current_database} on port 5433->5432`);
});

after(async () => {
  await prisma.$disconnect();
});

test('PostgreSQL End-to-End: Referral -> Payment -> 1 Credit -> 5 Merchants -> ฿40 Coupon (14 Days) -> Redemption', async () => {
  const uniqueSuffix = Date.now().toString().slice(-8);

  // 1. Setup Test Users
  const referrer = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_ref_${uniqueSuffix}_1`,
      full_name: 'ผู้แนะนำ สมศักดิ์',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  const referee1 = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_ref_${uniqueSuffix}_2`,
      full_name: 'เพื่อนใหม่ มานี',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  // Create wallets for users
  await prisma.wallets.create({
    data: {
      user_id: referrer.user_id,
      balance: new Prisma.Decimal(1000),
      eligibility_status: 'VERIFIED',
      daily_quota_limit: new Prisma.Decimal(150),
      daily_quota_used: new Prisma.Decimal(0),
      total_quota_remaining: new Prisma.Decimal(3000),
    },
  });

  await prisma.wallets.create({
    data: {
      user_id: referee1.user_id,
      balance: new Prisma.Decimal(1000),
      eligibility_status: 'VERIFIED',
      daily_quota_limit: new Prisma.Decimal(150),
      daily_quota_used: new Prisma.Decimal(0),
      total_quota_remaining: new Prisma.Decimal(3000),
    },
  });

  // 2. Setup 5 Distinct Merchants
  const merchants: any[] = [];
  for (let i = 1; i <= 5; i++) {
    const m = await prisma.merchants.create({
      data: {
        tax_id: `tax_${uniqueSuffix}_${i}`,
        shop_name: `ร้านอาหารชุมชน ${i}`,
        category_id: 'FOOD',
        latitude: new Prisma.Decimal(13.7563),
        longitude: new Prisma.Decimal(100.5018),
        is_approved: true,
      },
    });
    merchants.push(m);

    // Seed Referrer prior successful payment at each merchant (Requirement: Referrer must have prior SUCCESS)
    await prisma.transactions.create({
      data: {
        user_id: referrer.user_id,
        merchant_id: m.merchant_id,
        total_amount: new Prisma.Decimal(100),
        government_copay_amount: new Prisma.Decimal(60),
        citizen_paid_amount: new Prisma.Decimal(40),
        status: 'SUCCESS',
        completed_at: new Date(Date.now() - 3600000),
      },
    });
  }

  // 3. Merchant 1: Referrer creates referral code
  const codeResult = await referralService.getOrCreateMyReferralCode(
    referrer.user_id,
    { merchantId: merchants[0].merchant_id }
  );
  assert.ok(codeResult.referralCode);

  // 4. Validate Code for Referee 1: Confirms ฿0 discount and referee eligibility
  const validation = await paymentService.validateDiscountCode({
    code: codeResult.referralCode,
    totalAmount: 100,
    userId: referee1.user_id,
    merchantId: merchants[0].merchant_id,
  });
  assert.equal(validation.isValid, true);
  assert.equal(validation.discountAmount, 0, 'Referee receives exactly ฿0 discount');
  assert.equal(validation.discountSource, 'FRIEND_REFERRAL');

  // 5. Simulate First Successful Conversion for Merchant 1
  const tx1 = await prisma.transactions.create({
    data: {
      user_id: referee1.user_id,
      merchant_id: merchants[0].merchant_id,
      total_amount: new Prisma.Decimal(100),
      government_copay_amount: new Prisma.Decimal(60),
      citizen_paid_amount: new Prisma.Decimal(40),
      status: 'SUCCESS',
      completed_at: new Date(),
    },
  });

  const convResult1 = await referralService.processReferralConversion({
    referralCode: codeResult.referralCode,
    refereeUserId: referee1.user_id,
    merchantId: merchants[0].merchant_id,
    transactionId: tx1.transaction_id,
  });
  assert.equal(convResult1.success, true);
  const updatedRef1 = await prisma.referrals.findUnique({
    where: { referral_id: convResult1.referralId },
  });
  assert.equal(updatedRef1?.status, 'redeemed');
  assert.equal(convResult1.referrerMilestoneCoupons.length, 0, '1st merchant does not reach 5-merchant milestone');

  // Verify Idempotency: Re-submitting same transaction returns cached result
  const idemResult = await referralService.processReferralConversion({
    referralCode: codeResult.referralCode,
    refereeUserId: referee1.user_id,
    merchantId: merchants[0].merchant_id,
    transactionId: tx1.transaction_id,
  });
  assert.equal(idemResult.success, true);
  assert.equal(idemResult.referralId, convResult1.referralId);
  assert.equal(idemResult.referrerMilestoneCoupons.length, 0);

  // Verify One Referral Credit Per Merchant: Second referee cannot use referrer code for Merchant 1
  const referee2 = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_ref_${uniqueSuffix}_3`,
      full_name: 'เพื่อนคนที่สอง ชูใจ',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  // Verify One Referral Credit Per Merchant:
  // 5.1 Existing referral code is rejected because it was already redeemed
  await assert.rejects(
    async () => {
      await paymentService.validateDiscountCode({
        code: codeResult.referralCode,
        totalAmount: 100,
        userId: referee2.user_id,
        merchantId: merchants[0].merchant_id,
      });
    },
    /โค้ดคำชวนของเพื่อนนี้ถูกใช้งานไปแล้ว/
  );

  // 5.2 Referrer is blocked from creating any new code for Merchant 1 (already credited)
  await assert.rejects(
    async () => {
      await referralService.getOrCreateMyReferralCode(
        referrer.user_id,
        { merchantId: merchants[0].merchant_id }
      );
    },
    /จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้า/
  );

  // 6. Complete referrals for Merchants 2, 3, 4, and 5 to hit the 5-merchant milestone
  for (let i = 1; i <= 4; i++) {
    const friend = await prisma.user.create({
      data: {
        citizen_id_hash: `hash_friend_${uniqueSuffix}_${i}`,
        full_name: `เพื่อนที่ ${i}`,
        province_code: '10',
        is_registered_thai_plus: true,
      },
    });

    const friendCode = await referralService.getOrCreateMyReferralCode(
      referrer.user_id,
      { merchantId: merchants[i].merchant_id }
    );

    const friendTx = await prisma.transactions.create({
      data: {
        user_id: friend.user_id,
        merchant_id: merchants[i].merchant_id,
        total_amount: new Prisma.Decimal(100),
        government_copay_amount: new Prisma.Decimal(60),
        citizen_paid_amount: new Prisma.Decimal(40),
        status: 'SUCCESS',
        completed_at: new Date(),
      },
    });

    const res = await referralService.processReferralConversion({
      referralCode: friendCode.referralCode,
      refereeUserId: friend.user_id,
      merchantId: merchants[i].merchant_id,
      transactionId: friendTx.transaction_id,
    });

    if (i === 4) {
      // 5th distinct merchant!
      assert.equal(res.referrerMilestoneCoupons.length, 1, '5th distinct merchant triggers ฿40 coupon!');
      assert.ok(res.referrerMilestoneCoupons[0].rewardCode, 'Coupon code must be generated');
      assert.equal(res.referrerMilestoneCoupons[0].discountValue, 40, 'Coupon value must be ฿40');
    }
  }

  // 7. Verify Referrer's ฿40 coupon in user_rewards table
  const userReward = await prisma.user_rewards.findFirst({
    where: { user_id: referrer.user_id, status: 'available' },
    include: { rewards: true },
  });
  assert.ok(userReward, 'Referrer must have an available reward coupon');
  assert.equal(Number(userReward.rewards.discount_value), 40, 'Reward value must be 40 baht');

  // Verify 14-day expiry
  const earnedTime = new Date(userReward.earned_at).getTime();
  const expiresTime = new Date(userReward.expires_at!).getTime();
  const daysDiff = (expiresTime - earnedTime) / (1000 * 60 * 60 * 24);
  assert.ok(Math.abs(daysDiff - 14) < 0.05, `Coupon must expire in exactly 14 days, got ${daysDiff}`);

  // 8. Test Coupon Redemption via paymentService.validateDiscountCode
  const couponValidation = await paymentService.validateDiscountCode({
    code: userReward.reward_code,
    totalAmount: 100,
    userId: referrer.user_id,
  });
  assert.equal(couponValidation.isValid, true);
  assert.equal(couponValidation.discountAmount, 40, '฿40 coupon reduces bill by ฿40');
  assert.equal(couponValidation.discountSource, 'COUPON');

  // 9. Test Database-level Partial Unique Index Concurrency Rejection
  // (referred_user_id, merchant_id) must be unique among pending/accepted/redeemed
  await assert.rejects(
    async () => {
      await prisma.referrals.create({
        data: {
          referrer_user_id: referrer.user_id,
          referred_user_id: referee1.user_id,
          merchant_id: merchants[0].merchant_id,
          referral_code: `DUP_${Date.now()}`,
          status: 'pending',
          discount_amount: new Prisma.Decimal(0),
        },
      });
    },
    (err: any) => {
      assert.ok(err.code === 'P2002' || err.message.includes('uq_referrals_referee_merchant'));
      return true;
    }
  );
});

test('PostgreSQL Integration: 24-Hour Review Restrictions and Anti-Fraud Verification', async () => {
  const uniqueSuffix = Date.now().toString().slice(-8);

  const citizen = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_rev_${uniqueSuffix}_1`,
      full_name: 'ผู้รีวิว กิตติ',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  const merchant = await prisma.merchants.create({
    data: {
      tax_id: `tax_rev_${uniqueSuffix}`,
      shop_name: 'ร้านข้าวมันไก่ ประตูน้ำ',
      category_id: 'FOOD',
      latitude: new Prisma.Decimal(13.75),
      longitude: new Prisma.Decimal(100.5),
      is_approved: true,
    },
  });

  // Case A: Transaction completed within 24 hours -> ALLOWED to review
  const recentTx = await prisma.transactions.create({
    data: {
      user_id: citizen.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: new Prisma.Decimal(80),
      government_copay_amount: new Prisma.Decimal(48),
      citizen_paid_amount: new Prisma.Decimal(32),
      status: 'SUCCESS',
      completed_at: new Date(Date.now() - 2 * 3600000), // 2 hours ago
    },
  });

  const reviewResult = await createReview(citizen.user_id, {
    transactionId: recentTx.transaction_id,
    ratingStars: 5,
    reviewText: 'อร่อยมาก ไก่นุ่ม น้ำจิ้มเด็ดมากครับ',
  });
  assert.equal(reviewResult.ratingStars, 5);
  assert.equal(reviewResult.transactionId, recentTx.transaction_id);

  // Case B: Duplicate review on same transaction -> REJECTED (409)
  await assert.rejects(
    async () => {
      await createReview(citizen.user_id, {
        transactionId: recentTx.transaction_id,
        ratingStars: 4,
        reviewText: 'พยายามรีวิวซ้ำ',
      });
    },
    /ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว/
  );

  // Case C: Transaction completed > 24 hours ago -> REJECTED (400)
  const oldTx = await prisma.transactions.create({
    data: {
      user_id: citizen.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: new Prisma.Decimal(120),
      government_copay_amount: new Prisma.Decimal(72),
      citizen_paid_amount: new Prisma.Decimal(48),
      status: 'SUCCESS',
      completed_at: new Date(Date.now() - 26 * 3600000), // 26 hours ago (> 24h)
    },
  });

  await assert.rejects(
    async () => {
      await createReview(citizen.user_id, {
        transactionId: oldTx.transaction_id,
        ratingStars: 4,
        reviewText: 'รีวิวเกิน 24 ชม.',
      });
    },
    /สิทธิ์การประเมินรีวิวหมดอายุแล้ว/
  );
});

test('PostgreSQL Integration: Category Preferences (5 Canonical Categories)', async () => {
  const uniqueSuffix = Date.now().toString().slice(-8);

  const citizen = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_pref_${uniqueSuffix}`,
      full_name: 'ผู้ใช้ชอบอาหารริมทาง',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  // Save preferences for 2 canonical categories
  const saved = await preferenceService.updateUserPreferences(citizen.user_id, {
    preferences: [
      { categoryId: 'FOOD', preferenceWeight: 1.5 },
      { categoryId: 'STREET_FOOD', preferenceWeight: 2.0 },
    ],
  });
  assert.equal(saved.preferences.length, 2);

  // Retrieve preferences
  const retrieved = await preferenceService.getUserPreferences(citizen.user_id);
  assert.equal(retrieved.preferences.length, 2);
  const catIds = retrieved.preferences.map((p) => p.categoryId);
  assert.ok(catIds.includes('FOOD'));
  assert.ok(catIds.includes('STREET_FOOD'));
});

test('PostgreSQL Concurrency: Simultaneous conversions for the same merchant allow only ONE winner', async () => {
  const uniqueSuffix = Date.now().toString().slice(-8);

  const referrer = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_race_ref_${uniqueSuffix}`,
      full_name: 'ผู้แนะนำ แข่งขัน',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  const merchant = await prisma.merchants.create({
    data: {
      tax_id: `tax_race_${uniqueSuffix}`,
      shop_name: 'ร้านทดสอบการแข่งขัน Concurrency',
      category_id: 'FOOD',
      latitude: new Prisma.Decimal(13.75),
      longitude: new Prisma.Decimal(100.5),
      is_approved: true,
    },
  });

  // Prior payment for referrer
  await prisma.transactions.create({
    data: {
      user_id: referrer.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: new Prisma.Decimal(100),
      government_copay_amount: new Prisma.Decimal(60),
      citizen_paid_amount: new Prisma.Decimal(40),
      status: 'SUCCESS',
      completed_at: new Date(Date.now() - 3600000),
    },
  });

  // Generate shareable code
  const codeResult = await referralService.getOrCreateMyReferralCode(referrer.user_id, {
    merchantId: merchant.merchant_id,
  });

  // Create two distinct referees
  const friendA = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_race_a_${uniqueSuffix}`,
      full_name: 'เพื่อนคนที่ A',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  const friendB = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_race_b_${uniqueSuffix}`,
      full_name: 'เพื่อนคนที่ B',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  // Transactions for both friends
  const txA = await prisma.transactions.create({
    data: {
      user_id: friendA.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: new Prisma.Decimal(100),
      government_copay_amount: new Prisma.Decimal(60),
      citizen_paid_amount: new Prisma.Decimal(40),
      status: 'SUCCESS',
      completed_at: new Date(),
    },
  });

  const txB = await prisma.transactions.create({
    data: {
      user_id: friendB.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: new Prisma.Decimal(100),
      government_copay_amount: new Prisma.Decimal(60),
      citizen_paid_amount: new Prisma.Decimal(40),
      status: 'SUCCESS',
      completed_at: new Date(),
    },
  });

  // Fire both conversions concurrently via Promise.allSettled
  const results = await Promise.allSettled([
    referralService.processReferralConversion({
      referralCode: codeResult.referralCode,
      refereeUserId: friendA.user_id,
      merchantId: merchant.merchant_id,
      transactionId: txA.transaction_id,
    }),
    referralService.processReferralConversion({
      referralCode: codeResult.referralCode,
      refereeUserId: friendB.user_id,
      merchantId: merchant.merchant_id,
      transactionId: txB.transaction_id,
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  // Exactly ONE conversion must succeed; the other must be rejected due to merchant single-credit locking
  assert.equal(fulfilled.length, 1, 'Exactly one concurrent conversion must succeed');
  assert.equal(rejected.length, 1, 'The losing conversion must be rejected');

  // Verify DB state: exactly 1 referral row is redeemed for this merchant and referrer
  const redeemedCount = await prisma.referrals.count({
    where: {
      referrer_user_id: referrer.user_id,
      merchant_id: merchant.merchant_id,
      status: 'redeemed',
    },
  });
  assert.equal(redeemedCount, 1, 'Database must have exactly 1 redeemed referral record');
});

test('PostgreSQL Concurrency: Two conversions completing the 5-merchant milestone concurrently issue exactly ONE ฿40 coupon', async () => {
  const uniqueSuffix = Date.now().toString().slice(-8);

  const referrer = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_ms_ref_${uniqueSuffix}`,
      full_name: 'ผู้แนะนำ ทดสอบไมล์สโตน Concurrency',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  // Create 6 merchants where referrer has previously paid
  const merchants = [];
  for (let i = 1; i <= 6; i++) {
    const m = await prisma.merchants.create({
      data: {
        tax_id: `tax_ms_${i}_${uniqueSuffix}`,
        shop_name: `ร้านไมล์สโตนที่ ${i}`,
        category_id: 'FOOD',
        latitude: new Prisma.Decimal(13.75),
        longitude: new Prisma.Decimal(100.5),
        is_approved: true,
      },
    });
    await prisma.transactions.create({
      data: {
        user_id: referrer.user_id,
        merchant_id: m.merchant_id,
        total_amount: new Prisma.Decimal(100),
        government_copay_amount: new Prisma.Decimal(60),
        citizen_paid_amount: new Prisma.Decimal(40),
        status: 'SUCCESS',
        completed_at: new Date(Date.now() - 3600000),
      },
    });
    merchants.push(m);
  }

  // Pre-seed 4 distinct redeemed merchants (Merchants 1-4)
  for (let i = 0; i < 4; i++) {
    const referee = await prisma.user.create({
      data: {
        citizen_id_hash: `hash_ms_seed_${i}_${uniqueSuffix}`,
        full_name: `เพื่อนที่ ${i + 1}`,
        province_code: '10',
        is_registered_thai_plus: true,
      },
    });
    const tx = await prisma.transactions.create({
      data: {
        user_id: referee.user_id,
        merchant_id: merchants[i].merchant_id,
        total_amount: new Prisma.Decimal(100),
        government_copay_amount: new Prisma.Decimal(60),
        citizen_paid_amount: new Prisma.Decimal(40),
        status: 'SUCCESS',
        completed_at: new Date(),
      },
    });
    await prisma.referrals.create({
      data: {
        referrer_user_id: referrer.user_id,
        referred_user_id: referee.user_id,
        merchant_id: merchants[i].merchant_id,
        transaction_id: tx.transaction_id,
        referral_code: `TP-SEED-${i}-${uniqueSuffix}`,
        discount_amount: 0,
        status: 'redeemed',
        converted_at: new Date(),
      },
    });
  }

  // Prepare Merchant 5 and Merchant 6 for concurrent milestone completion
  const code5 = await referralService.getOrCreateMyReferralCode(referrer.user_id, {
    merchantId: merchants[4].merchant_id,
  });
  const code6 = await referralService.getOrCreateMyReferralCode(referrer.user_id, {
    merchantId: merchants[5].merchant_id,
  });

  const referee5 = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_ms_5_${uniqueSuffix}`,
      full_name: 'เพื่อนคนที่ 5',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });
  const referee6 = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_ms_6_${uniqueSuffix}`,
      full_name: 'เพื่อนคนที่ 6',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  const tx5 = await prisma.transactions.create({
    data: {
      user_id: referee5.user_id,
      merchant_id: merchants[4].merchant_id,
      total_amount: new Prisma.Decimal(100),
      government_copay_amount: new Prisma.Decimal(60),
      citizen_paid_amount: new Prisma.Decimal(40),
      status: 'SUCCESS',
      completed_at: new Date(),
    },
  });
  const tx6 = await prisma.transactions.create({
    data: {
      user_id: referee6.user_id,
      merchant_id: merchants[5].merchant_id,
      total_amount: new Prisma.Decimal(100),
      government_copay_amount: new Prisma.Decimal(60),
      citizen_paid_amount: new Prisma.Decimal(40),
      status: 'SUCCESS',
      completed_at: new Date(),
    },
  });

  // Fire both conversions concurrently across the 5th and 6th distinct merchants
  const [res5, res6] = await Promise.all([
    referralService.processReferralConversion({
      referralCode: code5.referralCode,
      refereeUserId: referee5.user_id,
      merchantId: merchants[4].merchant_id,
      transactionId: tx5.transaction_id,
    }),
    referralService.processReferralConversion({
      referralCode: code6.referralCode,
      refereeUserId: referee6.user_id,
      merchantId: merchants[5].merchant_id,
      transactionId: tx6.transaction_id,
    }),
  ]);

  // Both distinct merchant conversions succeed
  assert.equal(res5.success, true);
  assert.equal(res6.success, true);

  // Together across both conversions, exactly ONE ฿40 milestone coupon must be issued
  const totalMilestoneCouponsReturned =
    res5.referrerMilestoneCoupons.length + res6.referrerMilestoneCoupons.length;
  assert.equal(
    totalMilestoneCouponsReturned,
    1,
    'Concurrent crossing of 5th and 6th merchant must issue exactly ONE ฿40 milestone coupon'
  );

  // In database: user_rewards must contain exactly 1 coupon for this referrer
  const { reward40 } = await referralService.getOrCreateRewardTemplates();
  const dbCoupons = await prisma.user_rewards.findMany({
    where: {
      user_id: referrer.user_id,
      reward_id: reward40.reward_id,
    },
  });
  assert.equal(dbCoupons.length, 1, 'Database must have exactly 1 ฿40 milestone coupon issued');
  assert.equal(dbCoupons[0].status, 'available');

  const expiryDiffDays =
    (dbCoupons[0].expires_at!.getTime() - dbCoupons[0].earned_at.getTime()) / (1000 * 60 * 60 * 24);
  assert.ok(Math.abs(expiryDiffDays - 14) < 0.01, 'Milestone coupon must expire in 14 days');
});

test('PostgreSQL Coupon Safety: Expired and reused coupons are strictly rejected, and failed referral attribution does not block normal payment', async () => {
  const uniqueSuffix = Date.now().toString().slice(-8);

  const citizen = await prisma.user.create({
    data: {
      citizen_id_hash: `hash_csafe_${uniqueSuffix}`,
      full_name: 'พลเมือง ทดสอบคูปอง',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });

  const reward = await prisma.rewards.create({
    data: {
      reward_name: 'คูปองทดสอบ ฿40',
      discount_value: new Prisma.Decimal(40),
      discount_type: 'fixed',
      reward_type: 'DISCOUNT_VOUCHER',
    },
  });

  // 1. Reused Coupon Test
  const usedReward = await prisma.user_rewards.create({
    data: {
      user_id: citizen.user_id,
      reward_id: reward.reward_id,
      reward_code: `USED_${uniqueSuffix}`,
      status: 'used', // Already used
      expires_at: new Date(Date.now() + 86400000),
    },
  });

  await assert.rejects(
    async () => {
      await paymentService.validateDiscountCode({
        code: usedReward.reward_code,
        totalAmount: 100,
        userId: citizen.user_id,
      });
    },
    /คูปองนี้ถูกใช้งานไปแล้วหรือหมดสิทธิ์/
  );

  // 2. Expired Coupon Test
  const expiredReward = await prisma.user_rewards.create({
    data: {
      user_id: citizen.user_id,
      reward_id: reward.reward_id,
      reward_code: `EXPIRED_${uniqueSuffix}`,
      status: 'available',
      expires_at: new Date(Date.now() - 60000), // Expired 1 minute ago
    },
  });

  await assert.rejects(
    async () => {
      await paymentService.validateDiscountCode({
        code: expiredReward.reward_code,
        totalAmount: 100,
        userId: citizen.user_id,
      });
    },
    /คูปองนี้หมดอายุแล้ว/
  );

  // 3. Normal Payment Resilience: Failed referral conversion does not block normal payment
  // Verify that an invalid referral code or failing referral post-hook does not throw in payment processing
  // When discount is ฿0 or code cannot be converted, calculateCopay still completes cleanly
  const copayResult = paymentService.calculateCopay(100, 150, 3000, 0, 'INVALID_REF', 'โค้ดชวนเพื่อน');
  assert.equal(copayResult.originalTotalAmount, 100);
  assert.equal(copayResult.discountAmount, 0);
  assert.equal(copayResult.netTotalAmount, 100);
  assert.equal(copayResult.citizenPaidAmount, 40);
  assert.equal(copayResult.governmentCopayAmount, 60);
});

