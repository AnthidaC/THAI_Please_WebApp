import { z } from 'zod';

export const createReviewSchema = z.object({
  transactionId: z.string().uuid('รูปแบบรหัสธุรกรรมไม่ถูกต้อง (ต้องเป็น UUID)'),
  ratingStars: z
    .number({ required_error: 'กรุณาระบุคะแนนดาว' })
    .int('คะแนนดาวต้องเป็นจำนวนเต็ม')
    .min(1, 'คะแนนดาวต้องไม่ต่ำกว่า 1 ดาว')
    .max(5, 'คะแนนดาวต้องไม่เกิน 5 ดาว'),
  reviewText: z
    .string()
    .max(1000, 'ข้อความรีวิวต้องไม่เกิน 1,000 ตัวอักษร')
    .optional()
    .nullable(),
});

export const merchantIdParamSchema = z.object({
  merchantId: z.string().uuid('รูปแบบรหัสร้านค้าไม่ถูกต้อง (ต้องเป็น UUID)'),
});

export const getMerchantReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type MerchantIdParam = z.infer<typeof merchantIdParamSchema>;
export type GetMerchantReviewsQuery = z.infer<typeof getMerchantReviewsQuerySchema>;
