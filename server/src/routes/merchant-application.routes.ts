import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  decideMerchantApplication,
  getMerchantApplication,
  listMerchantApplications,
  loginMerchant,
  submitMerchantApplication,
} from '../controllers/merchantApplication.controller';
import { authenticate, requireStaff } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { merchantDocumentUpload } from '../middlewares/merchant-document-upload.middleware';
import {
  merchantApplicationDecisionSchema,
  merchantApplicationSchema,
  merchantLoginSchema,
} from '../validations/merchant-application.validation';

const router = Router();
const applicationSubmissionLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimit, validate(merchantLoginSchema), loginMerchant);
router.post('/applications', applicationSubmissionLimit, merchantDocumentUpload, validate(merchantApplicationSchema), submitMerchantApplication);
router.get('/applications', authenticate, requireStaff, listMerchantApplications);
router.get('/applications/:id', authenticate, requireStaff, getMerchantApplication);
router.patch(
  '/applications/:id/decision',
  authenticate,
  requireStaff,
  validate(merchantApplicationDecisionSchema),
  decideMerchantApplication
);

export default router;
