import { Router } from 'express';
import {
  getWalletBalance,
  topUpWallet,
  enrollInCampaign,
} from '../controllers/wallet.controller';
import { authenticatePaymentSession as authenticate } from '../middlewares/payment-access.middleware';
import { getPaymentPinStatus, setPaymentPin, resetPaymentPin } from '../controllers/payment-pin.controller';
import { validate } from '../middlewares/validate.middleware';
import { topUpWalletSchema, setPaymentPinSchema, resetPaymentPinSchema } from '../validations/payment.validation';

const router = Router();

router.get('/pin/status', authenticate, getPaymentPinStatus);
router.put('/pin', authenticate, validate(setPaymentPinSchema), setPaymentPin);
// ลืม PIN: อนุญาตเฉพาะ session ที่เพิ่งเข้าสู่ระบบใหม่ (ตรวจใน service)
router.post('/pin/reset', authenticate, validate(resetPaymentPinSchema), resetPaymentPin);

// GET /api/wallet/balance
router.get('/balance', authenticate, getWalletBalance);

// POST /api/wallet/top-up
router.post('/top-up', authenticate, validate(topUpWalletSchema), topUpWallet);

// POST /api/wallet/enroll (ลงทะเบียนขอรับสิทธิ์ Co-pay ในโครงการที่เปิดรับสมัครใน DB)
router.post('/enroll', authenticate, enrollInCampaign);

export default router;
