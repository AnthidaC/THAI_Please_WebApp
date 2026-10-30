import { z } from 'zod';

export const merchantProfileSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  contactName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(9).max(30),
  address: z.string().trim().min(8).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const merchantLocationDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.action === 'REJECT' && (!value.note || value.note.length < 10)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['note'],
      message: 'กรุณาระบุเหตุผลในการปฏิเสธอย่างน้อย 10 ตัวอักษร',
    });
  }
});

export type MerchantProfileInput = z.infer<typeof merchantProfileSchema>;
