import { Router } from 'express';
import {
  submitReview,
  getMerchantReviews,
  getReviewByTransaction,
  getMyReviews,
} from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createReviewSchema } from '../validations/review.validation';

const router = Router();

// POST /api/reviews - ส่งรีวิวร้านค้า (Authenticated)
router.post('/', authenticate, validate(createReviewSchema), submitReview);

// GET /api/reviews/my-reviews - ดึงประวัติรีวิวของผู้ใช้งานปัจจุบัน (Authenticated)
router.get('/my-reviews', authenticate, getMyReviews);

// GET /api/reviews/transaction/:transactionId - ดึงข้อมูลรีวิวของธุรกรรม (Authenticated)
router.get('/transaction/:transactionId', authenticate, getReviewByTransaction);

// GET /api/reviews/merchant/:merchantId - ดึงรายการรีวิวและสถิติของร้านค้า (Public)
router.get('/merchant/:merchantId', getMerchantReviews);

export default router;
