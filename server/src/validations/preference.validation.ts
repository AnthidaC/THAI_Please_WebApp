import { z } from 'zod';
import { CANONICAL_CATEGORY_IDS, CanonicalCategoryId } from '../constants/categories';

/**
 * Zod Schema สำหรับตรวจสอบแต่ละรายการหมวดหมู่ที่เลือก (ต้องอยู่ใน Canonical Category Taxonomy 5 หมวดหมู่)
 */
export const preferenceItemSchema = z.object({
  categoryId: z
    .string({ required_error: 'กรุณาระบุรหัสหมวดหมู่' })
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val): val is CanonicalCategoryId => (CANONICAL_CATEGORY_IDS as readonly string[]).includes(val),
      {
        message: `รหัสหมวดหมู่ไม่ถูกต้อง ต้องเป็นหนึ่งใน: ${CANONICAL_CATEGORY_IDS.join(', ')}`,
      }
    ),
  preferenceWeight: z
    .number({ invalid_type_error: 'ค่าน้ำหนักต้องเป็นตัวเลข' })
    .min(0.0, 'ค่าน้ำหนักต้องไม่ต่ำกว่า 0.00')
    .max(9.99, 'ค่าน้ำหนักต้องไม่เกิน 9.99 (ตาม Decimal(3,2) ใน Schema)')
    .optional()
    .default(1.0),
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
