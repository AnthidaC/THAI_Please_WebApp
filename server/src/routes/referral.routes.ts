import { Router } from 'express';
import {
  getMyReferralCode,
  getReferralStats,
  validateReferralCode,
} from '../controllers/referral.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { optionalAuthenticate } from './recommendation.routes';

const router = Router();

// GET /api/referrals/my-code - ดึงหรือสร้างรหัสแนะนำเพื่อนของตนเอง (Authenticated)
router.get('/my-code', authenticate, getMyReferralCode);

// GET /api/referrals/stats - ดึงสถิติคำชวนเพื่อนและยอดประหยัดสะสม (Authenticated)
router.get('/stats', authenticate, getReferralStats);

// GET /api/referrals/validate/:code - ตรวจสอบรหัสแนะนำเพื่อน (รองรับทั้ง Guest และ Authenticated User)
router.get('/validate/:code', optionalAuthenticate, validateReferralCode);

export default router;
