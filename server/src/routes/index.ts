import { Router } from 'express';
import authRoutes from './auth.routes';
import walletRoutes from './wallet.routes';
import paymentRoutes from './payment.routes';
import transactionRoutes from './transaction.routes';
import fraudRoutes from './fraud.routes';
import merchantApplicationRoutes from './merchant-application.routes';
import staffRoutes from './staff.routes';
import socialImpactRoutes from './social-impact.routes';
import { getSocialImpactDashboard } from '../controllers/socialImpact.controller';
import { authenticate, requireGovernmentExecutive } from '../middlewares/auth.middleware';

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
router.use('/merchant', merchantApplicationRoutes);
router.use('/staff', staffRoutes);
router.use('/admin/social-impact', socialImpactRoutes);
router.get('/v1/dashboard', authenticate, requireGovernmentExecutive, getSocialImpactDashboard);

export default router;
