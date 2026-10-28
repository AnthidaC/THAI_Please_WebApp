import { Router } from 'express';
import { demoLogin, getMe } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { demoLoginSchema } from '../validations/auth.validation';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';
import { env } from '../config/env';

const router = Router();

if (env.NODE_ENV === 'development' && env.DEMO_AUTH_ENABLED) {
  router.post('/demo-login', validate(demoLoginSchema), demoLogin);
}
router.get('/me', authenticate, requireCitizen, getMe);

export default router;
