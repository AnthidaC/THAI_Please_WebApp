import { Router } from 'express';
import { demoLogin, getMe, listDemoMerchants } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { demoLoginSchema } from '../validations/auth.validation';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';

const router = Router();

router.get('/demo-merchants', listDemoMerchants);
router.post('/demo-login', validate(demoLoginSchema), demoLogin);
router.get('/me', authenticate, requireCitizen, getMe);

export default router;
