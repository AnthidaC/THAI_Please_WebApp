import prisma from '../utils/prisma';
import {
  isValidCoordinate,
  calculateHaversineDistanceKm,
  formatDistanceDisplay,
} from '../utils/recommendation-distance';
import {
  RecommendationWeights,
  PROVISIONAL_DEFAULT_WEIGHTS,
  ScoreBreakdown,
  scoreMerchant,
  rankScoredMerchants,
} from '../utils/recommendation-scoring';
import { recommendationPopularityService } from './recommendation-popularity.service';
import { CandidateMerchant } from './ai-recommendation.client';
import { geminiRecommendationClient } from './gemini-recommendation.client';
import { recordRecommendationImpressions } from './recommendation-tracking.service';

export class RecommendationServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RecommendationServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * ข้อมูลร้านค้าผู้สมัครรอบตัวผู้ใช้ (Candidate Merchant DTO)
 */
export interface NearbyMerchantCandidate {
  merchantId: string;
  shopName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  formattedDistance: string;
  averageRating: number;
  categoryId?: string | null;
}

/**
 * ผลลัพธ์ร้านค้าที่ผ่านการคำนวณคะแนน Rule-based และจัดอันดับแล้ว (Stage 1 Scored & Ranked Merchant)
 */
export interface ScoredMerchantCandidate extends NearbyMerchantCandidate {
  transactionCount24h: number;
  totalScore: number;
  breakdown: ScoreBreakdown;
}

/**
 * ตัวเลือกสำหรับคำขอคำแนะนำร้านค้า (Get Recommendations Options)
 */
export interface GetRecommendationsOptions {
  userId?: string | null; // Authenticated User ID จาก Session เท่านั้น (ห้ามรับจาก Client Query/Body)
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  userPreferredCategories?: string[];
  customWeights?: Partial<RecommendationWeights>;
}

/**
 * ข้อมูลร้านค้าแนะนำขั้นสุดท้ายพร้อมเหตุผลภาษาไทย (Recommended Merchant Item)
 */
export interface RecommendedMerchantResult {
  merchantId: string;
  shopName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  formattedDistance: string;
  averageRating: number;
  transactionCount24h: number;
  categoryId?: string | null;
  baseScore: number;
  finalScore: number;
  recommendationReason: string;
  isAiEnhanced: boolean;
  scoreBreakdown?: ScoreBreakdown;
  recommendationId?: string; // รหัสคำแนะนำที่เซิร์ฟเวอร์ส่งมอบ (Served Recommendation ID สำหรับ Click Tracking)
}

/**
 * ผลลัพธ์จากระบบค้นหาและแนะนำร้านค้า (Recommendation Engine Output)
 */
export interface RecommendationResult {
  totalCandidatesFound: number;
  provider: 'gemini' | 'openai' | 'rule_based_fallback';
  isFallback: boolean;
  latencyMs: number;
  recommendations: RecommendedMerchantResult[];
}

/**
 * โครงสร้างข้อมูล Geolocation Bounding Box
 */
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  isWrapped: boolean;
  wrappedLonRange?: {
    range1: { min: number; max: number };
    range2: { min: number; max: number };
  };
}

/**
 * คำนวณพิกัด Bounding Box สำหรับกรองในระดับฐานข้อมูลเบื้องต้น
 * - ป้องกันการ Full Scan ด้วยการใช้ Index [latitude, longitude]
 * - ปรับระยะตามความโค้งของโลก และรองรับกรณีเส้นแบ่งเขตลองจิจูด (Antimeridian Wraparound)
 */
export const calculateBoundingBox = (
  latitude: number,
  longitude: number,
  radiusKm: number
): BoundingBox => {
  const KM_PER_LAT_DEGREE = 111.0;
  const deltaLat = radiusKm / KM_PER_LAT_DEGREE;
  const minLat = Math.max(-90, latitude - deltaLat);
  const maxLat = Math.min(90, latitude + deltaLat);

  // คำนวณ delta longitude ตามละติจูด (ระยะห่างของลองจิจูดจะแคบลงเมื่อเข้าใกล้ขั้วโลก)
  const radLat = (Math.abs(latitude) * Math.PI) / 180;
  const cosLat = Math.cos(radLat);

  let deltaLon: number;
  if (cosLat < 0.0001) {
    deltaLon = 180; // บริเวณขั้วโลก ให้ครอบคลุมทุกองศา
  } else {
    deltaLon = radiusKm / (KM_PER_LAT_DEGREE * cosLat);
  }

  const rawMinLon = longitude - deltaLon;
  const rawMaxLon = longitude + deltaLon;

  // ตรวจสอบการข้ามเส้น Antimeridian (-180/180 องศา)
  if (rawMinLon < -180) {
    return {
      minLat,
      maxLat,
      minLon: -180,
      maxLon: rawMaxLon,
      isWrapped: true,
      wrappedLonRange: {
        range1: { min: rawMinLon + 360, max: 180 },
        range2: { min: -180, max: rawMaxLon },
      },
    };
  }

  if (rawMaxLon > 180) {
    return {
      minLat,
      maxLat,
      minLon: rawMinLon,
      maxLon: 180,
      isWrapped: true,
      wrappedLonRange: {
        range1: { min: rawMinLon, max: 180 },
        range2: { min: -180, max: rawMaxLon - 360 },
      },
    };
  }

  return {
    minLat,
    maxLat,
    minLon: rawMinLon,
    maxLon: rawMaxLon,
    isWrapped: false,
  };
};

/**
 * Service หลักสำหรับระบบค้นหาและแนะนำร้านค้า (Developer 3)
 * Part 1: Merchant Candidate Retrieval
 */
export class RecommendationService {
  /**
   * ค้นหาร้านค้าที่ได้รับการอนุมัติ (Approved) ในรัศมีที่กำหนด
   * 1. กรองเบื้องต้นด้วย Geolocation Bounding Box (Database Index Scan)
   * 2. กรองและคำนวณระยะทางที่แม่นยำด้วย Haversine Formula
   * 3. ตัดร้านที่มีพิกัดไม่สมบูรณ์ทิ้ง
   *
   * @param latitude พิกัดละติจูดของผู้ใช้ (-90 ถึง 90)
   * @param longitude พิกัดลองจิจูดของผู้ใช้ (-180 ถึง 180)
   * @param radiusKm รัศมีการค้นหาเป็นกิโลเมตร (Default 10 km)
   */
  public async getNearbyMerchantCandidates(
    latitude: number,
    longitude: number,
    radiusKm = 10
  ): Promise<NearbyMerchantCandidate[]> {
    // 1. ตรวจสอบความถูกต้องของพิกัดและรัศมี
    if (!isValidCoordinate(latitude, longitude)) {
      throw new RecommendationServiceError(
        `พิกัดผู้ใช้ไม่ถูกต้อง: lat=${latitude}, lon=${longitude} (ละติจูดต้องอยู่ระหว่าง -90 ถึง 90, ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180)`,
        400
      );
    }

    if (typeof radiusKm !== 'number' || isNaN(radiusKm) || radiusKm <= 0) {
      throw new RecommendationServiceError('รัศมีการค้นหาต้องเป็นตัวเลขที่มากกว่า 0 กิโลเมตร', 400);
    }

    // 2. คำนวณ Bounding Box สำหรับ Query ระดับฐานข้อมูล
    const bbox = calculateBoundingBox(latitude, longitude, radiusKm);

    // 3. สร้างเงื่อนไข Where กรองเฉพาะร้านค้าที่ได้รับการอนุมัติ (is_approved: true)
    const whereClause: any = {
      is_approved: true,
      latitude: {
        gte: bbox.minLat,
        lte: bbox.maxLat,
      },
    };

    if (bbox.isWrapped && bbox.wrappedLonRange) {
      whereClause.OR = [
        {
          longitude: {
            gte: bbox.wrappedLonRange.range1.min,
            lte: bbox.wrappedLonRange.range1.max,
          },
        },
        {
          longitude: {
            gte: bbox.wrappedLonRange.range2.min,
            lte: bbox.wrappedLonRange.range2.max,
          },
        },
      ];
    } else {
      whereClause.longitude = {
        gte: bbox.minLon,
        lte: bbox.maxLon,
      };
    }

    // 4. ดึงข้อมูลร้านค้าจากฐานข้อมูล
    let merchants: Array<{
      merchant_id: string;
      shop_name: string;
      latitude: any;
      longitude: any;
      average_rating_stars: any;
      category_id?: string | null;
    }>;

    try {
      merchants = await prisma.merchants.findMany({
        where: whereClause,
        select: {
          merchant_id: true,
          shop_name: true,
          latitude: true,
          longitude: true,
          average_rating_stars: true,
          category_id: true,
        },
      });
    } catch (error: any) {
      console.error('[RecommendationService] Database query error:', error?.message);
      throw new RecommendationServiceError('เกิดข้อผิดพลาดในการค้นหาร้านค้าจากฐานข้อมูล', 500);
    }

    if (!merchants || merchants.length === 0) {
      return [];
    }

    // 5. กรองความถูกต้องของพิกัดและคำนวณระยะทางจริงด้วย Haversine
    const candidates: NearbyMerchantCandidate[] = [];

    for (const m of merchants) {
      const lat = Number(m.latitude);
      const lon = Number(m.longitude);

      // กรองร้านค้าที่ไม่มีพิกัดหรือพิกัดผิดรูปแบบออก
      if (!isValidCoordinate(lat, lon)) {
        continue;
      }

      const distanceKm = calculateHaversineDistanceKm(latitude, longitude, lat, lon);

      // คัดเฉพาะร้านที่อยู่ในรัศมีที่ระบุจริง
      if (distanceKm <= radiusKm) {
        candidates.push({
          merchantId: m.merchant_id,
          shopName: m.shop_name,
          latitude: lat,
          longitude: lon,
          distanceKm,
          formattedDistance: formatDistanceDisplay(distanceKm),
          averageRating: Number(m.average_rating_stars || 0),
          categoryId: m.category_id || null,
        });
      }
    }

    // เรียงลำดับเบื้องต้นตามระยะทางใกล้ที่สุด (Ascending by distance)
    candidates.sort((a, b) => a.distanceKm - b.distanceKm);

    return candidates;
  }

  /**
   * ค้นหาและคำนวณคะแนน Rule-based สำหรับร้านค้าผู้สมัคร (Stage 1 Scoring)
   * 1. ดึง Candidate Merchants ในรัศมีผ่าน getNearbyMerchantCandidates()
   * 2. หากไม่พบร้านค้า ให้คืนอาร์เรย์ว่างทันทีโดยไม่ยิง Query 24h Popularity
   * 3. Batch-fetch 24h popularity ผ่าน recommendationPopularityService
   * 4. แปลง Prisma Decimal ratings เป็น Number อย่างปลอดภัย
   * 5. คำนวณคะแนน Multi-factor ด้วย scoreMerchant()
   * 6. จัดอันดับแบบ Deterministic ด้วย rankScoredMerchants()
   *
   * @param latitude พิกัดละติจูด
   * @param longitude พิกัดลองจิจูด
   * @param radiusKm รัศมีการค้นหา (Default 10 km)
   * @param customWeights ค่าน้ำหนักปรับแต่งเพิ่มเติม (ถ้ามี)
   * @param userPreferredCategories หมวดหมู่ที่ผู้ใช้สนใจ (ถ้ามี)
   */
  public async getScoredMerchantCandidates(
    latitude: number,
    longitude: number,
    radiusKm = 10,
    customWeights?: Partial<RecommendationWeights>,
    userPreferredCategories?: string[]
  ): Promise<ScoredMerchantCandidate[]> {
    // 1. ดึงร้านค้าผู้สมัครในรัศมี (Approved & Haversine filtered)
    const candidates = await this.getNearbyMerchantCandidates(latitude, longitude, radiusKm);

    // 2. หากไม่มีร้านค้า ให้คืนค่าว่างทันที (Zero Popularity Query)
    if (candidates.length === 0) {
      return [];
    }

    // 3. รวมรหัสร้านค้าเพื่อดึงสถิติ 24h Popularity แบบ Batch Query
    const merchantIds = candidates.map((c) => c.merchantId);
    const popularityMap = await recommendationPopularityService.get24HourMerchantPopularity(merchantIds);

    // 4. คำนวณคะแนน Multi-factor สำหรับแต่ละร้านค้า
    const scoredList: ScoredMerchantCandidate[] = candidates.map((candidate) => {
      const transactionCount24h = popularityMap.get(candidate.merchantId) ?? 0;

      // แปลงและตรวจสอบ rating เป็น number อย่างปลอดภัย
      const safeRating =
        typeof candidate.averageRating === 'number' && !isNaN(candidate.averageRating)
          ? candidate.averageRating
          : 0;

      const scoringResult = scoreMerchant(
        {
          merchantId: candidate.merchantId,
          distanceKm: candidate.distanceKm,
          averageRating: safeRating,
          transactionCount24h,
          merchantCategoryId: candidate.categoryId,
          userPreferredCategories,
        },
        customWeights,
        radiusKm
      );

      return {
        ...candidate,
        averageRating: safeRating,
        transactionCount24h,
        totalScore: scoringResult.totalScore,
        breakdown: scoringResult.breakdown,
      };
    });

    // 5. จัดอันดับแบบ Deterministic พร้อม Stable Tie-breaking
    return rankScoredMerchants(scoredList);
  }

  /**
   * ค้นหาและแนะนำร้านค้าแบบ 2-Stage Hybrid (Rule-based + Gemini Flash-Lite Reranking)
   * 1. ดึงและคำนวณคะแนน Rule-based สำหรับ Candidate Merchants (Stage 1)
   * 2. หากไม่พบร้านค้า คืนผลลัพธ์ว่างทันทีโดยไม่เรียก AI (Zero Token Cost)
   * 3. เลือก Top 10 ร้านค้าเพื่อส่งต่อให้ Gemini Reranking
   * 4. จัดอันดับและสร้างเหตุผลแนะนำภาษาไทยผ่าน geminiRecommendationClient
   * 5. Fallback กลับสู่ Rule-based อัตโนมัติเมื่อ AI ถูกปิดใช้งาน, เกิด Timeout หรือขัดข้อง
   * 6. กรองและจำกัดผลลัพธ์ตาม limit ที่ระบุ
   *
   * @param options ตัวเลือกพิกัด รัศมี จำนวนรายการ และหมวดหมู่ที่สนใจ
   */
  public async getRecommendations(
    options: GetRecommendationsOptions
  ): Promise<RecommendationResult> {
    const {
      latitude,
      longitude,
      radiusKm = 10,
      limit = 5,
      userPreferredCategories,
      customWeights,
    } = options;

    const safeLimit = Math.max(1, Math.min(limit, 10));

    // 1. ดึงและคำนวณคะแนนร้านค้าผู้สมัคร (Stage 1 Rule-based Scoring)
    const scoredCandidates = await this.getScoredMerchantCandidates(
      latitude,
      longitude,
      radiusKm,
      customWeights,
      userPreferredCategories
    );

    // 2. หากไม่พบร้านค้าในบริเวณดังกล่าว คืนผลลัพธ์ทันทีโดยไม่เรียก AI
    if (scoredCandidates.length === 0) {
      return {
        totalCandidatesFound: 0,
        provider: 'rule_based_fallback',
        isFallback: true,
        latencyMs: 0,
        recommendations: [],
      };
    }

    // 3. จัดทำ Map สำหรับค้นหาข้อมูลดิบของร้านค้า (Candidate Map Lookup O(1))
    const candidateMap = new Map<string, ScoredMerchantCandidate>(
      scoredCandidates.map((c) => [c.merchantId, c])
    );

    // 4. เลือกเฉพาะ Top 10 ร้านค้าแรกตามลำดับ Deterministic Ranking เพื่อส่งให้ AI Rerank
    const top10Candidates = scoredCandidates.slice(0, 10);

    // 5. แปลงเป็นรูปแบบ CandidateMerchant ตาม Interface ของ AI Client
    const aiCandidates: CandidateMerchant[] = top10Candidates.map((c) => ({
      merchantId: c.merchantId,
      shopName: c.shopName,
      distanceKm: c.distanceKm,
      formattedDistance: c.formattedDistance,
      averageRating: c.averageRating,
      transactionCount24h: c.transactionCount24h,
      baseScore: c.totalScore,
      categoryId: c.categoryId,
    }));

    // 6. เรียกใช้ Gemini Recommendation Adapter
    // (มี Rule-based Fallback ในตัวหากปิดใช้งาน AI หรือ Timeout 2.5 วินาที)
    const rerankResponse = await geminiRecommendationClient.rerankCandidates({
      candidates: aiCandidates,
      userPreferredCategories,
      maxOutputLimit: safeLimit,
    });

    // 7. ผสานผลลัพธ์และเหตุผลแนะนำจาก AI เข้ากับข้อมูลร้านค้าต้นฉบับ
    // - กรองเฉพาะร้านค้าที่มี ID ตรงกับ Candidates ที่อนุมัติแล้วเท่านั้น (ป้องกัน Hallucination)
    // - คงลำดับการจัดอันดับและเหตุผลแนะนำภาษาไทยที่ AI หรือ Fallback ให้มา
    const finalRecommendations: RecommendedMerchantResult[] = [];

    for (const item of rerankResponse.rankedMerchants) {
      const original = candidateMap.get(item.merchantId);
      if (original) {
        finalRecommendations.push({
          merchantId: original.merchantId,
          shopName: original.shopName,
          latitude: original.latitude,
          longitude: original.longitude,
          distanceKm: original.distanceKm,
          formattedDistance: original.formattedDistance,
          averageRating: original.averageRating,
          transactionCount24h: original.transactionCount24h,
          categoryId: original.categoryId,
          baseScore: original.totalScore,
          finalScore: item.finalScore,
          recommendationReason: item.recommendationReason,
          isAiEnhanced: item.isAiEnhanced,
          scoreBreakdown: original.breakdown,
        });
      }
    }

    // 8. จำกัดจำนวนผลลัพธ์สุดท้ายตาม limit ที่ผู้ใช้ร้องขอ
    const limitedRecommendations = finalRecommendations.slice(0, safeLimit);

    // 9. บันทึกสถิติ Recommendation Served (ส่งมอบคำแนะนำ) เฉพาะผู้ใช้ที่ยืนยันตัวตนแล้ว (Authenticated Citizen)
    // [TELEMETRY PRINCIPLE]: การบันทึกสถิติทำงานแบบ Non-blocking หากล้มเหลวจะไม่ขัดขวางการแสดงผลคำแนะนำแก่ผู้ใช้
    // [DISCLAIMER]: สถิตินี้คือ "Recommendation Served" (คำแนะนำที่เซิร์ฟเวอร์ส่งมอบ) ไม่ใช่ "Visible Impression" (การมองเห็นจริงบนหน้าจอ)
    let recommendationIdMap = new Map<string, string>();

    if (options.userId && typeof options.userId === 'string' && options.userId.trim().length > 0) {
      try {
        const impressionItems = limitedRecommendations.map((r) => ({
          merchantId: r.merchantId,
          recommendationScore: r.finalScore,
        }));

        recommendationIdMap = await recordRecommendationImpressions({
          userId: options.userId.trim(),
          userLatitude: latitude,
          userLongitude: longitude,
          items: impressionItems,
        });
      } catch (trackingError: any) {
        // บันทึก Warning ภายใน ไม่โยน Error และไม่เปิดเผย Error ดิบหรือพิกัดที่ละเอียดอ่อน
        console.warn(
          '[RecommendationService] Non-blocking impression logging failure:',
          trackingError?.message || 'Unknown tracking error'
        );
      }
    }

    // 10. แนบ recommendationId เฉพาะรายการที่บันทึกสำเร็จหรือยืนยันว่ามีอยู่ใน Cooldown แล้วเท่านั้น
    const finalWithTracking: RecommendedMerchantResult[] = limitedRecommendations.map((rec) => {
      const recId = recommendationIdMap.get(rec.merchantId);
      return {
        ...rec,
        recommendationId: recId || undefined,
      };
    });

    return {
      totalCandidatesFound: scoredCandidates.length,
      provider: rerankResponse.provider,
      isFallback: rerankResponse.isFallback,
      latencyMs: rerankResponse.latencyMs,
      recommendations: finalWithTracking,
    };
  }
}

export const recommendationService = new RecommendationService();

export const getNearbyMerchantCandidates = (
  latitude: number,
  longitude: number,
  radiusKm = 10
): Promise<NearbyMerchantCandidate[]> => {
  return recommendationService.getNearbyMerchantCandidates(latitude, longitude, radiusKm);
};

export const getScoredMerchantCandidates = (
  latitude: number,
  longitude: number,
  radiusKm = 10,
  customWeights?: Partial<RecommendationWeights>
): Promise<ScoredMerchantCandidate[]> => {
  return recommendationService.getScoredMerchantCandidates(latitude, longitude, radiusKm, customWeights);
};

export const getRecommendations = (
  options: GetRecommendationsOptions
): Promise<RecommendationResult> => {
  return recommendationService.getRecommendations(options);
};
