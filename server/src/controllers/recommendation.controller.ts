import { Request, Response } from 'express';
import {
  recommendationService,
  RecommendationServiceError,
} from '../services/recommendation.service';
import {
  recommendationTrackingService,
  RecommendationTrackingError,
} from '../services/recommendation-tracking.service';
import { preferenceService } from '../services/preference.service';
import { getRecommendationsQuerySchema } from '../validations/recommendation.validation';
import { recommendationTrackingParamSchema } from '../validations/recommendation-tracking.validation';
import { sendSuccess, sendError } from '../utils/response';
import { UserPreferenceInput } from '../utils/recommendation-scoring';

/**
 * ดึงรายการร้านค้าแนะนำรอบตัวผู้ใช้ (AI Near-Me Discovery)
 * GET /api/recommendations/near-me
 * - รองรับทั้ง Authenticated Citizen และ Guest (ตามนโยบายระบบ)
 * - บันทึก Recommendation Served Log เฉพาะผู้ใช้ที่เข้าสู่ระบบ
 * - โหลด Category Preferences พร้อม preference_weight ของผู้ใช้ที่ล็อกอิน (รักษา Tenant/User Isolation)
 * - แปลงและตรวจสอบ Query Parameter อย่างปลอดภัยด้วย Zod
 */
export const getNearbyRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. ตรวจสอบความถูกต้องของ Query Parameters (latitude, longitude, radiusKm, limit)
    const parseResult = getRecommendationsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
      sendError(res, errorMessage || 'พารามิเตอร์ค้นหาไม่ถูกต้อง', 400, parseResult.error.format());
      return;
    }

    const { latitude, longitude, radiusKm, limit } = parseResult.data;

    // 2. ดึง userId จาก Authenticated Session เท่านั้น (ห้ามรับจาก Client Query/Body)
    // หากเป็น Guest จะได้ undefined/null ซึ่งระบบจะส่งคำแนะนำปกติโดยไม่บันทึก Impression Log
    const userId = req.user?.userId || null;

    // โหลดประเภทร้านค้าที่ผู้ใช้สนใจ (Citizen Category Preferences) พร้อม preference_weight สำหรับคำนวณคะแนน
    let userPreferredCategories: UserPreferenceInput[] | undefined = undefined;
    if (userId) {
      try {
        const userPrefs = await preferenceService.getUserPreferences(userId);
        if (userPrefs && userPrefs.preferences.length > 0) {
          userPreferredCategories = userPrefs.preferences.map((p) => ({
            categoryId: p.categoryId,
            preferenceWeight: p.preferenceWeight,
          }));
        }
      } catch (prefErr: any) {
        console.warn(
          '[RecommendationController] Failed to load user preferences for recommendations:',
          prefErr?.message
        );
      }
    }

    // 3. ประมวลผลค้นหาและจัดอันดับร้านค้า (2-Stage Hybrid + Fallback)
    const result = await recommendationService.getRecommendations({
      userId,
      latitude,
      longitude,
      radiusKm,
      limit,
      userPreferredCategories,
    });

    sendSuccess(res, result, 'ดึงข้อมูลร้านค้าแนะนำสำเร็จ');
  } catch (error: any) {
    if (error instanceof RecommendationServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('[RecommendationController] getNearbyRecommendations error:', error?.message);
    sendError(res, 'เกิดข้อผิดพลาดในการค้นหาร้านค้าแนะนำ', 500);
  }
};

/**
 * บันทึกสถิติการคลิกการ์ดคำแนะนำร้านค้า (Recommendation Click Tracking)
 * POST /api/recommendations/:recommendationId/click
 * - ต้องผ่านการยืนยันตัวตน (Authenticated User เท่านั้น)
 * - ตรวจสอบความถูกต้องของ recommendationId (UUID)
 * - อัปเดตสถิติแบบ Idempotent
 */
export const recordRecommendationClick = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. ตรวจสอบการยืนยันตัวตนของผู้ใช้งาน
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    // 2. ตรวจสอบความถูกต้องของ URL Parameter (:recommendationId)
    const parseResult = recommendationTrackingParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
      sendError(res, errorMessage || 'รหัสคำแนะนำไม่ถูกต้อง', 400, parseResult.error.format());
      return;
    }

    const { recommendationId } = parseResult.data;

    // 3. บันทึก Click Event ในฐานข้อมูล
    const result = await recommendationTrackingService.recordRecommendationClick(
      userId,
      recommendationId
    );

    sendSuccess(res, result, result.message);
  } catch (error: any) {
    if (error instanceof RecommendationTrackingError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('[RecommendationController] recordRecommendationClick error:', error?.message);
    sendError(res, 'เกิดข้อผิดพลาดในการบันทึกสถิติการคลิก', 500);
  }
};
