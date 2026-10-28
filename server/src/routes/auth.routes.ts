import { Router } from 'express';
import { demoCitizenLogin, getMe } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { demoCitizenLoginSchema } from '../validations/auth.validation';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';
import { env } from '../config/env';

const router = Router();

if (env.NODE_ENV === 'development' && env.DEMO_CITIZEN_AUTH_ENABLED) {
  router.post('/demo-citizen-login', validate(demoCitizenLoginSchema), demoCitizenLogin);
}
router.get('/me', authenticate, requireCitizen, getMe);

export default router;
