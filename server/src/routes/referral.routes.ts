import { Router } from 'express';
import {
  getEligibleMerchants,
  getMyReferralCode,
  getReferralStats,
  validateReferralCode,
  convertReferral,
} from '../controllers/referral.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { optionalAuthenticate } from './recommendation.routes';
import { validate } from '../middlewares/validate.middleware';
import { convertReferralSchema } from '../validations/referral.validation';

const router = Router();

// GET /api/referrals/eligible-merchants - ดึงร้านค้าที่ผู้ใช้เคยชำระเงินสำเร็จ (Authenticated)
router.get('/eligible-merchants', authenticate, getEligibleMerchants);

// GET /api/referrals/my-code - ดึงหรือสร้างรหัสแนะนำเพื่อนสำหรับร้านค้าที่กำหนด (Authenticated)
router.get('/my-code', authenticate, getMyReferralCode);

// GET /api/referrals/stats - ดึงสถิติคำชวนเพื่อนและไมล์สโตน (Authenticated)
router.get('/stats', authenticate, getReferralStats);

// GET /api/referrals/validate/:code - ตรวจสอบรหัสแนะนำเพื่อน (Guest หรือ Authenticated)
router.get('/validate/:code', optionalAuthenticate, validateReferralCode);

// POST /api/referrals/convert - บันทึกการใช้งานคำชวนและแจกรางวัล (Integration/Authenticated)
router.post('/convert', authenticate, validate(convertReferralSchema), convertReferral);

export default router;
