import { randomUUID } from 'crypto';
import prisma from '../utils/prisma';
import { isValidCoordinate } from '../utils/recommendation-distance';

export class RecommendationTrackingError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RecommendationTrackingError';
    this.statusCode = statusCode;
  }
}

/**
 * ผลลัพธ์จากการบันทึก Click Event
 */
export interface RecordClickResult {
  success: boolean;
  recommendationId: string;
  isClicked: boolean;
  message: string;
}

/**
 * ข้อมูลร้านค้าและคะแนนสำหรับบันทึก Impression
 */
export interface RecommendationImpressionItem {
  merchantId: string;
  recommendationScore: number; // 0.000 - 1.000
}

/**
 * ตัวเลือกพารามิเตอร์สำหรับการบันทึก Impression
 */
export interface RecordImpressionsParams {
  userId?: string | null;      // Authenticated User ID (หากเป็น Guest ให้เป็น null/undefined)
  userLatitude: number;
  userLongitude: number;
  items: RecommendationImpressionItem[];
  cooldownMinutes?: number;    // ค่าเริ่มต้น 5 นาที
}

export const DEFAULT_IMPRESSION_COOLDOWN_MINUTES = 5;

/**
 * ลดทอนความละเอียดของพิกัด GPS เหลือทศนิยม 3 ตำแหน่ง (~110 เมตร)
 * เพื่อลดความเสี่ยงด้านความเป็นส่วนตัว (Coordinate Minimization) ตามหลัก PDPA
 * [NOTE]: ไม่ถือเป็นการนิรนามสมบูรณ์ (Not full anonymization) เนื่องจากข้อมูลยังคงผูกกับ user_id
 */
export const minimizeCoordinate = (coordinate: number): number => {
  return Math.round(coordinate * 1000) / 1000;
};

/**
 * ตรวจสอบและจำกัดคะแนนคำแนะนำให้อยู่ระหว่าง 0.000 - 1.000 (Decimal(6,3))
 */
export const sanitizeRecommendationScore = (score: number): number => {
  if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) {
    return 0.0;
  }
  return Math.max(0, Math.min(1.0, Math.round(score * 1000) / 1000));
};

/**
 * Service จัดการการติดตามผลลัพธ์คำแนะนำร้านค้า (Developer 3 - Recommendation Tracking)
 * ขอบเขต: Impression Tracking & Click Tracking
 */
export class RecommendationTrackingService {
  /**
   * บันทึกการแสดงผลคำแนะนำร้านค้า (Recommendation Impression Logging)
   *
   * [CONCURRENCY & DEDUPLICATION LIMITATION]:
   * กลไก Cooldown Deduplication นี้ทำงานในระดับ Application เป็นแบบ Best-effort
   * เนื่องจากฐานข้อมูล recommendation_logs ไม่มี Unique Constraint บน (user_id, merchant_id)
   * หากมีคำขอส่งมาพร้อมกันในเสี้ยววินาที (Concurrent Requests) อาจมีโอกาสเกิดระเบียนซ้ำได้เล็กน้อย
   * อย่างไรก็ตาม Click Tracking จะอัปเดตตรงตาม recommendation_id เฉพาะตัว จึงไม่ส่งผลต่อความถูกต้องของข้อมูล
   *
   * @param params ข้อมูลพิกัด รายการร้านค้า และผู้ใช้งาน
   * @returns Map<merchantId, recommendationId>
   */
  public async recordRecommendationImpressions(
    params: RecordImpressionsParams
  ): Promise<Map<string, string>> {
    const {
      userId,
      userLatitude,
      userLongitude,
      items,
      cooldownMinutes = DEFAULT_IMPRESSION_COOLDOWN_MINUTES,
    } = params;

    const resultMap = new Map<string, string>();

    // 1. ตรวจสอบกรณี Guest หรือรายการร้านค้าว่างเปล่า (Zero DB Query)
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return resultMap;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return resultMap;
    }

    // 2. ตรวจสอบความถูกต้องของพิกัด
    if (!isValidCoordinate(userLatitude, userLongitude)) {
      throw new RecommendationTrackingError(
        `พิกัดผู้ใช้ไม่ถูกต้อง: lat=${userLatitude}, lon=${userLongitude}`,
        400
      );
    }

    // 3. กรองและ Deduplicate merchant IDs ภายใน Request เดียวกัน
    const sanitizedItems: RecommendationImpressionItem[] = [];
    const seenMerchantIds = new Set<string>();

    for (const item of items) {
      const cleanMerchantId = item.merchantId?.trim();
      if (cleanMerchantId && !seenMerchantIds.has(cleanMerchantId)) {
        seenMerchantIds.add(cleanMerchantId);
        sanitizedItems.push({
          merchantId: cleanMerchantId,
          recommendationScore: sanitizeRecommendationScore(item.recommendationScore),
        });
      }
    }

    if (sanitizedItems.length === 0) {
      return resultMap;
    }

    const cleanUserId = userId.trim();
    const candidateMerchantIds = sanitizedItems.map((i) => i.merchantId);

    try {
      // 4. ตรวจสอบระเบียน Impression ที่มีอยู่แล้วภายในช่วง Cooldown (Best-effort Reuse)
      const safeCooldownMs = Math.max(1, cooldownMinutes) * 60 * 1000;
      const cooldownSince = new Date(Date.now() - safeCooldownMs);

      const existingRecentLogs = await prisma.recommendation_logs.findMany({
        where: {
          user_id: cleanUserId,
          merchant_id: { in: candidateMerchantIds },
          created_at: { gte: cooldownSince },
        },
        select: {
          recommendation_id: true,
          merchant_id: true,
        },
        orderBy: { created_at: 'desc' },
      });

      // นำ recommendation_id เดิมมาใช้ซ้ำสำหรับร้านค้าที่แสดงผลไปแล้วใน Cooldown
      for (const log of existingRecentLogs) {
        if (!resultMap.has(log.merchant_id)) {
          resultMap.set(log.merchant_id, log.recommendation_id);
        }
      }

      // 5. คัดกรองร้านค้าที่ยังไม่มี Impression ใน Cooldown เพื่อเตรียม Insert แบบ Batch
      const itemsToInsert = sanitizedItems.filter((i) => !resultMap.has(i.merchantId));

      if (itemsToInsert.length > 0) {
        // ลดทอนความละเอียดพิกัดเหลือทศนิยม 3 ตำแหน่ง (~110 ม.) เพื่อความเป็นส่วนตัว
        const minLat = minimizeCoordinate(userLatitude);
        const minLon = minimizeCoordinate(userLongitude);

        // สร้าง UUID ล่วงหน้าใน Node.js ด้วย randomUUID() เพื่อความเร็วและทราบ ID ทันที
        const rowsToInsert = itemsToInsert.map((item) => {
          const newId = randomUUID();
          resultMap.set(item.merchantId, newId);
          return {
            recommendation_id: newId,
            user_id: cleanUserId,
            merchant_id: item.merchantId,
            user_latitude: minLat,
            user_longitude: minLon,
            recommendation_score: item.recommendationScore,
            is_clicked: false,
            is_converted_to_payment: false,
          };
        });

        // Batch Insert ใน 1 Database Roundtrip
        await prisma.recommendation_logs.createMany({
          data: rowsToInsert,
        });
      }

      return resultMap;
    } catch (error: any) {
      console.error('[RecommendationTrackingService] Database impression error:', error?.message);
      // ไม่เปิดเผย sensitive error details
      throw new RecommendationTrackingError('เกิดข้อผิดพลาดในการบันทึกสถิติการแสดงผลคำแนะนำ', 500);
    }
  }

  /**
   * บันทึกการคลิกการ์ดคำแนะนำร้านค้า (Recommendation Click Event)
   * - ตรวจสอบความเป็นเจ้าของระเบียนข้อมูลด้วย authenticated userId
   * - อัปเดตฟิลด์ is_clicked ให้เป็น true แบบ Atomic ด้วย Prisma updateMany
   * - รองรับพฤติกรรม Idempotent (การกดซ้ำหลายครั้งจะคงสถานะ true อย่างปลอดภัย ไม่เกิดผลข้างเคียง)
   *
   * @param userId รหัสผู้ใช้ที่ผ่านการยืนยันตัวตน (Authenticated User ID เท่านั้น)
   * @param recommendationId รหัสของคำแนะนำที่ต้องการบันทึกการคลิก (UUID)
   */
  public async recordRecommendationClick(
    userId: string,
    recommendationId: string
  ): Promise<RecordClickResult> {
    // 1. ตรวจสอบความถูกต้องของพารามิเตอร์เบื้องต้น
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new RecommendationTrackingError('กรุณายืนยันตัวตนก่อนดำเนินการ (Unauthorized)', 401);
    }

    const cleanRecommendationId = recommendationId?.trim();
    if (!cleanRecommendationId) {
      throw new RecommendationTrackingError('กรุณาระบุรหัสคำแนะนำร้านค้า (recommendationId)', 400);
    }

    // 2. ปรับปรุงสถานะ is_clicked ด้วย Atomic updateMany โดยผูกเงื่อนไข user_id และ recommendation_id
    // เพื่อรับประกันว่าผู้ใช้สามารถอัปเดตได้เฉพาะระเบียนคำแนะนำของตนเองเท่านั้น
    let updateResult: { count: number };

    try {
      updateResult = await prisma.recommendation_logs.updateMany({
        where: {
          recommendation_id: cleanRecommendationId,
          user_id: userId.trim(),
        },
        data: {
          is_clicked: true,
        },
      });
    } catch (error: any) {
      console.error('[RecommendationTrackingService] Database update error:', error?.message);
      throw new RecommendationTrackingError('เกิดข้อผิดพลาดในการบันทึกสถิติการคลิกคำแนะนำ', 500);
    }

    // 3. หาก count === 0 แสดงว่าไม่พบระเบียนข้อมูล หรือระเบียนนั้นไม่ได้เป็นของผู้ใช้รายนี้
    if (updateResult.count === 0) {
      throw new RecommendationTrackingError(
        'ไม่พบข้อมูลคำแนะนำร้านค้า หรือคุณไม่มีสิทธิ์เข้าถึงรายการนี้',
        404
      );
    }

    return {
      success: true,
      recommendationId: cleanRecommendationId,
      isClicked: true,
      message: 'บันทึกการคลิกคำแนะนำร้านค้าสำเร็จ',
    };
  }
}

export const recommendationTrackingService = new RecommendationTrackingService();

export const recordRecommendationClick = (
  userId: string,
  recommendationId: string
): Promise<RecordClickResult> => {
  return recommendationTrackingService.recordRecommendationClick(userId, recommendationId);
};

export const recordRecommendationImpressions = (
  params: RecordImpressionsParams
): Promise<Map<string, string>> => {
  return recommendationTrackingService.recordRecommendationImpressions(params);
};
