import { Router } from 'express';
import authRoutes from './auth.routes';
import walletRoutes from './wallet.routes';
import paymentRoutes from './payment.routes';
import transactionRoutes from './transaction.routes';
import fraudRoutes from './fraud.routes';
import gamificationRoutes from './gamification.routes';
import reviewRoutes from './review.routes';
import recommendationRoutes from './recommendation.routes';
import preferenceRoutes from './preference.routes';
import referralRoutes from './referral.routes';
import geoRoutes from './geo.routes';
import merchantApplicationRoutes from './merchant-application.routes';
import socialImpactRoutes from './social-impact.routes';
import staffRoutes from './staff.routes';

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
router.use('/reviews', reviewRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/preferences', preferenceRoutes);
router.use('/referrals', referralRoutes);
router.use('/geo', geoRoutes);
router.use('/merchant-applications', merchantApplicationRoutes);
router.use('/merchant', merchantApplicationRoutes);
router.use('/admin/social-impact', socialImpactRoutes);
router.use('/staff', staffRoutes);

// ต้องอยู่ท้ายสุดเสมอ: mount ที่ '/' จะรับทุก path ที่ยังไม่ถูกจับก่อนหน้า
router.use('/', gamificationRoutes);

export default router;