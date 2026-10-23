import { Router } from 'express';
import {
  getFraudAlerts,
  getFraudDossiers,
  resolveDossier,
  resolveFraudAlert,
} from '../controllers/fraud.controller';
import { authenticate, requireStaff } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  resolveFraudAlertSchema,
  resolveDossierSchema,
} from '../validations/payment.validation';

const router = Router();

// GET /api/fraud/dossiers (สรุปแฟ้มคดีระดับ User / Merchant พร้อมระบบกรองสัญญาณรบกวน 0-Noise)
router.get('/dossiers', authenticate, requireStaff, getFraudDossiers);

// POST /api/fraud/dossier/resolve (จัดการแฟ้มคดีระดับบุคคล/ร้านค้าแบบ Batch 1-Click)
router.post(
  '/dossier/resolve',
  authenticate,
  requireStaff,
  validate(resolveDossierSchema),
  resolveDossier
);

// GET /api/fraud/alerts
router.get('/alerts', authenticate, requireStaff, getFraudAlerts);

// POST /api/fraud/resolve/:id
router.post(
  '/resolve/:id',
  authenticate,
  requireStaff,
  validate(resolveFraudAlertSchema),
  resolveFraudAlert
);

export default router;
