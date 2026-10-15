import { Router } from 'express';
import { getWalletBalance, topUpWallet } from '../controllers/wallet.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { topUpWalletSchema } from '../validations/payment.validation';

const router = Router();

// GET /api/wallet/balance
router.get('/balance', authenticate, getWalletBalance);

// POST /api/wallet/top-up
router.post('/top-up', authenticate, validate(topUpWalletSchema), topUpWallet);

export default router;
