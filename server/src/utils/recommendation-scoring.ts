import { calculateDistanceScore } from './recommendation-distance';

/**
 * ค่าน้ำหนักของแต่ละปัจจัยในการคำนวณคะแนนคำแนะนำ
 * [PROVISIONAL NOTE]: ค่าน้ำหนักเหล่านี้เป็นค่าเริ่มต้นชั่วคราวสำหรับการพัฒนา (Provisional Defaults)
 * ยังไม่ใช่น้ำหนักทางธุรกิจที่ได้รับการอนุมัติอย่างเป็นทางการจากทีม Product
 */
export interface RecommendationWeights {
  /** น้ำหนักระยะทางระหว่างผู้ใช้กับร้านค้า (Provisional Default: 0.40) */
  distance: number;
  /** น้ำหนักคะแนนรีวิวเฉลี่ยของร้านค้า (Provisional Default: 0.35) */
  rating: number;
  /** น้ำหนักความนิยมตามจำนวนธุรกรรมใน 24 ชั่วโมง (Provisional Default: 0.25) */
  popularity: number;
  /**
   * น้ำหนักความตรงตามหมวดหมู่ที่ผู้ใช้สนใจ
   * [DISABLED PENDING APPROVAL]: ถูกปิดการใช้งาน (0.00 เสมอ) จนกว่าจะมีการอนุมัติ Master Category Taxonomy
   */
  categoryPreference: number;
}

/**
 * ค่าน้ำหนักชั่วคราวเริ่มต้น (Provisional Default Weights)
 * สัดส่วน: ระยะทาง 40%, เรตติ้ง 35%, ความนิยม 24 ชม. 25%, หมวดหมู่ 0% (ปิดใช้งาน)
 */
export const PROVISIONAL_DEFAULT_WEIGHTS: Readonly<RecommendationWeights> = Object.freeze({
  distance: 0.40,
  rating: 0.35,
  popularity: 0.25,
  categoryPreference: 0.00, // ปิดการใช้งานชั่วคราว
});

/**
 * รายละเอียดการแจกแจงคะแนนย่อยแต่ละปัจจัย (Score Breakdown)
 */
export interface ScoreBreakdown {
  distanceScore: number;       // 0.000 - 1.000
  ratingScore: number;         // 0.000 - 1.000
  popularityScore: number;     // 0.000 - 1.000
  categoryScore: number;       // 0.000 (เสมอ - Disabled)
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
}

/**
 * ปรับผลรวมของค่าน้ำหนักที่ใช้งาน (Active Weights) ให้รวมกันได้ 1.00 เสมอ
 * - บังคับ categoryPreference ให้เป็น 0.00 จนกว่าจะมีการอนุมัติ Taxonomy
 * - จัดการกรณีค่าน้ำหนักติดลบ หรือผลรวมเป็น 0 โดย Fallback กลับสู่ค่าเริ่มต้น
 */
export const normalizeRecommendationWeights = (
  customWeights?: Partial<RecommendationWeights>
): RecommendationWeights => {
  const rawDistance = Math.max(0, customWeights?.distance ?? PROVISIONAL_DEFAULT_WEIGHTS.distance);
  const rawRating = Math.max(0, customWeights?.rating ?? PROVISIONAL_DEFAULT_WEIGHTS.rating);
  const rawPopularity = Math.max(0, customWeights?.popularity ?? PROVISIONAL_DEFAULT_WEIGHTS.popularity);
  // หมวดหมู่ปิดใช้งานชั่วคราวเสมอ
  const categoryPreference = 0.00;

  const sum = rawDistance + rawRating + rawPopularity;

  // หากผลรวมผิดพลาดหรือเป็น 0 ให้ใช้ค่า Provisional Defaults
  if (sum <= 0 || isNaN(sum) || !isFinite(sum)) {
    return { ...PROVISIONAL_DEFAULT_WEIGHTS };
  }

  return {
    distance: Math.round((rawDistance / sum) * 10000) / 10000,
    rating: Math.round((rawRating / sum) * 10000) / 10000,
    popularity: Math.round((rawPopularity / sum) * 10000) / 10000,
    categoryPreference: 0.00,
  };
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
 * @param input ข้อมูลระยะทาง เรตติ้ง และยอดขายของร้าน
 * @param customWeights ค่าน้ำหนักปรับแต่งเพิ่มเติม (ถ้ามี)
 * @param maxRadiusKm รัศมีสูงสุดในการค้นหา (Default 10 km)
 */
export const scoreMerchant = (
  input: MerchantScoringInput,
  customWeights?: Partial<RecommendationWeights>,
  maxRadiusKm = 10
): ScoredMerchantResult => {
  const activeWeights = normalizeRecommendationWeights(customWeights);

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
  const categoryScore = 0.00; // ปิดใช้งานชั่วคราว

  // รวมคะแนนแบบถ่วงน้ำหนัก
  const rawTotal =
    distanceScore * activeWeights.distance +
    ratingScore * activeWeights.rating +
    popularityScore * activeWeights.popularity +
    categoryScore * activeWeights.categoryPreference;

  const totalScore = Math.max(0, Math.min(1.0, Math.round(rawTotal * 1000) / 1000));

  return {
    merchantId: input.merchantId,
    totalScore,
    breakdown: {
      distanceScore,
      ratingScore,
      popularityScore,
      categoryScore,
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
