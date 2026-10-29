import { z } from 'zod';

export const validateReferralCodeParamSchema = z.object({
  code: z
    .string({ required_error: 'กรุณาระบุรหัสแนะนำเพื่อน' })
    .trim()
    .min(3, 'รหัสแนะนำเพื่อนต้องมีอย่างน้อย 3 ตัวอักษร')
    .max(50, 'รหัสแนะนำเพื่อนต้องไม่เกิน 50 ตัวอักษร')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'รหัสแนะนำเพื่อนต้องประกอบด้วยตัวอักษร ตัวเลข หรือเครื่องหมาย _ และ - เท่านั้น'
    ),
});

export const validateReferralCodeQuerySchema = z.object({
  merchantId: z.string().uuid('รหัสร้านค้าต้องเป็น UUID ที่ถูกต้อง').optional(),
});

export const createCustomReferralCodeSchema = z.object({
  customCode: z
    .string()
    .trim()
    .min(4, 'รหัสที่กำหนดเองต้องมีความยาวอย่างน้อย 4 ตัวอักษร')
    .max(20, 'รหัสที่กำหนดเองต้องไม่เกิน 20 ตัวอักษร')
    .regex(/^[A-Z0-9_-]+$/, 'รหัสต้องเป็นตัวอักษรภาษาอังกฤษพิมพ์ใหญ่และตัวเลขเท่านั้น')
    .optional(),
  merchantId: z.string().uuid('รหัสร้านค้าต้องเป็น UUID ที่ถูกต้อง'),
});

export const getMyReferralCodeQuerySchema = z.object({
  merchantId: z.string().uuid('รหัสร้านค้าต้องเป็น UUID ที่ถูกต้อง').optional(),
});

export const getReferralStatsQuerySchema = z.object({
  merchantId: z.string().uuid('รหัสร้านค้าต้องเป็น UUID ที่ถูกต้อง').optional(),
});

export const convertReferralSchema = z.object({
  referralCode: z.string().trim().min(3).max(50),
  merchantId: z.string().uuid('รหัสร้านค้าต้องเป็น UUID ที่ถูกต้อง'),
  transactionId: z.string().uuid('รหัสธุรกรรมต้องเป็น UUID ที่ถูกต้อง'),
  totalAmount: z.number().positive('ยอดชำระเงินต้องมากกว่า 0'),
});

export type ValidateReferralCodeParam = z.infer<typeof validateReferralCodeParamSchema>;
export type ValidateReferralCodeQuery = z.infer<typeof validateReferralCodeQuerySchema>;
export type CreateCustomReferralCodeInput = z.infer<typeof createCustomReferralCodeSchema>;
export type GetMyReferralCodeQuery = z.infer<typeof getMyReferralCodeQuerySchema>;
export type GetReferralStatsQuery = z.infer<typeof getReferralStatsQuerySchema>;
export type ConvertReferralInput = z.infer<typeof convertReferralSchema>;
