import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { citizenAuthSchema, citizenLoginSchema } from '../validations/auth.validation';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validate(citizenAuthSchema), register);
router.post('/login', validate(citizenLoginSchema), login);
router.get('/me', authenticate, getMe);

export default router;
