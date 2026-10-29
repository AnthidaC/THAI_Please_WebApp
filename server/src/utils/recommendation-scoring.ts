import { calculateDistanceScore } from './recommendation-distance';
import { isValidCategoryId } from '../constants/categories';

/**
 * ค่าน้ำหนักของแต่ละปัจจัยในการคำนวณคะแนนคำแนะนำ
 * สัดส่วนตามข้อกำหนด UC 2.5.3:
 * - ระยะทาง (Distance): 35%
 * - ความตรงตามหมวดหมู่ที่ผู้ใช้สนใจ (Category Preferences): 25%
 * - คะแนนรีวิวเฉลี่ย (Rating): 25%
 * - ความนิยมตามยอดขาย 24 ชั่วโมง (Popularity): 15%
 */
export interface RecommendationWeights {
  /** น้ำหนักระยะทางระหว่างผู้ใช้กับร้านค้า (Active: 0.35) */
  distance: number;
  /** น้ำหนักคะแนนรีวิวเฉลี่ยของร้านค้า (Active: 0.25) */
  rating: number;
  /** น้ำหนักความนิยมตามจำนวนธุรกรรมใน 24 ชั่วโมง (Active: 0.15) */
  popularity: number;
  /** น้ำหนักความตรงตามหมวดหมู่ที่ผู้ใช้สนใจ (Active: 0.25) */
  categoryPreference: number;
}

/**
 * ค่าน้ำหนักมาตรฐานที่เปิดใช้งานจริงในระบบ (Active Recommendation Weights)
 * สัดส่วนตามข้อกำหนด: Distance 35%, Category Preferences 25%, Rating 25%, Popularity 15%
 */
export const ACTIVE_RECOMMENDATION_WEIGHTS: Readonly<RecommendationWeights> = Object.freeze({
  distance: 0.35,
  categoryPreference: 0.25,
  rating: 0.25,
  popularity: 0.15,
});

/**
 * ค่าน้ำหนักสำหรับ Phase 2 (Proposed Target Weights) ชี้ไปยัง ACTIVE_RECOMMENDATION_WEIGHTS
 */
export const PROPOSED_TARGET_WEIGHTS: Readonly<RecommendationWeights> = ACTIVE_RECOMMENDATION_WEIGHTS;

/**
 * ค่าน้ำหนักเริ่มต้นเดิมก่อนเปิดใช้งานหมวดหมู่ (Legacy Provisional Defaults: 40/35/25/0)
 * เก็บไว้เพื่อความเข้ากันได้กับการทดสอบเดิม
 */
export const LEGACY_PROVISIONAL_WEIGHTS: Readonly<RecommendationWeights> = Object.freeze({
  distance: 0.40,
  rating: 0.35,
  popularity: 0.25,
  categoryPreference: 0.00,
});

/**
 * Alias เพื่อรักษา Backward Compatibility
 */
export const PROVISIONAL_DEFAULT_WEIGHTS: Readonly<RecommendationWeights> = ACTIVE_RECOMMENDATION_WEIGHTS;

/**
 * คะแนนหมวดหมู่ที่เป็นกลาง (Neutral Category Score)
 * ใช้เป็น Fallback เมื่อร้านค้าไม่มี category_id (null) หรือผู้ใช้งานยังไม่ได้กำหนด preferences
 * เพื่อป้องกันการตัดคะแนนร้านค้าที่ไม่มีหมวดหมู่ หรือลงโทษผู้ใช้ที่ไม่ได้เลือกหมวดหมู่
 */
export const NEUTRAL_CATEGORY_SCORE = 0.50;

/**
 * โครงสร้างข้อมูล Preference รายการหมวดหมู่และความสำคัญ (Preference Weight)
 */
export interface UserCategoryPreferenceItem {
  categoryId: string;
  preferenceWeight?: number;
}

/**
 * รูปแบบอินพุตสำหรับ User Preferred Categories (รองรับทั้ง string และ Object ที่มี preferenceWeight)
 */
export type UserPreferenceInput = string | UserCategoryPreferenceItem;

/**
 * รายละเอียดการแจกแจงคะแนนย่อยแต่ละปัจจัย (Score Breakdown)
 */
export interface ScoreBreakdown {
  distanceScore: number;       // 0.000 - 1.000
  ratingScore: number;         // 0.000 - 1.000
  popularityScore: number;     // 0.000 - 1.000
  categoryScore: number;       // 0.000 - 1.000
  activeWeights: RecommendationWeights; // น้ำหนักที่ผ่านการ Normalize แล้ว
}

/**
 * ผลลัพธ์การคำนวณคะแนนของร้านค้า
 */
export interface ScoredMerchantResult {
  merchantId: string;
  totalScore: number;          // 0.000 - 1.000
  breakdown: ScoreBreakdown;
  distanceKm: number;
  averageRating: number;
  transactionCount24h: number;
}

/**
 * ข้อมูลร้านค้าสำหรับนำมาคำนวณคะแนน
 */
export interface MerchantScoringInput {
  merchantId: string;
  distanceKm: number;
  averageRating?: number | null;
  transactionCount24h?: number | null;
  merchantCategoryId?: string | null;
  userPreferredCategories?: UserPreferenceInput[];
}

/**
 * ปรับผลรวมของค่าน้ำหนักที่ใช้งาน (Active Weights) ให้รวมกันได้ 1.00 เสมอ
 * - ค่าเริ่มต้น enableCategoryScoring = true เปิดใช้งานสัดส่วน 35/25/25/15
 * - จัดการกรณีค่าน้ำหนักติดลบ หรือผลรวมเป็น 0 โดย Fallback กลับสู่ค่าเริ่มต้น
 */
export const normalizeRecommendationWeights = (
  customWeights?: Partial<RecommendationWeights>,
  enableCategoryScoring = true
): RecommendationWeights => {
  const baseDefaults = enableCategoryScoring ? ACTIVE_RECOMMENDATION_WEIGHTS : LEGACY_PROVISIONAL_WEIGHTS;

  const rawDistance = Math.max(0, customWeights?.distance ?? baseDefaults.distance);
  const rawRating = Math.max(0, customWeights?.rating ?? baseDefaults.rating);
  const rawPopularity = Math.max(0, customWeights?.popularity ?? baseDefaults.popularity);

  const rawCategory = enableCategoryScoring
    ? Math.max(0, customWeights?.categoryPreference ?? baseDefaults.categoryPreference)
    : 0.00;

  const sum = rawDistance + rawRating + rawPopularity + rawCategory;

  // หากผลรวมผิดพลาดหรือเป็น 0 ให้ใช้ค่าเริ่มต้น
  if (sum <= 0 || isNaN(sum) || !isFinite(sum)) {
    return { ...baseDefaults };
  }

  return {
    distance: Math.round((rawDistance / sum) * 10000) / 10000,
    rating: Math.round((rawRating / sum) * 10000) / 10000,
    popularity: Math.round((rawPopularity / sum) * 10000) / 10000,
    categoryPreference: enableCategoryScoring
      ? Math.round((rawCategory / sum) * 10000) / 10000
      : 0.00,
  };
};

/**
 * คำนวณคะแนนความตรงตามหมวดหมู่แบบ Normalization (0.00 - 1.00)
 * - คำนึงถึง preference_weight ของหมวดหมู่ที่ผู้ใช้ระบุ
 * - ปฏิบัติตาม Canonical Taxonomy ทั้ง 5 หมวดหมู่เท่านั้น
 * - จัดการกรณี null category และผู้ใช้ที่ไม่มี preferences อย่างปลอดภัย (Neutral 0.50)
 * - ไม่เพิ่มคะแนนเทียม (No artificial boost = 0.00) ให้กับร้านที่ไม่ตรงหมวดหมู่
 *
 * @param merchantCategoryId รหัสหมวดหมู่ของร้านค้า (Nullable)
 * @param userPreferredCategories รายการรหัสหมวดหมู่และความสำคัญที่ผู้ใช้สนใจ
 */
export const calculateNormalizedCategoryScore = (
  merchantCategoryId?: string | null,
  userPreferredCategories?: UserPreferenceInput[]
): number => {
  // 1. หากร้านค้าไม่มีหมวดหมู่ (null) หรือผู้ใช้งานไม่ได้ตั้งค่าหมวดหมู่ ให้ได้คะแนน Neutral (0.50)
  if (
    !merchantCategoryId ||
    merchantCategoryId.trim() === '' ||
    !userPreferredCategories ||
    userPreferredCategories.length === 0
  ) {
    return NEUTRAL_CATEGORY_SCORE;
  }

  const normalizedMerchant = merchantCategoryId.trim().toUpperCase();

  // 2. หากหมวดหมู่ของร้านค้าไม่อยู่ใน Canonical Taxonomy 5 หมวดหมู่ ให้เป็น Neutral (0.50)
  if (!isValidCategoryId(normalizedMerchant)) {
    return NEUTRAL_CATEGORY_SCORE;
  }

  // 3. กรองและสกัดเฉพาะ Canonical Category Preferences ของผู้ใช้ พร้อม preference_weight
  const validPreferences: Array<{ categoryId: string; weight: number }> = [];

  for (const item of userPreferredCategories) {
    if (!item) continue;
    const catId = (typeof item === 'string' ? item : item.categoryId || '').trim().toUpperCase();
    if (isValidCategoryId(catId)) {
      const rawWeight =
        typeof item === 'object' && typeof item.preferenceWeight === 'number' && isFinite(item.preferenceWeight)
          ? item.preferenceWeight
          : 1.0;
      validPreferences.push({
        categoryId: catId,
        weight: Math.max(0, rawWeight),
      });
    }
  }

  // หากไม่มีหมวดหมู่ที่ตรงตาม Canonical Taxonomy เลย ให้คะแนน Neutral (0.50)
  if (validPreferences.length === 0) {
    return NEUTRAL_CATEGORY_SCORE;
  }

  // 4. ตรวจสอบว่าร้านค้าตรงกับหมวดหมู่ใดที่ผู้ใช้เลือกไว้หรือไม่
  const matched = validPreferences.find((p) => p.categoryId === normalizedMerchant);
  if (!matched) {
    // ผู้ใช้ระบุหมวดหมู่ที่สนใจ แต่ร้านค้าไม่ตรงกับหมวดหมู่ใดเลย -> 0.00 (ไม่ให้คะแนนเสริม)
    return 0.00;
  }

  // 5. คำนวณคะแนนตาม preference_weight สัมพัทธ์กับค่าน้ำหนักสูงสุดของผู้ใช้ (Relative Normalization)
  const maxWeight = Math.max(...validPreferences.map((p) => p.weight));
  if (maxWeight <= 0) {
    return NEUTRAL_CATEGORY_SCORE;
  }

  const score = Math.min(1.0, Math.max(0.0, matched.weight / maxWeight));
  return Math.round(score * 1000) / 1000;
};

/**
 * คำนวณคะแนนระยะทางแบบ Normalization (0.00 - 1.00)
 * ร้านที่ใกล้ที่สุด (0 km) จะได้ 1.00 และลดลงตามระยะทางจนถึง 0.00 ที่ maxRadiusKm
 * @param distanceKm ระยะทางเป็นกิโลเมตร
 * @param maxRadiusKm รัศมีสูงสุด (Default 10 km)
 */
export const calculateNormalizedDistanceScore = (
  distanceKm: number,
  maxRadiusKm = 10
): number => {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || !isFinite(distanceKm)) {
    return 0.0;
  }
  return calculateDistanceScore(distanceKm, maxRadiusKm);
};

/**
 * คำนวณคะแนนเรตติ้งแบบ Normalization (0.00 - 1.00)
 * เทียบจากคะแนนเต็ม 5 ดาว โดยจัดการค่า null, undefined, NaN หรือค่าติดลบอย่างปลอดภัย
 * @param rating คะแนนเฉลี่ย (0.0 - 5.0)
 */
export const calculateNormalizedRatingScore = (
  rating?: number | null
): number => {
  if (rating === null || rating === undefined || typeof rating !== 'number' || isNaN(rating) || !isFinite(rating)) {
    return 0.0; // หากไม่มีข้อมูลเรตติ้ง จะได้คะแนน 0.0
  }
  const clampedRating = Math.max(0, Math.min(5.0, rating));
  return Math.round((clampedRating / 5.0) * 1000) / 1000;
};

/**
 * คำนวณคะแนนความนิยมจากจำนวนธุรกรรมใน 24 ชั่วโมงแบบ Normalization (0.00 - 1.00)
 * ใช้ Diminishing Returns Curve เพื่อป้องกันร้านที่มียอดสูงลิ่วผูกขาดคะแนน
 * @param transactionCount24h จำนวนธุรกรรมใน 24 ชม.
 * @param saturationCap จุดอิ่มตัวของยอดธุรกรรม (Default: 30 รายการ)
 */
export const calculateNormalizedPopularityScore = (
  transactionCount24h?: number | null,
  saturationCap = 30
): number => {
  if (
    transactionCount24h === null ||
    transactionCount24h === undefined ||
    typeof transactionCount24h !== 'number' ||
    isNaN(transactionCount24h) ||
    !isFinite(transactionCount24h) ||
    transactionCount24h <= 0
  ) {
    return 0.0;
  }

  const safeCap = Math.max(1, saturationCap);
  const safeCount = Math.max(0, transactionCount24h);

  // ใช้ Logarithmic Scale: log10(1 + count) / log10(1 + cap)
  const logScore = Math.log10(1 + safeCount) / Math.log10(1 + safeCap);
  const clampedScore = Math.max(0, Math.min(1.0, logScore));

  return Math.round(clampedScore * 1000) / 1000;
};

/**
 * คำนวณคะแนนรวมและ Score Breakdown สำหรับร้านค้า 1 ร้าน
 * ตามสูตร: Distance 35% + Category 25% + Rating 25% + Popularity 15%
 *
 * @param input ข้อมูลระยะทาง เรตติ้ง ยอดขาย และหมวดหมู่ของร้าน
 * @param customWeights ค่าน้ำหนักปรับแต่งเพิ่มเติม (ถ้ามี)
 * @param maxRadiusKm รัศมีสูงสุดในการค้นหา (Default 10 km)
 * @param enableCategoryScoring เปิดใช้งานคะแนนหมวดหมู่ (Default: true)
 */
export const scoreMerchant = (
  input: MerchantScoringInput,
  customWeights?: Partial<RecommendationWeights>,
  maxRadiusKm = 10,
  enableCategoryScoring = true
): ScoredMerchantResult => {
  const activeWeights = normalizeRecommendationWeights(customWeights, enableCategoryScoring);

  const distanceKm = typeof input.distanceKm === 'number' && isFinite(input.distanceKm)
    ? Math.max(0, input.distanceKm)
    : maxRadiusKm;
  const averageRating = typeof input.averageRating === 'number' && isFinite(input.averageRating)
    ? Math.max(0, input.averageRating)
    : 0;
  const transactionCount24h = typeof input.transactionCount24h === 'number' && isFinite(input.transactionCount24h)
    ? Math.max(0, input.transactionCount24h)
    : 0;

  const distanceScore = calculateNormalizedDistanceScore(distanceKm, maxRadiusKm);
  const ratingScore = calculateNormalizedRatingScore(input.averageRating);
  const popularityScore = calculateNormalizedPopularityScore(input.transactionCount24h);
  
  // คำนวณคะแนนหมวดหมู่พร้อม Safe Neutral Fallback (0.50 สำหรับ null category หรือ unconfigured user)
  const categoryScore = calculateNormalizedCategoryScore(
    input.merchantCategoryId,
    input.userPreferredCategories
  );

  // รวมคะแนนแบบถ่วงน้ำหนักมาตรฐาน (35/25/25/15)
  const rawTotal =
    distanceScore * activeWeights.distance +
    categoryScore * activeWeights.categoryPreference +
    ratingScore * activeWeights.rating +
    popularityScore * activeWeights.popularity;

  const totalScore = Math.max(0, Math.min(1.0, Math.round(rawTotal * 1000) / 1000));

  return {
    merchantId: input.merchantId,
    totalScore,
    breakdown: {
      distanceScore,
      ratingScore,
      popularityScore,
      categoryScore: activeWeights.categoryPreference > 0 ? categoryScore : 0.00,
      activeWeights,
    },
    distanceKm,
    averageRating,
    transactionCount24h,
  };
};

/**
 * จัดอันดับร้านค้าแบบ Deterministic พร้อม Stable Tie-breaking ที่แน่นอน
 * ลำดับการตัดสินกรณีคะแนนเท่ากัน (Tie-breaking Rules):
 * 1. คะแนนรวม (Total Score) - มากไปน้อย
 * 2. ระยะทาง (Distance) - ใกล้กว่ามาก่อน
 * 3. เรตติ้งร้านค้า (Average Rating) - เรตติ้งสูงกว่ามาก่อน
 * 4. ยอดขาย 24 ชม. (Popularity) - ยอดขายมากกว่ามาก่อน
 * 5. Merchant ID (UUID Lexicographical Sort) - รับประกันผลลัพธ์คงที่ 100%
 */
export const rankScoredMerchants = <T extends ScoredMerchantResult>(merchants: T[]): T[] => {
  return [...merchants].sort((a, b) => {
    // 1. คะแนนรวม
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    // 2. ระยะทางใกล้กว่า
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    // 3. เรตติ้งสูงกว่า
    if (b.averageRating !== a.averageRating) {
      return b.averageRating - a.averageRating;
    }
    // 4. จำนวนธุรกรรม 24 ชม. มากกว่า
    if (b.transactionCount24h !== a.transactionCount24h) {
      return b.transactionCount24h - a.transactionCount24h;
    }
    // 5. Merchant ID เปรียบเทียบตัวอักษรเพื่อความคงที่แน่นอน (Stable deterministic tie-breaker)
    return a.merchantId.localeCompare(b.merchantId);
  });
};
