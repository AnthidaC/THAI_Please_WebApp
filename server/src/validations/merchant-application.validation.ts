import { z } from 'zod';

export const merchantApplicationSchema = z.object({
  businessType: z.enum(['INDIVIDUAL', 'JURISTIC']),
  taxId: z.string().regex(/^\d{13}$/, 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก'),
  businessName: z.string().trim().min(2).max(100),
  contactName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(9).max(30),
  password: z.string().min(12).max(128),
  address: z.string().trim().min(8).max(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const merchantLoginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const merchantApplicationDecisionSchema = z.object({
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

export const staffLoginSchema = merchantLoginSchema;

export type MerchantApplicationInput = z.infer<typeof merchantApplicationSchema>;
