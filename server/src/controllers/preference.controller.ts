import { Request, Response } from 'express';
import { preferenceService, PreferenceError } from '../services/preference.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * ดึงรายการหมวดหมู่ความสนใจของผู้ใช้งานปัจจุบัน (Authenticated)
 * GET /api/preferences
 */
export const getPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const result = await preferenceService.getUserPreferences(userId);
    sendSuccess(res, result, 'ดึงข้อมูลหมวดหมู่ความสนใจสำเร็จ');
  } catch (error: any) {
    if (error instanceof PreferenceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลหมวดหมู่ความสนใจได้', 500);
  }
};

/**
 * บันทึกหรือปรับปรุงรายการหมวดหมู่ความสนใจของผู้ใช้งาน (Authenticated)
 * PUT /api/preferences
 */
export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const result = await preferenceService.updateUserPreferences(userId, req.body);
    sendSuccess(res, result, 'บันทึกข้อมูลหมวดหมู่ความสนใจสำเร็จ');
  } catch (error: any) {
    if (error instanceof PreferenceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถบันทึกข้อมูลหมวดหมู่ความสนใจได้', 500);
  }
};
