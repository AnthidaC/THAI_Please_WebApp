import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authLogin, demoLogin, getMe, listDemoAdmins, listDemoCitizens, listDemoMerchants, registerCitizenController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { authLoginSchema, citizenRegisterSchema, demoLoginSchema } from '../validations/auth.validation';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';

const router = Router();
export const authLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

export const citizenRegisterRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

export const developmentOnlyDemoLogin = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV !== 'development') {
    res.sendStatus(404);
    return;
  }
  next();
};

router.post('/login', authLoginRateLimit, validate(authLoginSchema), authLogin);
router.post('/register-citizen', citizenRegisterRateLimit, validate(citizenRegisterSchema), registerCitizenController);
router.get('/demo-citizens', developmentOnlyDemoLogin, listDemoCitizens);
router.get('/demo-merchants', developmentOnlyDemoLogin, listDemoMerchants);
router.get('/demo-admins', developmentOnlyDemoLogin, listDemoAdmins);
router.post('/demo-login', developmentOnlyDemoLogin, validate(demoLoginSchema), demoLogin);
router.get('/me', authenticate, requireCitizen, getMe);

export default router;
