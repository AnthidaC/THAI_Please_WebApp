import { Router } from 'express';
import {
  generateDynamicQr,
  getQrDetails,
  getQrPaymentStatus,
  streamQrPaymentStatus,
  streamMerchantPayments,
  checkoutCopay,
  validateDiscount,
} from '../controllers/payment.controller';
import { authenticatePaymentSession as authenticate, requirePaymentMerchant } from '../middlewares/payment-access.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  generateQrSchema,
  checkoutCopaySchema,
  validateDiscountSchema,
} from '../validations/payment.validation';

const router = Router();

// POST /api/payment/qr/generate
router.post('/qr/generate', authenticate, requirePaymentMerchant, validate(generateQrSchema), generateDynamicQr);

// GET /api/payment/merchant/stream (Server-Sent Events: แจ้งเตือนร้านค้าแบบครอบคลุมทั้งร้าน รองรับการสร้าง QR ต่อเนื่อง)
router.get('/merchant/stream', authenticate, requirePaymentMerchant, streamMerchantPayments);

// GET /api/payment/qr/:reference/stream (Server-Sent Events: แจ้งเตือน POS ร้านค้าแบบ Real-Time ทันที 0 ms)
router.get('/qr/:reference/stream', authenticate, requirePaymentMerchant, streamQrPaymentStatus);

// GET /api/payment/qr/:reference/status (สำหรับร้านค้าตรวจสอบสถานะการชำระเงินแบบ Real-time Polling Fallback)
router.get('/qr/:reference/status', authenticate, requirePaymentMerchant, getQrPaymentStatus);

// GET /api/payment/qr/:reference
router.get('/qr/:reference', authenticate, getQrDetails);


// POST /api/payment/discount/validate
router.post(
  '/discount/validate',
  authenticate,
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
