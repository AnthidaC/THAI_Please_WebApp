import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  decideMerchantLocationChange,
  getMerchantProfileByStaff,
  listApprovedMerchants,
  listPendingMerchantLocationChanges,
  loginStaff,
  updateMerchantProfileByStaff,
} from '../controllers/merchantApplication.controller';
import { authenticate, requireStaff } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { staffLoginSchema } from '../validations/merchant-application.validation';
import { merchantLocationDecisionSchema, merchantProfileSchema } from '../validations/merchant-profile.validation';

const router = Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimit, validate(staffLoginSchema), loginStaff);
router.get('/merchants', authenticate, requireStaff, listApprovedMerchants);
router.get('/merchants/:id/profile', authenticate, requireStaff, getMerchantProfileByStaff);
router.patch('/merchants/:id/profile', authenticate, requireStaff, validate(merchantProfileSchema), updateMerchantProfileByStaff);
router.get('/merchant-location-requests', authenticate, requireStaff, listPendingMerchantLocationChanges);
router.patch(
  '/merchant-location-requests/:id/decision',
  authenticate,
  requireStaff,
  validate(merchantLocationDecisionSchema),
  decideMerchantLocationChange
);

export default router;
