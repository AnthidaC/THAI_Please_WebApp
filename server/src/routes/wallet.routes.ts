import { Router } from 'express';
import {
  getWalletBalance,
  topUpWallet,
  enrollInCampaign,
} from '../controllers/wallet.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { topUpWalletSchema } from '../validations/payment.validation';

const router = Router();

// GET /api/wallet/balance
router.get('/balance', authenticate, getWalletBalance);

// POST /api/wallet/top-up
router.post('/top-up', authenticate, validate(topUpWalletSchema), topUpWallet);

// POST /api/wallet/enroll (ลงทะเบียนขอรับสิทธิ์ Co-pay ในโครงการที่เปิดรับสมัครใน DB)
router.post('/enroll', authenticate, enrollInCampaign);

export default router;
