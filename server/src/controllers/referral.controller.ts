import { Request, Response } from 'express';
import { referralService, ReferralError } from '../services/referral.service';
import { sendSuccess, sendError } from '../utils/response';

/**
 * ดึงรายการร้านค้าที่ผู้ใช้งานปัจจุบันเคยชำระเงินสำเร็จ (Eligible for Referrals)
 * GET /api/referrals/eligible-merchants
 */
export const getEligibleMerchants = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const merchants = await referralService.getEligibleMerchantsForUser(userId);
    sendSuccess(res, merchants, 'ดึงรายการร้านค้าที่สามารถแนะนำเพื่อนได้สำเร็จ');
  } catch (error: any) {
    if (error instanceof ReferralError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถดึงรายการร้านค้าได้', 500);
  }
};

/**
 * ดึงหรือสร้างรหัสแนะนำเพื่อนสำหรับร้านค้าที่เลือก (Authenticated)
 * GET /api/referrals/my-code
 */
export const getMyReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const merchantId = req.query.merchantId as string | undefined;
    const customCode = req.query.customCode as string | undefined;

    let targetMerchantId = merchantId;

    // หากไม่ระบุ ให้หาร้านแรกที่ผู้ใช้เคยชำระเงินสำเร็จ
    if (!targetMerchantId) {
      const eligible = await referralService.getEligibleMerchantsForUser(userId);
      if (eligible.length === 0) {
        sendError(
          res,
          'คุณยังไม่เคยชำระเงินสำเร็จที่ร้านค้าใดในโครงการ กรุณาใช้สิทธิ์ชำระเงินที่ร้านค้าก่อนเพื่อปลดล็อกการชวนเพื่อน',
          400
        );
        return;
      }
      targetMerchantId = eligible[0].merchantId;
    }

    const result = await referralService.getOrCreateMyReferralCode(userId, {
      merchantId: targetMerchantId,
      customCode,
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
 * ดึงสถิติ Dashboard การแนะนำเพื่อน (Authenticated)
 * GET /api/referrals/stats
 */
export const getReferralStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const merchantId = req.query.merchantId as string | undefined;
    const result = await referralService.getReferralStats(userId, merchantId);
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

/**
 * บันทึก Conversion ของ Referral (Integration Hook)
 * POST /api/referrals/convert
 */
export const convertReferral = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const { referralCode, merchantId, transactionId } = req.body;

    const result = await referralService.processReferralConversion({
      referralCode,
      refereeUserId: userId,
      merchantId,
      transactionId,
    });

    sendSuccess(res, result, 'บันทึกการแนะนำเพื่อนสำเร็จ');
  } catch (error: any) {
    if (error instanceof ReferralError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถประมวลผลการแนะนำเพื่อนได้', 500);
  }
};
