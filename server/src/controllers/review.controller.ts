import { Request, Response } from 'express';
import {
  ReviewServiceError,
  createReview,
  getReviewByTransactionId,
  getUserReviews,
  getMerchantReviews as fetchMerchantReviews,
} from '../services/review.service';
import {
  merchantIdParamSchema,
  getMerchantReviewsQuerySchema,
  transactionIdParamSchema,
} from '../validations/review.validation';
import { sendError, sendSuccess } from '../utils/response';

/**
 * Controller สำหรับส่งรีวิวร้านค้า (Authenticated)
 * POST /api/reviews
 */
export const submitReview = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const review = await createReview(userId, req.body);
    sendSuccess(res, review, 'Review saved', 201);
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('Failed to save review', error);
    sendError(res, 'Unable to save review', 500);
  }
};

/**
 * Controller สำหรับตรวจสอบและดึงข้อมูลรีวิวของธุรกรรม (Authenticated)
 * GET /api/reviews/transaction/:transactionId
 */
export const getReviewByTransaction = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const paramResult = transactionIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      const errorMessage = paramResult.error.issues.map((e) => e.message).join(', ');
      sendError(res, errorMessage || 'รูปแบบรหัสธุรกรรมไม่ถูกต้อง', 400);
      return;
    }

    const { transactionId } = paramResult.data;
    const result = await getReviewByTransactionId(userId, transactionId);
    sendSuccess(
      res,
      result,
      result.reviewed ? 'ดึงข้อมูลการประเมินรีวิวสำเร็จ' : 'ยังไม่มีการประเมินรีวิวสำหรับธุรกรรมนี้'
    );
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('Failed to get transaction review', error);
    sendError(res, 'ไม่สามารถดึงข้อมูลรีวิวได้', 500);
  }
};

/**
 * Controller สำหรับดึงรายการรีวิวทั้งหมดของผู้ใช้งานปัจจุบัน (Authenticated)
 * GET /api/reviews/my-reviews
 */
export const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const reviews = await getUserReviews(userId);
    sendSuccess(res, reviews, 'ดึงประวัติการประเมินรีวิวสำเร็จ');
  } catch (error) {
    console.error('Failed to get user reviews', error);
    sendError(res, 'ไม่สามารถดึงประวัติการประเมินรีวิวได้', 500);
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
      const errorMessage = paramResult.error.issues.map((e) => e.message).join(', ');
      sendError(res, errorMessage || 'รหัสร้านค้าไม่ถูกต้อง', 400);
      return;
    }

    const { merchantId } = paramResult.data;
    const queryResult = getMerchantReviewsQuerySchema.safeParse(req.query);
    const { page, limit } = queryResult.success ? queryResult.data : { page: 1, limit: 10 };

    const result = await fetchMerchantReviews(merchantId, page, limit);
    sendSuccess(res, result, 'ดึงข้อมูลรีวิวร้านค้าสำเร็จ');
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('Failed to get merchant reviews', error);
    sendError(res, 'ไม่สามารถดึงข้อมูลรีวิวร้านค้าได้', 500);
  }
};
