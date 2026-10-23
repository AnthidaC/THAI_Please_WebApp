import { Router } from 'express';
import {
  generateDynamicQr,
  getQrDetails,
  getQrPaymentStatus,
  streamQrPaymentStatus,
  checkoutCopay,
  validateDiscount,
} from '../controllers/payment.controller';
import { authenticate, requireApprovedMerchant } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  generateQrSchema,
  checkoutCopaySchema,
  validateDiscountSchema,
} from '../validations/payment.validation';

const router = Router();

// POST /api/payment/qr/generate
router.post('/qr/generate', authenticate, requireApprovedMerchant, validate(generateQrSchema), generateDynamicQr);

// GET /api/payment/qr/:reference/stream (Server-Sent Events: แจ้งเตือน POS ร้านค้าแบบ Real-Time ทันที 0 ms)
router.get('/qr/:reference/stream', authenticate, requireApprovedMerchant, streamQrPaymentStatus);

// GET /api/payment/qr/:reference/status (สำหรับร้านค้าตรวจสอบสถานะการชำระเงินแบบ Real-time Polling Fallback)
router.get('/qr/:reference/status', authenticate, requireApprovedMerchant, getQrPaymentStatus);

// GET /api/payment/qr/:reference
router.get('/qr/:reference', getQrDetails);


// POST /api/payment/discount/validate
router.post(
  '/discount/validate',
  validate(validateDiscountSchema),
  validateDiscount
);

// POST /api/payment/qr/checkout
router.post(
  '/qr/checkout',
  authenticate,
  validate(checkoutCopaySchema),
  checkoutCopay
);

export default router;
