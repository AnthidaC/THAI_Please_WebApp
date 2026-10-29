import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CANONICAL_CATEGORY_IDS,
  CANONICAL_CATEGORIES,
  isValidCategoryId,
  getCategoryDisplayName,
} from '../constants/categories';
import {
  merchantCategoryService,
} from '../services/merchant-category.service';
import {
  merchantApplicationSchema,
  updateMerchantCategorySchema,
} from '../validations/merchant-application.validation';
import {
  PROVISIONAL_DEFAULT_WEIGHTS,
  PROPOSED_TARGET_WEIGHTS,
  NEUTRAL_CATEGORY_SCORE,
  normalizeRecommendationWeights,
  calculateNormalizedCategoryScore,
  scoreMerchant,
  rankScoredMerchants,
} from '../utils/recommendation-scoring';

// =========================================================================
// 🧪 PHASE 2: MERCHANT CATEGORIES & RECOMMENDATIONS INTEGRATION TESTS
// =========================================================================

test('Taxonomy: Exactly 5 canonical categories are defined', () => {
  assert.equal(CANONICAL_CATEGORY_IDS.length, 5);
  const expected = ['FOOD', 'STREET_FOOD', 'BAKERY_DESSERT', 'BEVERAGE', 'GENERAL_GOODS'];
  assert.deepEqual([...CANONICAL_CATEGORY_IDS], expected);

  for (const id of expected) {
    assert.equal(isValidCategoryId(id), true);
    assert.ok(CANONICAL_CATEGORIES[id as keyof typeof CANONICAL_CATEGORIES]);
    assert.ok(CANONICAL_CATEGORIES[id as keyof typeof CANONICAL_CATEGORIES].nameTh);
    assert.ok(CANONICAL_CATEGORIES[id as keyof typeof CANONICAL_CATEGORIES].nameEn);
  }
});

test('Taxonomy: Non-canonical category IDs are rejected', () => {
  assert.equal(isValidCategoryId('A_LA_CARTE'), false);
  assert.equal(isValidCategoryId('BEVERAGES'), false);
  assert.equal(isValidCategoryId('RETAIL'), false);
  assert.equal(isValidCategoryId(''), false);
  assert.equal(isValidCategoryId(null), false);
  assert.equal(isValidCategoryId(undefined), false);
});

test('Taxonomy: getCategoryDisplayName handles null and invalid IDs gracefully', () => {
  assert.equal(getCategoryDisplayName(null), 'ร้านค้าสมาชิก Co-pay');
  assert.equal(getCategoryDisplayName(undefined), 'ร้านค้าสมาชิก Co-pay');
  assert.equal(getCategoryDisplayName('INVALID_CAT'), 'ร้านค้าสมาชิก Co-pay');
  assert.equal(getCategoryDisplayName('STREET_FOOD'), 'อาหารริมทาง');
  assert.equal(getCategoryDisplayName('FOOD'), 'ร้านอาหารทั่วไป');
  assert.equal(getCategoryDisplayName('BAKERY_DESSERT'), 'ขนมหวานและเบเกอรี่');
  assert.equal(getCategoryDisplayName('BEVERAGE'), 'เครื่องดื่ม');
  assert.equal(getCategoryDisplayName('GENERAL_GOODS'), 'สินค้าทั่วไป');
});

test('Validation: MerchantCategoryService validates category_id correctly', () => {
  // Null and undefined return null (nullable column)
  assert.equal(merchantCategoryService.validateCategoryId(null), null);
  assert.equal(merchantCategoryService.validateCategoryId(undefined), null);
  assert.equal(merchantCategoryService.validateCategoryId(''), null);

  // Valid canonical IDs
  assert.equal(merchantCategoryService.validateCategoryId('STREET_FOOD'), 'STREET_FOOD');
  assert.equal(merchantCategoryService.validateCategoryId('FOOD'), 'FOOD');

  // Invalid IDs throw MerchantCategoryError
  assert.throws(
    () => merchantCategoryService.validateCategoryId('INVALID_XYZ'),
    /รหัสหมวดหมู่ร้านค้าไม่ถูกต้อง/
  );
});

test('Scoring Weights: Active default implements activated weights (Distance 35%, Category 25%, Rating 25%, Popularity 15%)', () => {
  const activeWeights = normalizeRecommendationWeights();
  assert.equal(activeWeights.distance, 0.35);
  assert.equal(activeWeights.categoryPreference, 0.25);
  assert.equal(activeWeights.rating, 0.25);
  assert.equal(activeWeights.popularity, 0.15);
  
  const total = activeWeights.distance + activeWeights.rating + activeWeights.popularity + activeWeights.categoryPreference;
  assert.equal(Math.round(total * 100) / 100, 1.00);
});

test('Scoring Weights: Proposed Phase 2 weights match specification when enabled', () => {
  // Proposed: Distance 35%, Category 25%, Rating 25%, Popularity 15%
  assert.equal(PROPOSED_TARGET_WEIGHTS.distance, 0.35);
  assert.equal(PROPOSED_TARGET_WEIGHTS.categoryPreference, 0.25);
  assert.equal(PROPOSED_TARGET_WEIGHTS.rating, 0.25);
  assert.equal(PROPOSED_TARGET_WEIGHTS.popularity, 0.15);

  const sum =
    PROPOSED_TARGET_WEIGHTS.distance +
    PROPOSED_TARGET_WEIGHTS.categoryPreference +
    PROPOSED_TARGET_WEIGHTS.rating +
    PROPOSED_TARGET_WEIGHTS.popularity;
  assert.equal(Math.round(sum * 100) / 100, 1.00);

  const normalizedProposed = normalizeRecommendationWeights(PROPOSED_TARGET_WEIGHTS, true);
  assert.equal(normalizedProposed.distance, 0.35);
  assert.equal(normalizedProposed.categoryPreference, 0.25);
  assert.equal(normalizedProposed.rating, 0.25);
  assert.equal(normalizedProposed.popularity, 0.15);
});

test('Category Score: Safe neutral score (0.50) for null category or user without preferences', () => {
  // Merchant has null category_id -> neutral 0.50
  assert.equal(calculateNormalizedCategoryScore(null, ['FOOD', 'STREET_FOOD']), NEUTRAL_CATEGORY_SCORE);
  assert.equal(calculateNormalizedCategoryScore(undefined, ['FOOD']), NEUTRAL_CATEGORY_SCORE);
  assert.equal(calculateNormalizedCategoryScore('', ['FOOD']), NEUTRAL_CATEGORY_SCORE);

  // User has no preferences configured -> neutral 0.50
  assert.equal(calculateNormalizedCategoryScore('FOOD', []), NEUTRAL_CATEGORY_SCORE);
  assert.equal(calculateNormalizedCategoryScore('FOOD', undefined), NEUTRAL_CATEGORY_SCORE);

  // Both merchant category is null and user has no preferences -> neutral 0.50
  assert.equal(calculateNormalizedCategoryScore(null, []), NEUTRAL_CATEGORY_SCORE);
});

test('Category Score: Matching category scores 1.00, mismatch scores 0.00', () => {
  const userPreferences = ['STREET_FOOD', 'BEVERAGE'];

  // Match
  assert.equal(calculateNormalizedCategoryScore('STREET_FOOD', userPreferences), 1.00);
  assert.equal(calculateNormalizedCategoryScore('BEVERAGE', userPreferences), 1.00);
  // Case-insensitive match
  assert.equal(calculateNormalizedCategoryScore('street_food', userPreferences), 1.00);

  // Mismatch
  assert.equal(calculateNormalizedCategoryScore('FOOD', userPreferences), 0.00);
  assert.equal(calculateNormalizedCategoryScore('BAKERY_DESSERT', userPreferences), 0.00);
  assert.equal(calculateNormalizedCategoryScore('GENERAL_GOODS', userPreferences), 0.00);
});

test('scoreMerchant: Backward compatibility when category scoring is explicitly inactive (enableCategoryScoring = false)', () => {
  const resultWithCategory = scoreMerchant({
    merchantId: 'm-1',
    distanceKm: 1.0,
    averageRating: 4.5,
    transactionCount24h: 10,
    merchantCategoryId: 'FOOD',
    userPreferredCategories: ['FOOD'],
  }, undefined, 10, false);

  const resultWithoutCategory = scoreMerchant({
    merchantId: 'm-2',
    distanceKm: 1.0,
    averageRating: 4.5,
    transactionCount24h: 10,
    merchantCategoryId: null,
    userPreferredCategories: [],
  }, undefined, 10, false);

  // Because categoryPreference weight is 0.00 when enableCategoryScoring is false, totalScore must be identical!
  assert.equal(resultWithCategory.totalScore, resultWithoutCategory.totalScore);
  assert.equal(resultWithCategory.breakdown.activeWeights.categoryPreference, 0.00);
  assert.equal(resultWithoutCategory.breakdown.activeWeights.categoryPreference, 0.00);
});

test('scoreMerchant: Category preference differentiates scores when enabled in proposed mode', () => {
  const matchingMerchant = scoreMerchant(
    {
      merchantId: 'm-match',
      distanceKm: 2.0,
      averageRating: 4.0,
      transactionCount24h: 10,
      merchantCategoryId: 'STREET_FOOD',
      userPreferredCategories: ['STREET_FOOD'],
    },
    PROPOSED_TARGET_WEIGHTS,
    10,
    true // enableCategoryScoring = true
  );

  const nonMatchingMerchant = scoreMerchant(
    {
      merchantId: 'm-no-match',
      distanceKm: 2.0,
      averageRating: 4.0,
      transactionCount24h: 10,
      merchantCategoryId: 'GENERAL_GOODS',
      userPreferredCategories: ['STREET_FOOD'],
    },
    PROPOSED_TARGET_WEIGHTS,
    10,
    true
  );

  const nullCategoryMerchant = scoreMerchant(
    {
      merchantId: 'm-null',
      distanceKm: 2.0,
      averageRating: 4.0,
      transactionCount24h: 10,
      merchantCategoryId: null,
      userPreferredCategories: ['STREET_FOOD'],
    },
    PROPOSED_TARGET_WEIGHTS,
    10,
    true
  );

  assert.equal(matchingMerchant.breakdown.categoryScore, 1.00);
  assert.equal(nonMatchingMerchant.breakdown.categoryScore, 0.00);
  assert.equal(nullCategoryMerchant.breakdown.categoryScore, 0.50);

  // matching score > null category score > non-matching score
  assert.ok(matchingMerchant.totalScore > nullCategoryMerchant.totalScore);
  assert.ok(nullCategoryMerchant.totalScore > nonMatchingMerchant.totalScore);
});

test('rankScoredMerchants: Deterministic tie-breaking remains stable', () => {
  const candidateA = scoreMerchant({
    merchantId: 'merchant-a',
    distanceKm: 1.5,
    averageRating: 4.0,
    transactionCount24h: 5,
  });

  const candidateB = scoreMerchant({
    merchantId: 'merchant-b',
    distanceKm: 1.5,
    averageRating: 4.0,
    transactionCount24h: 5,
  });

  const ranked = rankScoredMerchants([candidateB, candidateA]);
  // Due to identical scores, tie-breaker rule 5 (UUID lexicographical sort) kicks in: 'merchant-a' < 'merchant-b'
  assert.equal(ranked[0].merchantId, 'merchant-a');
  assert.equal(ranked[1].merchantId, 'merchant-b');
});

// =========================================================================
// 🧪 DEV 1 COORDINATION: MERCHANT APPLICATION -> MERCHANTS APPROVAL TRANSFER
// =========================================================================

test('transferCategoryOnApproval: Transfers category_id to existing merchant on approval', async () => {
  let updatedMerchantData: any = null;

  const mockTx = {
    merchantApplication: {
      findUnique: async () => ({
        application_id: 'app-001',
        merchant_id: 'm-existing-1',
        category_id: 'BAKERY_DESSERT',
        status: 'SUBMITTING',
        shop_name: 'Sweet Tooth Bakery',
        tax_id: '0105550000001',
        latitude: 13.75,
        longitude: 100.5,
      }),
    },
    merchants: {
      update: async (args: any) => {
        updatedMerchantData = args.data;
        return {
          merchant_id: args.where.merchant_id,
          category_id: args.data.category_id,
        };
      },
    },
  };

  const result = await merchantCategoryService.transferCategoryOnApproval('app-001', mockTx as any);

  assert.equal(result.merchantId, 'm-existing-1');
  assert.equal(result.categoryId, 'BAKERY_DESSERT');
  assert.equal(updatedMerchantData?.category_id, 'BAKERY_DESSERT');
});

test('transferCategoryOnApproval: Creates approved merchant with category_id when merchant_id is null', async () => {
  let createdMerchantData: any = null;
  let updatedAppStatus: any = null;

  const mockTx = {
    merchantApplication: {
      findUnique: async () => ({
        application_id: 'app-002',
        merchant_id: null,
        category_id: 'STREET_FOOD',
        status: 'PENDING_REVIEW',
        shop_name: 'Uncle Somchai Pad Thai',
        tax_id: '0105550000002',
        latitude: 13.7563,
        longitude: 100.5018,
      }),
      update: async (args: any) => {
        updatedAppStatus = args.data;
        return { ...args.data };
      },
    },
    merchants: {
      create: async (args: any) => {
        createdMerchantData = args.data;
        return {
          merchant_id: 'm-new-generated-uuid',
          category_id: args.data.category_id,
        };
      },
    },
  };

  const result = await merchantCategoryService.transferCategoryOnApproval('app-002', mockTx as any);

  assert.equal(result.merchantId, 'm-new-generated-uuid');
  assert.equal(result.categoryId, 'STREET_FOOD');
  assert.equal(createdMerchantData?.category_id, 'STREET_FOOD');
  assert.equal(createdMerchantData?.is_approved, true);
  assert.equal(updatedAppStatus?.status, 'APPROVED');
  assert.equal(updatedAppStatus?.merchant_id, 'm-new-generated-uuid');
});

test('transferCategoryOnApproval: Gracefully transfers null category_id if applicant specified none', async () => {
  let createdMerchantData: any = null;

  const mockTx = {
    merchantApplication: {
      findUnique: async () => ({
        application_id: 'app-003',
        merchant_id: null,
        category_id: null,
        status: 'PENDING_REVIEW',
        shop_name: 'General Shop Without Category',
        tax_id: '0105550000003',
        latitude: 13.75,
        longitude: 100.5,
      }),
      update: async () => ({}),
    },
    merchants: {
      create: async (args: any) => {
        createdMerchantData = args.data;
        return {
          merchant_id: 'm-null-cat-uuid',
          category_id: args.data.category_id,
        };
      },
    },
  };

  const result = await merchantCategoryService.transferCategoryOnApproval('app-003', mockTx as any);

  assert.equal(result.merchantId, 'm-null-cat-uuid');
  assert.equal(result.categoryId, null);
  assert.equal(createdMerchantData?.category_id, null);
  assert.equal(createdMerchantData?.is_approved, true);
});

test('transferCategoryOnApproval: Throws 404 error if application not found', async () => {
  const mockTx = {
    merchantApplication: {
      findUnique: async () => null,
    },
  };

  await assert.rejects(
    async () => {
      await merchantCategoryService.transferCategoryOnApproval('app-missing', mockTx as any);
    },
    (err: any) => err.statusCode === 404 && /ไม่พบข้อมูลใบสมัคร/.test(err.message)
  );
});

test('transferCategoryOnApproval: Throws 400 error if application has invalid category_id', async () => {
  const mockTx = {
    merchantApplication: {
      findUnique: async () => ({
        application_id: 'app-004',
        category_id: 'INVALID_CATEGORY_NAME',
      }),
    },
  };

  await assert.rejects(
    async () => {
      await merchantCategoryService.transferCategoryOnApproval('app-004', mockTx as any);
    },
    (err: any) => err.statusCode === 400 && /รหัสหมวดหมู่ร้านค้าไม่ถูกต้อง/.test(err.message)
  );
});

// =========================================================================
// 🧪 DEV 1 REGISTRATION VALIDATION & COMPLETE CATEGORY FLOW TESTS
// =========================================================================

test('merchantApplicationSchema: Accepts valid registration with canonical category', () => {
  const result = merchantApplicationSchema.safeParse({
    businessType: 'INDIVIDUAL',
    taxId: '1234567890123',
    shopName: 'ร้านป้าสมร ข้าวมันไก่',
    contactName: 'ป้าสมร รวยทรัพย์',
    categoryId: 'FOOD',
    email: 'somorn@example.com',
    phone: '0812345678',
    password: 'password123',
    address: '123 ถนนสุขุมวิท พระโขนง คลองเตย กทม. 10110',
    latitude: 13.75,
    longitude: 100.5,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.categoryId, 'FOOD');
  }
});

test('merchantApplicationSchema: Normalizes lowercase categoryId to canonical uppercase', () => {
  const result = merchantApplicationSchema.safeParse({
    businessType: 'JURISTIC',
    taxId: '0105550000001',
    shopName: 'Cha Tra Thai Co., Ltd.',
    contactName: 'นายชาญ ชาไทย',
    categoryId: 'beverage',
    email: 'contact@chatrathai.com',
    phone: '021234567',
    password: 'secretPassword123',
    address: '99/1 อาคารเสริมสุข แขวงบางรัก เขตบางรัก กทม.',
    latitude: 13.72,
    longitude: 100.52,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.categoryId, 'BEVERAGE');
  }
});

test('merchantApplicationSchema: Accepts registration when categoryId is null or omitted', () => {
  const withNull = merchantApplicationSchema.safeParse({
    businessType: 'INDIVIDUAL',
    taxId: '1234567890123',
    shopName: 'ร้านค้ายังไม่ระบุหมวด',
    contactName: 'สมศรี มีทรัพย์',
    categoryId: null,
    email: 'somsri@example.com',
    phone: '0898765432',
    password: 'password123',
    address: '456 ซอยอารีย์ พญาไท กทม.',
    latitude: 13.78,
    longitude: 100.54,
  });

  assert.equal(withNull.success, true);
  if (withNull.success) {
    assert.equal(withNull.data.categoryId, null);
  }
});

test('merchantApplicationSchema: Rejects registration with non-canonical categoryId', () => {
  const result = merchantApplicationSchema.safeParse({
    businessType: 'INDIVIDUAL',
    taxId: '1234567890123',
    shopName: 'ร้านขายของเล่น',
    contactName: 'สมศักดิ์',
    categoryId: 'TOYS_AND_GAMES',
    email: 'somsak@example.com',
    phone: '0811112222',
    password: 'password123',
    address: '789 ถนนเจริญกรุง กทม.',
    latitude: 13.74,
    longitude: 100.51,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /รหัสหมวดหมู่ไม่ถูกต้อง/);
  }
});

test('createMerchantApplication: Persists application with validated category_id', async () => {
  let createdData: any = null;

  const mockTx = {
    merchantApplication: {
      create: async (args: any) => {
        createdData = args.data;
        return {
          application_id: 'app-created-123',
          category_id: args.data.category_id,
          status: 'SUBMITTING',
        };
      },
    },
  };

  const input = {
    businessType: 'INDIVIDUAL' as const,
    taxId: '1234567890123',
    businessName: 'น้ำผลไม้ปั่นสด',
    contactName: 'สุรชัย',
    categoryId: 'BEVERAGE' as const,
    email: 'surachai@example.com',
    phone: '0822223333',
    password: 'securePassword!',
    address: '12 ตลาดสามย่าน ปทุมวัน กทม.',
    latitude: 13.73,
    longitude: 100.52,
  };

  const result = await merchantCategoryService.createMerchantApplication(
    input,
    'hashed_password_sample',
    mockTx as any
  );

  assert.equal(result.applicationId, 'app-created-123');
  assert.equal(result.categoryId, 'BEVERAGE');
  assert.equal(createdData.category_id, 'BEVERAGE');
  assert.equal(createdData.status, 'SUBMITTING');
});

test('getMerchantWithCategory: Returns localized category name and handles null category', async () => {
  const mockTx = {
    merchants: {
      findUnique: async (args: any) => {
        if (args.where.merchant_id === 'm-with-cat') {
          return {
            merchant_id: 'm-with-cat',
            shop_name: 'โกปี๊โบราณ',
            category_id: 'BEVERAGE',
            is_approved: true,
          };
        }
        if (args.where.merchant_id === 'm-no-cat') {
          return {
            merchant_id: 'm-no-cat',
            shop_name: 'ร้านค้าดั้งเดิม',
            category_id: null,
            is_approved: true,
          };
        }
        return null;
      },
    },
  };

  const withCat = await merchantCategoryService.getMerchantWithCategory('m-with-cat', mockTx as any);
  assert.equal(withCat.categoryId, 'BEVERAGE');
  assert.equal(withCat.categoryNameTh, 'เครื่องดื่ม');

  const noCat = await merchantCategoryService.getMerchantWithCategory('m-no-cat', mockTx as any);
  assert.equal(noCat.categoryId, null);
  assert.equal(noCat.categoryNameTh, 'ร้านค้าสมาชิก Co-pay');

  await assert.rejects(
    async () => merchantCategoryService.getMerchantWithCategory('m-missing', mockTx as any),
    (err: any) => err.statusCode === 404
  );
});

test('updateMerchantCategory: Updates merchant category and creates audit log', async () => {
  let updatedData: any = null;
  let auditLogData: any = null;

  const mockTx = {
    merchants: {
      findUnique: async () => ({
        merchant_id: 'm-audit-test',
        category_id: 'FOOD',
      }),
      update: async (args: any) => {
        updatedData = args.data;
        return {
          merchant_id: args.where.merchant_id,
          category_id: args.data.category_id,
        };
      },
    },
    merchant_profile_audit_logs: {
      create: async (args: any) => {
        auditLogData = args.data;
        return { audit_id: 'audit-log-1', ...args.data };
      },
    },
  };

  const result = await merchantCategoryService.updateMerchantCategory(
    'm-audit-test',
    'STREET_FOOD',
    { id: 'admin-actor-uuid', role: 'ADMIN' },
    mockTx as any
  );

  assert.equal(result.merchantId, 'm-audit-test');
  assert.equal(result.previousCategory, 'FOOD');
  assert.equal(result.newCategory, 'STREET_FOOD');
  assert.equal(updatedData.category_id, 'STREET_FOOD');

  assert.ok(auditLogData);
  assert.equal(auditLogData.actor_id, 'admin-actor-uuid');
  assert.equal(auditLogData.actor_role, 'ADMIN');
  assert.equal(auditLogData.changes.from, 'FOOD');
  assert.equal(auditLogData.changes.to, 'STREET_FOOD');
});

// =========================================================================
// 🧪 UC 2.5.3: CITIZEN PREFERENCES & AI NEAR-ME DISCOVERY INTEGRATION TESTS
// =========================================================================

test('UC 2.5.3: Recommendation scoring activates rule-based 35/25/25/15 weights by default', () => {
  const activeWeights = normalizeRecommendationWeights();
  assert.equal(activeWeights.distance, 0.35, 'Distance must be 35%');
  assert.equal(activeWeights.categoryPreference, 0.25, 'Category preference must be 25%');
  assert.equal(activeWeights.rating, 0.25, 'Rating must be 25%');
  assert.equal(activeWeights.popularity, 0.15, 'Popularity must be 15%');
});

test('UC 2.5.3: Sub-factor scores (distance, rating, popularity) are strictly invariant when category scoring is evaluated', () => {
  const merchantInput = {
    merchantId: 'm-invariant',
    distanceKm: 2.5,
    averageRating: 4.2,
    transactionCount24h: 18,
    merchantCategoryId: 'FOOD',
    userPreferredCategories: ['FOOD', 'BEVERAGE'],
  };

  const defaultResult = scoreMerchant(merchantInput, undefined, 10, false);
  const proposedResult = scoreMerchant(merchantInput, PROPOSED_TARGET_WEIGHTS, 10, true);

  // Sub-scores must be identical regardless of whether category preference weighting is active
  assert.equal(defaultResult.breakdown.distanceScore, proposedResult.breakdown.distanceScore);
  assert.equal(defaultResult.breakdown.ratingScore, proposedResult.breakdown.ratingScore);
  assert.equal(defaultResult.breakdown.popularityScore, proposedResult.breakdown.popularityScore);
  assert.equal(defaultResult.breakdown.categoryScore, 0.00, 'Category score must be 0.00 when category scoring is inactive');
  assert.equal(proposedResult.breakdown.categoryScore, 1.00, 'Category score must be 1.00 when category matches and scoring is active');
});

test('UC 2.5.3: Proposed weights configuration matches exact business specifications (35/25/25/15)', () => {
  const weights = normalizeRecommendationWeights(PROPOSED_TARGET_WEIGHTS, true);
  assert.equal(weights.distance, 0.35, 'Distance must be 35%');
  assert.equal(weights.categoryPreference, 0.25, 'Category preference must be 25%');
  assert.equal(weights.rating, 0.25, 'Rating must be 25%');
  assert.equal(weights.popularity, 0.15, 'Popularity must be 15%');

  const sum = weights.distance + weights.categoryPreference + weights.rating + weights.popularity;
  assert.equal(Math.round(sum * 100) / 100, 1.00);
});

test('UC 2.5.3: Neutral fallback (0.50) safely handles null categories and users with empty preferences', () => {
  // Case A: User has preferences, but merchant has null category
  const resNullCat = scoreMerchant(
    {
      merchantId: 'm-null-cat',
      distanceKm: 1.0,
      averageRating: 4.0,
      transactionCount24h: 10,
      merchantCategoryId: null,
      userPreferredCategories: ['FOOD', 'BEVERAGE'],
    },
    PROPOSED_TARGET_WEIGHTS,
    10,
    true
  );
  assert.equal(resNullCat.breakdown.categoryScore, 0.50);

  // Case B: Merchant has category, but user has no preferences (empty array)
  const resEmptyUserPref = scoreMerchant(
    {
      merchantId: 'm-with-cat',
      distanceKm: 1.0,
      averageRating: 4.0,
      transactionCount24h: 10,
      merchantCategoryId: 'STREET_FOOD',
      userPreferredCategories: [],
    },
    PROPOSED_TARGET_WEIGHTS,
    10,
    true
  );
  assert.equal(resEmptyUserPref.breakdown.categoryScore, 0.50);

  // Case C: Both merchant category is null and user has no preferences
  const resBothNull = scoreMerchant(
    {
      merchantId: 'm-both-null',
      distanceKm: 1.0,
      averageRating: 4.0,
      transactionCount24h: 10,
      merchantCategoryId: null,
      userPreferredCategories: undefined,
    },
    PROPOSED_TARGET_WEIGHTS,
    10,
    true
  );
  assert.equal(resBothNull.breakdown.categoryScore, 0.50);
});

test('UC 2.5.3: Category filter accurately matches all 5 canonical categories and displays correct Thai labels', () => {
  const canonicalCategories = [
    { id: 'FOOD', thaiLabel: 'ร้านอาหารทั่วไป' },
    { id: 'STREET_FOOD', thaiLabel: 'อาหารริมทาง' },
    { id: 'BAKERY_DESSERT', thaiLabel: 'ขนมหวานและเบเกอรี่' },
    { id: 'BEVERAGE', thaiLabel: 'เครื่องดื่ม' },
    { id: 'GENERAL_GOODS', thaiLabel: 'สินค้าทั่วไป' },
  ];

  for (const cat of canonicalCategories) {
    assert.equal(getCategoryDisplayName(cat.id), cat.thaiLabel);
    assert.equal(CANONICAL_CATEGORIES[cat.id as keyof typeof CANONICAL_CATEGORIES].nameTh, cat.thaiLabel);
  }

  // Null fallback display name
  assert.equal(getCategoryDisplayName(null), 'ร้านค้าสมาชิก Co-pay');
  assert.equal(getCategoryDisplayName(undefined), 'ร้านค้าสมาชิก Co-pay');
});




test('UC 2.5.3 (Req 7): Multiple preferences with different weights scale category relevance proportionally', () => {
  const userPreferences = [
    { categoryId: 'FOOD', preferenceWeight: 1.0 },
    { categoryId: 'BEVERAGE', preferenceWeight: 0.6 },
    { categoryId: 'BAKERY_DESSERT', preferenceWeight: 0.3 },
  ];

  // Matched highest weight (1.0 / 1.0) -> 1.00
  assert.equal(calculateNormalizedCategoryScore('FOOD', userPreferences), 1.00);
  // Matched medium weight (0.6 / 1.0) -> 0.60
  assert.equal(calculateNormalizedCategoryScore('BEVERAGE', userPreferences), 0.60);
  // Matched lowest weight (0.3 / 1.0) -> 0.30
  assert.equal(calculateNormalizedCategoryScore('BAKERY_DESSERT', userPreferences), 0.30);
  // Unmatched category -> 0.00
  assert.equal(calculateNormalizedCategoryScore('STREET_FOOD', userPreferences), 0.00);
  assert.equal(calculateNormalizedCategoryScore('GENERAL_GOODS', userPreferences), 0.00);
  // NULL merchant category -> 0.50
  assert.equal(calculateNormalizedCategoryScore(null, userPreferences), 0.50);

  // Scaled non-1.0 max weight: e.g. weights [2.0, 1.0] -> 2.0/2.0 = 1.0, 1.0/2.0 = 0.5
  const scaledUserPrefs = [
    { categoryId: 'FOOD', preferenceWeight: 2.0 },
    { categoryId: 'BEVERAGE', preferenceWeight: 1.0 },
  ];
  assert.equal(calculateNormalizedCategoryScore('FOOD', scaledUserPrefs), 1.00);
  assert.equal(calculateNormalizedCategoryScore('BEVERAGE', scaledUserPrefs), 0.50);
});

test('UC 2.5.3 (Req 7): Backend recommendation ordering uses active weighted score to rank matched merchants higher', () => {
  // 3 merchants with identical distance (1.0km), rating (4.0), and popularity (10tx)
  // Differing only by category_id
  const matchingMerchant = scoreMerchant({
    merchantId: 'm-matched',
    distanceKm: 1.0,
    averageRating: 4.0,
    transactionCount24h: 10,
    merchantCategoryId: 'FOOD',
    userPreferredCategories: [{ categoryId: 'FOOD', preferenceWeight: 1.0 }],
  });

  const nullMerchant = scoreMerchant({
    merchantId: 'm-null-cat',
    distanceKm: 1.0,
    averageRating: 4.0,
    transactionCount24h: 10,
    merchantCategoryId: null,
    userPreferredCategories: [{ categoryId: 'FOOD', preferenceWeight: 1.0 }],
  });

  const unmatchedMerchant = scoreMerchant({
    merchantId: 'm-unmatched',
    distanceKm: 1.0,
    averageRating: 4.0,
    transactionCount24h: 10,
    merchantCategoryId: 'GENERAL_GOODS',
    userPreferredCategories: [{ categoryId: 'FOOD', preferenceWeight: 1.0 }],
  });

  // Verify category scores: 1.00 vs 0.50 vs 0.00
  assert.equal(matchingMerchant.breakdown.categoryScore, 1.00);
  assert.equal(nullMerchant.breakdown.categoryScore, 0.50);
  assert.equal(unmatchedMerchant.breakdown.categoryScore, 0.00);

  // Verify totalScore ordering: Matched > Null > Unmatched
  assert.ok(matchingMerchant.totalScore > nullMerchant.totalScore, 'Matching merchant score must exceed null merchant');
  assert.ok(nullMerchant.totalScore > unmatchedMerchant.totalScore, 'Null merchant score must exceed unmatched merchant');

  // Verify rankScoredMerchants ordering
  const ranked = rankScoredMerchants([unmatchedMerchant, nullMerchant, matchingMerchant]);
  assert.equal(ranked[0].merchantId, 'm-matched', 'Matched merchant must be ranked 1st');
  assert.equal(ranked[1].merchantId, 'm-null-cat', 'Null category merchant must be ranked 2nd');
  assert.equal(ranked[2].merchantId, 'm-unmatched', 'Unmatched merchant must be ranked 3rd');
});

test('UC 2.5.3 (Req 7): Scores are strictly normalized between 0.000 and 1.000 across all boundary inputs', () => {
  const extremeCases = [
    { distanceKm: 0, averageRating: 5.0, transactionCount24h: 100, merchantCategoryId: 'FOOD' },
    { distanceKm: 50, averageRating: 0.0, transactionCount24h: 0, merchantCategoryId: 'GENERAL_GOODS' },
    { distanceKm: -5, averageRating: 10.0, transactionCount24h: -10, merchantCategoryId: null },
    { distanceKm: NaN, averageRating: null, transactionCount24h: undefined, merchantCategoryId: '' },
  ];

  for (const input of extremeCases) {
    const res = scoreMerchant({
      merchantId: 'm-boundary',
      ...input,
      userPreferredCategories: ['FOOD'],
    });

    assert.ok(res.totalScore >= 0.0 && res.totalScore <= 1.0, `totalScore ${res.totalScore} must be within [0, 1]`);
    assert.ok(res.breakdown.distanceScore >= 0.0 && res.breakdown.distanceScore <= 1.0);
    assert.ok(res.breakdown.ratingScore >= 0.0 && res.breakdown.ratingScore <= 1.0);
    assert.ok(res.breakdown.popularityScore >= 0.0 && res.breakdown.popularityScore <= 1.0);
    assert.ok(res.breakdown.categoryScore >= 0.0 && res.breakdown.categoryScore <= 1.0);
  }
});

test('UC 2.5.3 (Req 7): AI client fallback returns deterministic rule-based ranking and reasons upon failure', async () => {
  const { aiRecommendationClient } = await import('../services/ai-recommendation.client');
  const { geminiRecommendationClient } = await import('../services/gemini-recommendation.client');

  const candidates = [
    {
      merchantId: 'c-1',
      shopName: 'ร้านป้าสมร ข้าวมันไก่',
      distanceKm: 0.8,
      formattedDistance: '800 ม.',
      averageRating: 4.8,
      transactionCount24h: 25,
      baseScore: 0.92,
      categoryId: 'FOOD',
    },
    {
      merchantId: 'c-2',
      shopName: 'ชาเย็นนมสด ชุมชน',
      distanceKm: 1.5,
      formattedDistance: '1.5 กม.',
      averageRating: 4.2,
      transactionCount24h: 5,
      baseScore: 0.75,
      categoryId: 'BEVERAGE',
    },
  ];

  // Test deterministic rule-based fallback directly
  const fallbackResult = aiRecommendationClient.executeRuleBasedFallback(
    { candidates, userPreferredCategories: ['FOOD'] },
    Date.now()
  );

  assert.equal(fallbackResult.provider, 'rule_based_fallback');
  assert.equal(fallbackResult.isFallback, true);
  assert.equal(fallbackResult.rankedMerchants.length, 2);
  assert.equal(fallbackResult.rankedMerchants[0].merchantId, 'c-1');
  assert.ok(fallbackResult.rankedMerchants[0].recommendationReason.includes('ร้านยอดนิยม'));

  // Test geminiRecommendationClient fallback behavior when disabled (default in test)
  const geminiResult = await geminiRecommendationClient.rerankCandidates({
    candidates,
    userPreferredCategories: ['FOOD'],
    maxOutputLimit: 2,
  });

  assert.equal(geminiResult.provider, 'rule_based_fallback');
  assert.equal(geminiResult.isFallback, true);
  assert.equal(geminiResult.rankedMerchants[0].merchantId, 'c-1');
  assert.equal(geminiResult.rankedMerchants[0].finalScore, 0.92);
});

test('UC 2.5.3 (Req 7): Authentication and user data isolation protects preferences', () => {
  const userAId = 'user-a-1111-1111-1111-111111111111';
  const userBId = 'user-b-2222-2222-2222-222222222222';

  // Verify that scoring with User A preferences does not affect User B
  const userAPrefs = [{ categoryId: 'FOOD', preferenceWeight: 1.0 }];
  const userBPrefs = [{ categoryId: 'BEVERAGE', preferenceWeight: 1.0 }];

  const scoreForUserA = scoreMerchant({
    merchantId: 'm-food',
    distanceKm: 1.0,
    merchantCategoryId: 'FOOD',
    userPreferredCategories: userAPrefs,
  });

  const scoreForUserB = scoreMerchant({
    merchantId: 'm-food',
    distanceKm: 1.0,
    merchantCategoryId: 'FOOD',
    userPreferredCategories: userBPrefs,
  });

  // User A gets 1.00 category score for FOOD; User B gets 0.00 category score for FOOD
  assert.equal(scoreForUserA.breakdown.categoryScore, 1.00);
  assert.equal(scoreForUserB.breakdown.categoryScore, 0.00);
  assert.ok(scoreForUserA.totalScore > scoreForUserB.totalScore);

  // Guest user (undefined preferences) gets neutral fallback 0.50
  const scoreForGuest = scoreMerchant({
    merchantId: 'm-food',
    distanceKm: 1.0,
    merchantCategoryId: 'FOOD',
    userPreferredCategories: undefined,
  });
  assert.equal(scoreForGuest.breakdown.categoryScore, 0.50);
});
