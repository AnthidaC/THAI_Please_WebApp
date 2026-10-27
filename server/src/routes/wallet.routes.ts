import { Router } from 'express';
import {
  getWalletBalance,
  topUpWallet,
  enrollInCampaign,
} from '../controllers/wallet.controller';
import { authenticatePaymentSession as authenticate } from '../middlewares/payment-access.middleware';
import { getPaymentPinStatus, setPaymentPin } from '../controllers/payment-pin.controller';
import { validate } from '../middlewares/validate.middleware';
import { topUpWalletSchema, setPaymentPinSchema } from '../validations/payment.validation';

const router = Router();

router.get('/pin/status', authenticate, getPaymentPinStatus);
router.put('/pin', authenticate, validate(setPaymentPinSchema), setPaymentPin);

// GET /api/wallet/balance
router.get('/balance', authenticate, getWalletBalance);

// POST /api/wallet/top-up
router.post('/top-up', authenticate, validate(topUpWalletSchema), topUpWallet);

// POST /api/wallet/enroll (ลงทะเบียนขอรับสิทธิ์ Co-pay ในโครงการที่เปิดรับสมัครใน DB)
router.post('/enroll', authenticate, enrollInCampaign);

export default router;
