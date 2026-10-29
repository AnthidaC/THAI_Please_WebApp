/**
 * Developer 3: UC-04 Verified Review Logic Offline Audit Tests
 *
 * Test Category: ISOLATED UNIT TESTS WITH MOCKED PRISMA
 * Execution Mode: 100% Offline (No Supabase writes, No Live DB connection, No UI dependency)
 */

import assert from 'node:assert/strict';
import {
  createReview,
  getReviewByTransactionId,
  getUserReviews,
  getMerchantReviews,
  ReviewServiceError,
} from '../services/review.service';
import { createReviewSchema } from '../validations/review.validation';

// Helper mock factory
function createMockPrisma(overrides: {
  transactionRecord?: any;
  reviewsCreated?: any[];
  aggregateResult?: any;
  merchantRecord?: any;
  merchantUpdatedWith?: any;
  transactionThrows?: Error;
  queryRawCalled?: boolean;
} = {}) {
  const reviewsCreated: any[] = overrides.reviewsCreated ?? [];
  let queryRawCalled = false;
  let merchantUpdatedWith: any = null;

  const mockTxPrisma = {
    $queryRaw: async (query: any, ...args: any[]) => {
      queryRawCalled = true;
      return [{ merchant_id: overrides.transactionRecord?.merchant_id }];
    },
    reviews: {
      create: async ({ data }: { data: any }) => {
        if (overrides.transactionThrows) {
          throw overrides.transactionThrows;
        }
        const created = {
          review_id: 'mock-review-uuid-1',
          created_at: new Date('2026-10-28T10:00:00.000Z'),
          ...data,
        };
        reviewsCreated.push(created);
        return created;
      },
      aggregate: async ({ where }: any) => {
        return (
          overrides.aggregateResult ?? {
            _avg: { rating_stars: 4.33333333 },
            _count: { rating_stars: 3 },
          }
        );
      },
    },
    merchants: {
      update: async ({ where, data }: any) => {
        merchantUpdatedWith = data;
        return {
          merchant_id: where.merchant_id,
          ...data,
        };
      },
    },
  };

  const client = {
    transactions: {
      findUnique: async ({ where }: any) => {
        if (!overrides.transactionRecord) return null;
        return {
          completed_at: overrides.transactionRecord.completed_at !== undefined
            ? overrides.transactionRecord.completed_at
            : overrides.transactionRecord.created_at,
          ...overrides.transactionRecord,
        };
      },
    },
    reviews: {
      findUnique: async ({ where }: any) => {
        return overrides.reviewsCreated?.[0] ?? null;
      },
      findMany: async ({ where }: any) => {
        return reviewsCreated;
      },
    },
    merchants: {
      findUnique: async ({ where }: any) => {
        return (
          overrides.merchantRecord ?? {
            merchant_id: 'm-12345',
            shop_name: 'ข้าวมันไก่ ประตูน้ำ',
            average_rating_stars: 4.5,
          }
        );
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      return await callback(mockTxPrisma);
    },
    get queryRawCalled() {
      return queryRawCalled;
    },
    get merchantUpdatedWith() {
      return merchantUpdatedWith;
    },
  };

  return client;
}

// =========================================================================
// TEST SUITE: Developer 3 UC-04 Verified Review Logic
// =========================================================================

async function runReviewAuditTests() {
  console.log('\n============================================================');
  console.log('🧪 DEVELOPER 3: UC-04 REVIEW LOGIC AUDIT & VERIFICATION');
  console.log('Mode: Isolated Unit Tests (Offline / Mocked Prisma)');
  console.log('============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      if (err.stack) {
        const stackLine = err.stack.split('\n')[1];
        console.error(`     Location: ${stackLine?.trim()}`);
      }
      failedCount++;
    }
  }

  // --- Rule 1: Rating Validation Bounds (Zod) ---
  await test('Rating Validation Bounds: Valid ratings (1 to 5) pass schema', async () => {
    for (const validStars of [1, 2, 3, 4, 5]) {
      const parsed = createReviewSchema.safeParse({
        transactionId: '11111111-1111-4111-8111-111111111111',
        ratingStars: validStars,
        reviewText: 'Great food!',
      });
      assert.equal(parsed.success, true, `Rating ${validStars} should be valid`);
    }
  });

  await test('Rating Validation Bounds: Invalid ratings (<1, >5, float, non-numeric) are rejected', async () => {
    const invalidInputs = [
      { ratingStars: 0, reason: 'Zero rating' },
      { ratingStars: 6, reason: 'Rating > 5' },
      { ratingStars: -1, reason: 'Negative rating' },
      { ratingStars: 3.5, reason: 'Floating point rating' },
      { ratingStars: 'five', reason: 'Non-numeric string' },
    ];

    for (const item of invalidInputs) {
      const parsed = createReviewSchema.safeParse({
        transactionId: '11111111-1111-4111-8111-111111111111',
        ratingStars: item.ratingStars,
      });
      assert.equal(parsed.success, false, `Expected rejection for: ${item.reason}`);
    }
  });

  await test('Rating Validation: Max length on reviewText (>2000 chars rejected)', async () => {
    const longText = 'a'.repeat(2001);
    const parsed = createReviewSchema.safeParse({
      transactionId: '11111111-1111-4111-8111-111111111111',
      ratingStars: 5,
      reviewText: longText,
    });
    assert.equal(parsed.success, false, 'reviewText over 2000 characters must fail schema validation');
  });

  // --- Rule 2: JWT Ownership & Security ---
  await test('JWT Ownership: Non-owner cannot review another user transaction (Returns 404 to avoid ID enumeration)', async () => {
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-1',
        user_id: 'legitimate-owner-uuid',
        merchant_id: 'merchant-uuid',
        status: 'SUCCESS',
        created_at: new Date(),
        reviews: null,
        merchants: { merchant_id: 'merchant-uuid', shop_name: 'ร้านส้มตำแซ่บ' },
      },
    });

    await assert.rejects(
      async () => {
        await createReview(
          'attacker-uuid', // Different from transaction.user_id
          {
            transactionId: 'tx-1',
            ratingStars: 5,
            reviewText: 'Malicious attempt',
          },
          mockPrisma,
          true
        );
      },
      (err: any) => {
        assert.ok(err instanceof ReviewServiceError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.message, 'ไม่พบข้อมูลธุรกรรมชำระเงินในระบบ');
        return true;
      }
    );
  });

  await test('JWT Ownership: Non-existent transaction returns 404', async () => {
    const mockPrisma = createMockPrisma({ transactionRecord: null });

    await assert.rejects(
      async () => {
        await createReview(
          'user-1',
          { transactionId: 'missing-tx', ratingStars: 4 },
          mockPrisma,
          true
        );
      },
      (err: any) => {
        assert.ok(err instanceof ReviewServiceError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  // --- Rule 3: Payment-First Eligibility (SUCCESS & FLAGGED Completed Payments) ---
  await test('Payment-First Eligibility: FLAGGED completed transaction within 24h of completed_at IS ALLOWED to review', async () => {
    const recentCompletedAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-flagged-completed',
        user_id: 'user-1',
        merchant_id: 'merchant-1',
        status: 'FLAGGED', // Payment completed, flagged internally by fraud system
        created_at: recentCompletedAt,
        completed_at: recentCompletedAt,
        reviews: null,
        merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านค้ากลุ่มเสี่ยง' },
      },
    });

    const result = await createReview(
      'user-1',
      { transactionId: 'tx-flagged-completed', ratingStars: 5, reviewText: 'จ่ายเงินสำเร็จแล้ว รีวิวได้ตามนโยบาย payment-first' },
      mockPrisma,
      true
    );
    assert.equal(result.isVerifiedPurchase, true);
    assert.equal(result.ratingStars, 5);
  });

  await test('Review Eligibility Check: FLAGGED completed transaction returns eligibilityStatus ELIGIBLE', async () => {
    const recentCompletedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const mockPrisma = {
      transactions: {
        findUnique: async () => ({
          transaction_id: 'tx-flagged-check',
          user_id: 'user-1',
          status: 'FLAGGED',
          created_at: recentCompletedAt,
          completed_at: recentCompletedAt,
          reviews: null,
        }),
      },
      reviews: {
        findUnique: async () => null,
      },
    };

    const result = await getReviewByTransactionId('user-1', 'tx-flagged-check', mockPrisma as any);
    assert.equal(result.reviewed, false);
    assert.equal(result.isEligible, true);
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
  });

  await test('Review Eligibility Check: SUCCESS completed transaction returns eligibilityStatus ELIGIBLE', async () => {
    const recentCompletedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const mockPrisma = {
      transactions: {
        findUnique: async () => ({
          transaction_id: 'tx-success-check',
          user_id: 'user-1',
          status: 'SUCCESS',
          created_at: recentCompletedAt,
          completed_at: recentCompletedAt,
          reviews: null,
        }),
      },
      reviews: {
        findUnique: async () => null,
      },
    };

    const result = await getReviewByTransactionId('user-1', 'tx-success-check', mockPrisma as any);
    assert.equal(result.reviewed, false);
    assert.equal(result.isEligible, true);
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
  });

  await test('Payment-First Eligibility: Unpaid transactions (completed_at is null) are rejected with 400', async () => {
    for (const status of ['PENDING', 'SUCCESS', 'FLAGGED']) {
      const mockPrisma = createMockPrisma({
        transactionRecord: {
          transaction_id: `tx-unpaid-${status.toLowerCase()}`,
          user_id: 'user-1',
          merchant_id: 'merchant-1',
          status,
          created_at: new Date(),
          completed_at: null, // Unpaid
          reviews: null,
          merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านป้าใจดี' },
        },
      });

      await assert.rejects(
        async () => {
          await createReview(
            'user-1',
            { transactionId: `tx-unpaid-${status.toLowerCase()}`, ratingStars: 4 },
            mockPrisma,
            true
          );
        },
        (err: any) => {
          assert.ok(err instanceof ReviewServiceError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'สามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ชำระเงินสำเร็จเท่านั้น');
          return true;
        }
      );
    }
  });

  await test('Transaction Status: Non-reviewable statuses (REJECTED, FAILED, CANCELLED) rejected with 400', async () => {
    for (const status of ['REJECTED', 'FAILED', 'CANCELLED']) {
      const mockPrisma = createMockPrisma({
        transactionRecord: {
          transaction_id: `tx-${status.toLowerCase()}`,
          user_id: 'user-1',
          merchant_id: 'merchant-1',
          status,
          created_at: new Date(),
          completed_at: new Date(),
          reviews: null,
          merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านป้าใจดี' },
        },
      });

      await assert.rejects(
        async () => {
          await createReview(
            'user-1',
            { transactionId: `tx-${status.toLowerCase()}`, ratingStars: 4 },
            mockPrisma,
            true
          );
        },
        (err: any) => {
          assert.ok(err instanceof ReviewServiceError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.message, 'สามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ชำระเงินสำเร็จเท่านั้น');
          return true;
        }
      );
    }
  });

  // --- Rule 4: 24-Hour Review Window from transactions.completed_at ---
  await test('Review Window: Payment completed within 24 hours of completed_at is accepted', async () => {
    const recentCompletedAt = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23 hours ago
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-23h',
        user_id: 'user-1',
        merchant_id: 'merchant-1',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 30 * 60 * 60 * 1000), // created earlier
        completed_at: recentCompletedAt, // paid 23 hours ago
        reviews: null,
        merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านป้าใจดี' },
      },
    });

    const result = await createReview(
      'user-1',
      { transactionId: 'tx-23h', ratingStars: 5, reviewText: 'ชำระเงินไม่เกิน 24 ชม.' },
      mockPrisma,
      true
    );
    assert.equal(result.isVerifiedPurchase, true);
    assert.equal(result.ratingStars, 5);
  });

  await test('Review Window: Payment completed >24 hours ago is rejected with 400', async () => {
    const expiredCompletedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-expired',
        user_id: 'user-1',
        merchant_id: 'merchant-1',
        status: 'SUCCESS',
        created_at: expiredCompletedAt,
        completed_at: expiredCompletedAt,
        reviews: null,
        merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านป้าใจดี' },
      },
    });

    await assert.rejects(
      async () => {
        await createReview(
          'user-1',
          { transactionId: 'tx-expired', ratingStars: 5 },
          mockPrisma,
          true
        );
      },
      (err: any) => {
        assert.ok(err instanceof ReviewServiceError);
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /สิทธิ์การประเมินรีวิวหมดอายุแล้ว/);
        return true;
      }
    );
  });

  await test('Review Window: getReviewByTransactionId returns EXPIRED when completed_at > 24 hours ago', async () => {
    const expiredCompletedAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const mockPrisma = {
      transactions: {
        findUnique: async () => ({
          transaction_id: 'tx-expired-check',
          user_id: 'user-1',
          status: 'SUCCESS',
          created_at: expiredCompletedAt,
          completed_at: expiredCompletedAt,
          reviews: null,
        }),
      },
      reviews: {
        findUnique: async () => null,
      },
    };

    const result = await getReviewByTransactionId('user-1', 'tx-expired-check', mockPrisma as any);
    assert.equal(result.reviewed, false);
    assert.equal(result.isEligible, false);
    assert.equal(result.eligibilityStatus, 'EXPIRED');
  });

  await test('Privacy & Anti-Fraud: Public review endpoints do not expose fraud metadata', async () => {
    const mockPrisma = {
      merchants: {
        findUnique: async () => ({
          merchant_id: 'm-safe',
          shop_name: 'ร้านค้าปลอดภัย',
          average_rating_stars: 5.0,
        }),
      },
      reviews: {
        findMany: async (args: any) => {
          if (args.select?.rating_stars) return [{ rating_stars: 5 }];
          return [
            {
              review_id: 'rev-safe-1',
              rating_stars: 5,
              review_text: 'ปลอดภัย มั่นใจ',
              is_verified_purchase: true,
              is_anonymous: false,
              created_at: new Date('2026-10-28T10:00:00.000Z'),
              users: { full_name: 'ธนากร มั่นคง' },
            },
          ];
        },
      },
    };

    const result = await getMerchantReviews('m-safe', 1, 10, mockPrisma);
    assert.equal(result.reviews.length, 1);
    const review = result.reviews[0] as any;
    assert.equal(review.riskScore, undefined, 'riskScore must not be exposed');
    assert.equal(review.fraudReason, undefined, 'fraudReason must not be exposed');
    assert.equal(review.fraudDecision, undefined, 'fraudDecision must not be exposed');
    assert.equal(review.fraudCheck, undefined, 'fraudCheck must not be exposed');
  });

  // --- Rule 5: Duplicate Review Prevention ---
  await test('Duplicate Prevention: Pre-check rejects already reviewed transaction with 409', async () => {
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-reviewed',
        user_id: 'user-1',
        merchant_id: 'merchant-1',
        status: 'SUCCESS',
        created_at: new Date(),
        reviews: { review_id: 'existing-rev-1' }, // Already reviewed
        merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านป้าใจดี' },
      },
    });

    await assert.rejects(
      async () => {
        await createReview(
          'user-1',
          { transactionId: 'tx-reviewed', ratingStars: 5 },
          mockPrisma,
          true
        );
      },
      (err: any) => {
        assert.ok(err instanceof ReviewServiceError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.message, 'ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว');
        return true;
      }
    );
  });

  await test('Duplicate Prevention & Concurrency: DB P2002 Unique Constraint caught and converted to 409', async () => {
    const p2002Error: any = new Error('Unique constraint failed on the fields: (transaction_id)');
    p2002Error.code = 'P2002';

    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-concurrent',
        user_id: 'user-1',
        merchant_id: 'merchant-1',
        status: 'SUCCESS',
        created_at: new Date(),
        reviews: null, // Passed initial pre-check in race condition
        merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านป้าใจดี' },
      },
      transactionThrows: p2002Error,
    });

    await assert.rejects(
      async () => {
        await createReview(
          'user-1',
          { transactionId: 'tx-concurrent', ratingStars: 4 },
          mockPrisma,
          true
        );
      },
      (err: any) => {
        assert.ok(err instanceof ReviewServiceError);
        assert.equal(err.statusCode, 409);
        assert.equal(err.message, 'ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว');
        return true;
      }
    );
  });

  // --- Rule 6: Merchant Rating Calculation, Row Lock, and Transaction Atomicity ---
  await test('Successful Review: Row-level lock executed, average rating calculated & rounded to 1 decimal place', async () => {
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-success-1',
        user_id: 'user-1',
        merchant_id: 'm-999',
        status: 'SUCCESS',
        created_at: new Date(),
        reviews: null,
        merchants: { merchant_id: 'm-999', shop_name: 'ก๋วยเตี๋ยวเรืออยุธยา' },
      },
      aggregateResult: {
        _avg: { rating_stars: 4.33333333 }, // 13 / 3 = 4.3333...
        _count: { rating_stars: 3 },
      },
    });

    const result = await createReview(
      'user-1',
      {
        transactionId: 'tx-success-1',
        ratingStars: 4,
        reviewText: 'อร่อย สะอาด บริการดี',
      },
      mockPrisma,
      true
    );

    // Verify row-level lock query was issued
    assert.equal(mockPrisma.queryRawCalled, true, 'Row-level FOR UPDATE query must be called');

    // Verify rating rounded to 1 decimal place (4.33333 -> 4.3)
    assert.equal(result.newMerchantAverageRating, 4.3);
    assert.equal(result.totalMerchantReviews, 3);
    assert.equal(mockPrisma.merchantUpdatedWith?.average_rating_stars, 4.3);

    // Verify returned payload
    assert.equal(result.merchantName, 'ก๋วยเตี๋ยวเรืออยุธยา');
    assert.equal(result.isVerifiedPurchase, true);
    assert.equal(result.reviewText, 'อร่อย สะอาด บริการดี');
  });

  await test('Transaction Rollback Simulation: Error during review creation aborts transaction without updating merchant rating', async () => {
    const dbCrashError = new Error('Simulated Database Connection Failure');
    const mockPrisma = createMockPrisma({
      transactionRecord: {
        transaction_id: 'tx-rollback',
        user_id: 'user-1',
        merchant_id: 'm-999',
        status: 'SUCCESS',
        created_at: new Date(),
        reviews: null,
        merchants: { merchant_id: 'm-999', shop_name: 'ก๋วยเตี๋ยวเรืออยุธยา' },
      },
      transactionThrows: dbCrashError,
    });

    await assert.rejects(
      async () => {
        await createReview(
          'user-1',
          { transactionId: 'tx-rollback', ratingStars: 5 },
          mockPrisma,
          true
        );
      },
      (err: any) => {
        assert.equal(err.message, 'Simulated Database Connection Failure');
        return true;
      }
    );

    // Verify that merchant average rating was NOT updated due to rollback
    assert.equal(mockPrisma.merchantUpdatedWith, null, 'Merchant rating must NOT update if review creation failed');
  });

  // --- Rule 7: Privacy & Public Merchant Reviews Query ---
  await test('Privacy Masking: Reviewer full names masked according to PDPA standards', async () => {
    const mockPrisma = {
      merchants: {
        findUnique: async () => ({
          merchant_id: 'm-1',
          shop_name: 'ร้านข้าวมันไก่',
          average_rating_stars: 4.5,
        }),
      },
      reviews: {
        findMany: async (args: any) => {
          if (args.select?.rating_stars) {
            return [{ rating_stars: 5 }, { rating_stars: 4 }];
          }
          return [
            {
              review_id: 'rev-1',
              rating_stars: 5,
              review_text: 'ยอดเยี่ยมมาก',
              is_verified_purchase: true,
              created_at: new Date('2026-10-28T08:00:00.000Z'),
              users: { full_name: 'สมชาย ใจดีมาก' },
            },
            {
              review_id: 'rev-2',
              rating_stars: 4,
              review_text: 'อร่อยดี',
              is_verified_purchase: true,
              created_at: new Date('2026-10-28T09:00:00.000Z'),
              users: { full_name: 'Johnathan' },
            },
          ];
        },
      },
    };

    const res = await getMerchantReviews('m-1', 1, 10, mockPrisma);
    assert.equal(res.merchant.shopName, 'ร้านข้าวมันไก่');
    assert.equal(res.reviews.length, 2);
    // Two-word Thai name: 'สมชาย ใ***'
    assert.equal(res.reviews[0].reviewerName, 'สมชาย ใ***');
    // Single word name: 'Jo***'
    assert.equal(res.reviews[1].reviewerName, 'Jo***');
  });

  // --- Rule 8: Anonymity Preference ('ไม่แสดงชื่อของฉันในรีวิว') ---
  await test('Anonymity Preference: isAnonymous schema defaults to false, accepts true/false', async () => {
    const defaultParsed = createReviewSchema.safeParse({
      transactionId: '11111111-1111-4111-8111-111111111111',
      ratingStars: 5,
    });
    assert.equal(defaultParsed.success, true);
    assert.equal((defaultParsed as any).data.isAnonymous, false, 'Default should be false');

    const anonParsed = createReviewSchema.safeParse({
      transactionId: '11111111-1111-4111-8111-111111111111',
      ratingStars: 5,
      isAnonymous: true,
    });
    assert.equal(anonParsed.success, true);
    assert.equal((anonParsed as any).data.isAnonymous, true);
  });

  await test('Anonymity Preference: createReview stores user_id for ownership and records is_anonymous: true', async () => {
    let capturedReviewData: any = null;
    const mockPrisma = {
      transactions: {
        findUnique: async () => ({
          transaction_id: 'tx-anon-1',
          user_id: 'internal-user-uuid-99',
          merchant_id: 'merchant-1',
          status: 'SUCCESS',
          created_at: new Date(),
          completed_at: new Date(),
          reviews: null,
          merchants: { merchant_id: 'merchant-1', shop_name: 'ร้านข้าวมันไก่' },
        }),
      },
      $transaction: async (cb: any) => {
        return cb({
          $queryRaw: async () => [],
          reviews: {
            create: async ({ data }: any) => {
              capturedReviewData = data;
              return {
                review_id: 'rev-anon-1',
                created_at: new Date(),
                ...data,
              };
            },
            aggregate: async () => ({
              _avg: { rating_stars: 5 },
              _count: { rating_stars: 1 },
            }),
          },
          merchants: {
            update: async () => ({}),
          },
        });
      },
    };

    const res = await createReview(
      'internal-user-uuid-99',
      {
        transactionId: 'tx-anon-1',
        ratingStars: 5,
        reviewText: 'อร่อยมากแต่ไม่อยากให้ใครเห็นชื่อ',
        isAnonymous: true,
      },
      mockPrisma,
      true
    );

    // Verify user_id is preserved for ownership and security
    assert.equal(capturedReviewData.user_id, 'internal-user-uuid-99', 'Internal user_id must be preserved');
    assert.equal(capturedReviewData.is_anonymous, true, 'is_anonymous must be persisted as true');
    assert.equal(res.isAnonymous, true);
  });

  await test('Anonymity Preference: Public merchant reviews displays "ผู้ใช้งานไม่ประสงค์ออกนาม" when is_anonymous is true', async () => {
    const mockPrisma = {
      merchants: {
        findUnique: async () => ({
          merchant_id: 'm-1',
          shop_name: 'ร้านข้าวมันไก่',
          average_rating_stars: 4.8,
        }),
      },
      reviews: {
        findMany: async (args: any) => {
          if (args.select?.rating_stars) {
            return [{ rating_stars: 5 }, { rating_stars: 4 }];
          }
          return [
            {
              review_id: 'rev-anon-true',
              rating_stars: 5,
              review_text: 'ยอดเยี่ยมมาก',
              is_verified_purchase: true,
              is_anonymous: true,
              created_at: new Date('2026-10-28T08:00:00.000Z'),
              users: { full_name: 'สมศรี มณีวรรณ' },
            },
            {
              review_id: 'rev-anon-false',
              rating_stars: 4,
              review_text: 'รสชาติดี',
              is_verified_purchase: true,
              is_anonymous: false,
              created_at: new Date('2026-10-28T09:00:00.000Z'),
              users: { full_name: 'สมชาย สุขเกษม' },
            },
          ];
        },
      },
    };

    const res = await getMerchantReviews('m-1', 1, 10, mockPrisma);
    assert.equal(res.reviews.length, 2);
    // When is_anonymous is true -> "ผู้ใช้งานไม่ประสงค์ออกนาม"
    assert.equal(
      res.reviews[0].reviewerName,
      'ผู้ใช้งานไม่ประสงค์ออกนาม',
      'Should display ผู้ใช้งานไม่ประสงค์ออกนาม when is_anonymous is true'
    );
    // When is_anonymous is false -> standard maskName "สมชาย ส***"
    assert.equal(
      res.reviews[1].reviewerName,
      'สมชาย ส***',
      'Should display masked name when is_anonymous is false'
    );
  });

  // --- Summary ---
  console.log('\n============================================================');
  console.log(`📊 TEST EXECUTION SUMMARY:`);
  console.log(`   Total Tests:  ${passedCount + failedCount}`);
  console.log(`   Passed:       ${passedCount}`);
  console.log(`   Failed:       ${failedCount}`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runReviewAuditTests().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
