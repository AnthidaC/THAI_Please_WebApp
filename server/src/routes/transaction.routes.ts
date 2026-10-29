import { Router } from 'express';
import {
  getBuyerHistory,
  getMerchantHistory,
  getTransactionSlip,
} from '../controllers/transaction.controller';
import { authenticatePaymentSession as authenticate, requirePaymentMerchant } from '../middlewares/payment-access.middleware';
import { requireCitizen } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/transactions/buyer/history
router.get('/buyer/history', authenticate, requireCitizen, getBuyerHistory);

// GET /api/transactions/merchant/history
router.get('/merchant/history', authenticate, requirePaymentMerchant, getMerchantHistory);

// GET /api/transactions/:id/slip
router.get('/:id/slip', authenticate, requireCitizen, getTransactionSlip);

export default router;
