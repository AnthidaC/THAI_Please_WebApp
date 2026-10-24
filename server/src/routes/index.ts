import { Router } from 'express';
import authRoutes from './auth.routes';
import walletRoutes from './wallet.routes';
import paymentRoutes from './payment.routes';
import transactionRoutes from './transaction.routes';
import fraudRoutes from './fraud.routes';
import gamificationRoutes from './gamification.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount modules
router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/payment', paymentRoutes);
router.use('/transactions', transactionRoutes);
router.use('/fraud', fraudRoutes);
router.use('/', gamificationRoutes);

export default router;
