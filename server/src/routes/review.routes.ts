import { Router } from 'express';
import { submitReview } from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createReviewSchema } from '../validations/review.validation';

const router = Router();

router.post('/', authenticate, validate(createReviewSchema), submitReview);

export default router;
