import { z } from 'zod';

/**
 * Zod Schema สำหรับตรวจสอบ URL Parameters ใน Tracking Endpoints ของ Developer 3
 * รองรับทั้ง Click Tracking และ Conversion Tracking
 * ตัวอย่าง: POST /recommendations/:recommendationId/click หรือ POST /recommendations/:recommendationId/convert
 */
export const recommendationTrackingParamSchema = z.object({
  recommendationId: z
    .string({ error: 'กรุณาระบุรหัสคำแนะนำ (recommendationId)' })
    .trim()
    .uuid('รูปแบบรหัสคำแนะนำไม่ถูกต้อง (ต้องเป็น UUID)'),
});

/**
 * Zod Schema สำหรับตรวจสอบ Request Body ในการบันทึก Conversion
 * - รองรับการแนบ transactionId เพื่อช่วยอ้างอิงธุรกรรมที่เกิดขึ้นจริง (Optional)
 * - ไม่รับ userId จาก Request Body เพื่อความปลอดภัย (ต้องดึงจาก req.user เท่านั้น)
 */
export const recordConversionBodySchema = z.object({
  transactionId: z
    .string()
    .trim()
    .uuid('รูปแบบรหัสธุรกรรมไม่ถูกต้อง (ต้องเป็น UUID)')
    .optional(),
});

export type RecommendationTrackingParam = z.infer<typeof recommendationTrackingParamSchema>;
export type RecordConversionBody = z.infer<typeof recordConversionBodySchema>;
