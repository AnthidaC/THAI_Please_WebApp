import { Router } from 'express';
import {
  generateDynamicQr,
  getQrDetails,
  checkoutCopay,
  validateDiscount,
} from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  generateQrSchema,
  checkoutCopaySchema,
  validateDiscountSchema,
} from '../validations/payment.validation';

const router = Router();

// POST /api/payment/qr/generate
router.post('/qr/generate', validate(generateQrSchema), generateDynamicQr);

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
