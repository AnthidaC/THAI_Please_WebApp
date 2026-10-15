import { Router } from 'express';
import {
  getFraudAlerts,
  resolveFraudAlert,
} from '../controllers/fraud.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { resolveFraudAlertSchema } from '../validations/payment.validation';

const router = Router();

// GET /api/fraud/alerts
router.get('/alerts', authenticate, getFraudAlerts);

// POST /api/fraud/resolve/:id
router.post(
  '/resolve/:id',
  authenticate,
  validate(resolveFraudAlertSchema),
  resolveFraudAlert
);

export default router;
