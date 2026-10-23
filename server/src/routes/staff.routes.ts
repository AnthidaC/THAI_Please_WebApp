import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginStaff } from '../controllers/merchantApplication.controller';
import { validate } from '../middlewares/validate.middleware';
import { staffLoginSchema } from '../validations/merchant-application.validation';

const router = Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimit, validate(staffLoginSchema), loginStaff);

export default router;
