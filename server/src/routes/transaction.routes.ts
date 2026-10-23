import { Router } from 'express';
import {
  getBuyerHistory,
  getMerchantHistory,
  getTransactionSlip,
} from '../controllers/transaction.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/transactions/buyer/history
router.get('/buyer/history', authenticate, getBuyerHistory);

// GET /api/transactions/merchant/history
router.get('/merchant/history', getMerchantHistory);

// GET /api/transactions/:id/slip
router.get('/:id/slip', getTransactionSlip);

export default router;
