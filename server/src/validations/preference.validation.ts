import { z } from 'zod';

/**
 * Zod Schema สำหรับตรวจสอบแต่ละรายการหมวดหมู่ที่เลือก
 */
export const preferenceItemSchema = z.object({
  categoryId: z
    .string({ required_error: 'กรุณาระบุรหัสหมวดหมู่' })
    .trim()
    .min(1, 'รหัสหมวดหมู่ต้องไม่ว่าง')
    .max(50, 'รหัสหมวดหมู่ต้องไม่เกิน 50 ตัวอักษร (ตามขนาดคอลัมน์ category_id ใน Schema)')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'รหัสหมวดหมู่ต้องประกอบด้วยตัวอักษร ตัวเลข หรือเครื่องหมาย _ และ - เท่านั้น'
    ),
  preferenceWeight: z
    .number({ invalid_type_error: 'ค่าน้ำหนักต้องเป็นตัวเลข' })
    .min(0.0, 'ค่าน้ำหนักต้องไม่ต่ำกว่า 0.00')
    .max(9.99, 'ค่าน้ำหนักต้องไม่เกิน 9.99 (ตาม Decimal(3,2) ใน Schema)')
    .default(1.0)
    .optional(),
});

/**
 * Zod Schema สำหรับการบันทึกรายการ Preferences ทั้งหมดของผู้ใช้งาน (PUT /preferences)
 * มีการตรวจสอบความซ้ำซ้อนของ categoryId ภายใน Request Array
 */
export const updatePreferencesSchema = z.object({
  preferences: z
    .array(preferenceItemSchema)
    .refine(
      (items) => {
        const ids = items.map((i) => i.categoryId.toLowerCase());
        return new Set(ids).size === ids.length;
      },
      {
        message: 'พบรหัสหมวดหมู่ซ้ำซ้อนในรายการที่ส่งมา กรุณาระบุหมวดหมู่ละหนึ่งรายการ',
      }
    ),
});

export type PreferenceItemInput = z.infer<typeof preferenceItemSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
