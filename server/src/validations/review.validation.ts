import { z } from 'zod';

export const createReviewSchema = z.object({
  transactionId: z.string().uuid(),
  ratingStars: z.coerce.number().int().min(1).max(5),
  reviewText: z.string().trim().max(2000).nullable().optional(),
  isAnonymous: z.boolean().optional().default(false),
}).strict();

export const merchantIdParamSchema = z.object({
  merchantId: z.string().uuid(),
});

export const getMerchantReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const transactionIdParamSchema = z.object({
  transactionId: z.string().uuid(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type MerchantIdParam = z.infer<typeof merchantIdParamSchema>;
export type TransactionIdParam = z.infer<typeof transactionIdParamSchema>;
export type GetMerchantReviewsQuery = z.infer<typeof getMerchantReviewsQuerySchema>;
