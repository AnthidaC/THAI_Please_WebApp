import { Request, Response } from 'express';
import { referralService, ReferralError } from '../services/referral.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * ดึงหรือสร้างรหัสแนะนำเพื่อนของตนเอง (Authenticated)
 * GET /api/referrals/my-code
 */
export const getMyReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const customCode = req.query.customCode as string | undefined;
    const merchantId = req.query.merchantId as string | undefined;

    const result = await referralService.getOrCreateMyReferralCode(userId, {
      customCode,
      merchantId,
    });
    sendSuccess(res, result, 'ดึงรหัสแนะนำเพื่อนสำเร็จ');
  } catch (error: any) {
    if (error instanceof ReferralError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถดึงรหัสแนะนำเพื่อนได้', 500);
  }
};

/**
 * ดึงสถิติ Dashboard การแนะนำเพื่อนและรายชื่อเพื่อนที่ชวน (Authenticated)
 * GET /api/referrals/stats
 */
export const getReferralStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const result = await referralService.getReferralStats(userId);
    sendSuccess(res, result, 'ดึงสถิติการแนะนำเพื่อนสำเร็จ');
  } catch (error: any) {
    if (error instanceof ReferralError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถดึงสถิติการแนะนำเพื่อนได้', 500);
  }
};

/**
 * ตรวจสอบความถูกต้องของรหัสแนะนำเพื่อน (Public / Authenticated)
 * GET /api/referrals/validate/:code
 */
export const validateReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    if (!code) {
      sendError(res, 'กรุณาระบุรหัสแนะนำเพื่อน', 400);
      return;
    }

    const currentUserId = req.user?.userId;
    const merchantId = req.query.merchantId as string | undefined;

    const result = await referralService.validateReferralCode(code, currentUserId, merchantId);
    sendSuccess(res, result, 'รหัสแนะนำเพื่อนถูกต้องพร้อมใช้งาน');
  } catch (error: any) {
    if (error instanceof ReferralError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถตรวจสอบรหัสแนะนำเพื่อนได้', 500);
  }
};
