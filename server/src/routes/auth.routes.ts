import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authLogin, demoLogin, getMe, listDemoMerchants } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { authLoginSchema, demoLoginSchema } from '../validations/auth.validation';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';

const router = Router();
export const authLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
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
router.get('/demo-merchants', developmentOnlyDemoLogin, listDemoMerchants);
router.post('/demo-login', developmentOnlyDemoLogin, validate(demoLoginSchema), demoLogin);
router.get('/me', authenticate, requireCitizen, getMe);

export default router;
