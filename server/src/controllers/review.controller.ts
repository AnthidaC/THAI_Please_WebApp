import { Request, Response } from 'express';
import { reviewService, ReviewError } from '../services/review.service';
import {
  merchantIdParamSchema,
  getMerchantReviewsQuerySchema,
  transactionIdParamSchema,
} from '../validations/review.validation';
import { sendSuccess, sendError } from '../utils/response';

/**
 * Controller สำหรับส่งรีวิวร้านค้า (Authenticated)
 * POST /api/reviews
 */
export const submitReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการรีวิว', 401);
      return;
    }

    const result = await reviewService.submitReview(userId, req.body);
    sendSuccess(res, result, 'บันทึกการประเมินรีวิวสำเร็จ', 201);
  } catch (error: any) {
    if (error instanceof ReviewError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการบันทึกรีวิว', 500);
  }
};

/**
 * Controller สำหรับดึงรายการรีวิวของร้านค้า (Public)
 * GET /api/reviews/merchant/:merchantId
 */
export const getMerchantReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramResult = merchantIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.errors.map((e) => e.message).join(', ');
      sendError(res, errorMessage || 'รหัสร้านค้าไม่ถูกต้อง', 400, paramResult.error.format());
      return;
    }

    const { merchantId } = paramResult.data;

    const queryResult = getMerchantReviewsQuerySchema.safeParse(req.query);
    const { page, limit } = queryResult.success ? queryResult.data : { page: 1, limit: 10 };

    const result = await reviewService.getMerchantReviews(merchantId, page, limit);
    sendSuccess(res, result, 'ดึงข้อมูลรีวิวร้านค้าสำเร็จ');
  } catch (error: any) {
    if (error instanceof ReviewError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลรีวิวร้านค้าได้', 500);
  }
};

/**
 * Controller สำหรับตรวจสอบและดึงข้อมูลรีวิวของธุรกรรม (Authenticated)
 * GET /api/reviews/transaction/:transactionId
 */
export const getReviewByTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const paramResult = transactionIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.errors.map((e) => e.message).join(', ');
      sendError(res, errorMessage || 'รูปแบบรหัสธุรกรรมไม่ถูกต้อง', 400, paramResult.error.format());
      return;
    }

    const { transactionId } = paramResult.data;
    const result = await reviewService.getReviewByTransactionId(userId, transactionId);
    sendSuccess(
      res,
      result,
      result.reviewed ? 'ดึงข้อมูลการประเมินรีวิวสำเร็จ' : 'ยังไม่มีการประเมินรีวิวสำหรับธุรกรรมนี้'
    );
  } catch (error: any) {
    if (error instanceof ReviewError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลรีวิวได้', 500);
  }
};

/**
 * Controller สำหรับดึงรายการรีวิวทั้งหมดของผู้ใช้งานปัจจุบัน (Authenticated)
 * GET /api/reviews/my-reviews
 */
export const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const reviews = await reviewService.getUserReviews(userId);
    sendSuccess(res, reviews, 'ดึงประวัติการประเมินรีวิวสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดึงประวัติการประเมินรีวิวได้', 500);
  }
};
