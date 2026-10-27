import { z } from 'zod';

export const createReviewSchema = z.object({
  transactionId: z.string().uuid(),
  ratingStars: z.coerce.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).nullable().optional(),
}).strict();
