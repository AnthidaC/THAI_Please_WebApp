import { Router } from 'express';
import {
  getBuyerHistory,
  getMerchantHistory,
  getTransactionSlip,
} from '../controllers/transaction.controller';
import { authenticatePaymentSession as authenticate, requirePaymentMerchant } from '../middlewares/payment-access.middleware';

const router = Router();

// GET /api/transactions/buyer/history
router.get('/buyer/history', authenticate, getBuyerHistory);

// GET /api/transactions/merchant/history
router.get('/merchant/history', authenticate, requirePaymentMerchant, getMerchantHistory);

// GET /api/transactions/:id/slip
router.get('/:id/slip', authenticate, getTransactionSlip);

export default router;
