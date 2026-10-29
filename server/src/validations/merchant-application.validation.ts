import { z } from 'zod';
import { CANONICAL_CATEGORY_IDS, CanonicalCategoryId } from '../constants/categories';

/**
 * Validation schema สำหรับการลงทะเบียนใบสมัครร้านค้า (Merchant Application / Onboarding)
 * ออกแบบสำหรับ Dev 1 โดยผนวกรวม category_id เข้าสู่กระบวนการกรอกข้อมูลอย่างปลอดภัย
 */
export const merchantApplicationSchema = z.object({
  businessType: z.enum(['INDIVIDUAL', 'JURISTIC'], {
    error: 'ประเภทธุรกิจต้องเป็น INDIVIDUAL หรือ JURISTIC',
  }),
  taxId: z
    .string({ error: 'กรุณาระบุเลขประจำตัวผู้เสียภาษี' })
    .trim()
    .min(10, 'เลขประจำตัวผู้เสียภาษีต้องมีความยาวอย่างน้อย 10 หลัก')
    .max(20, 'เลขประจำตัวผู้เสียภาษีต้องมีความยาวไม่เกิน 20 หลัก'),
  businessName: z
    .string({ error: 'กรุณาระบุชื่อร้านค้า' })
    .trim()
    .min(1, 'กรุณาระบุชื่อร้านค้า')
    .max(100, 'ชื่อร้านค้าต้องมีความยาวไม่เกิน 100 ตัวอักษร')
    .optional(),
  shopName: z
    .string({ error: 'กรุณาระบุชื่อร้านค้า' })
    .trim()
    .min(1, 'กรุณาระบุชื่อร้านค้า')
    .max(100, 'ชื่อร้านค้าต้องมีความยาวไม่เกิน 100 ตัวอักษร')
    .optional(),
  contactName: z
    .string({ error: 'กรุณาระบุชื่อผู้ติดต่อ' })
    .trim()
    .min(1, 'กรุณาระบุชื่อผู้ติดต่อ')
    .max(100, 'ชื่อผู้ติดต่อต้องมีความยาวไม่เกิน 100 ตัวอักษร'),
  categoryId: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val): val is CanonicalCategoryId => (CANONICAL_CATEGORY_IDS as readonly string[]).includes(val),
      {
        message: `รหัสหมวดหมู่ไม่ถูกต้อง ต้องเป็นหนึ่งใน: ${CANONICAL_CATEGORY_IDS.join(', ')}`,
      }
    )
    .nullable()
    .optional(),
  email: z
    .string({ error: 'กรุณาระบุอีเมล' })
    .trim()
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .max(254, 'อีเมลต้องมีความยาวไม่เกิน 254 ตัวอักษร'),
  phone: z
    .string({ error: 'กรุณาระบุหมายเลขโทรศัพท์' })
    .trim()
    .min(9, 'หมายเลขโทรศัพท์ต้องมีความยาวอย่างน้อย 9 หลัก')
    .max(30, 'หมายเลขโทรศัพท์ต้องมีความยาวไม่เกิน 30 หลัก'),
  password: z
    .string({ error: 'กรุณากำหนดรหัสผ่าน' })
    .min(6, 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
    .max(100, 'รหัสผ่านต้องมีความยาวไม่เกิน 100 ตัวอักษร'),
  address: z
    .string({ error: 'กรุณาระบุที่อยู่ร้านค้า' })
    .trim()
    .min(5, 'ที่อยู่ต้องมีความยาวอย่างน้อย 5 ตัวอักษร')
    .max(500, 'ที่อยู่ต้องมีความยาวไม่เกิน 500 ตัวอักษร'),
  latitude: z
    .number({ error: 'กรุณาระบุพิกัดละติจูด' })
    .min(-90, 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90')
    .max(90, 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'),
  longitude: z
    .number({ error: 'กรุณาระบุพิกัดลองจิจูด' })
    .min(-180, 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180')
    .max(180, 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'),
})
  .superRefine((value, context) => {
    if (!value.businessName && !value.shopName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['businessName'],
        message: 'กรุณาระบุชื่อร้านค้า',
      });
    }
  })
  .transform(({ businessName, shopName, ...input }) => ({
    ...input,
    businessName: businessName ?? shopName ?? '',
  }));

export const merchantApplicationDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.action === 'REJECT' && (!value.note || value.note.length < 10)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['note'],
      message: 'กรุณาระบุเหตุผลการปฏิเสธอย่างน้อย 10 ตัวอักษร',
    });
  }
});

const loginSchema = z.object({
  email: z.string({ error: 'กรุณาระบุอีเมล' }).trim().email('รูปแบบอีเมลไม่ถูกต้อง').max(254).transform((value) => value.toLowerCase()),
  password: z.string({ error: 'กรุณาระบุรหัสผ่าน' }).min(1, 'กรุณาระบุรหัสผ่าน').max(100),
});

export const merchantLoginSchema = loginSchema;
export const staffLoginSchema = loginSchema;

/**
 * Validation schema สำหรับการอัปเดตหมวดหมู่ของร้านค้าโดยตรง
 */
export const updateMerchantCategorySchema = z.object({
  categoryId: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val): val is CanonicalCategoryId => (CANONICAL_CATEGORY_IDS as readonly string[]).includes(val),
      {
        message: `รหัสหมวดหมู่ไม่ถูกต้อง ต้องเป็นหนึ่งใน: ${CANONICAL_CATEGORY_IDS.join(', ')}`,
      }
    )
    .nullable(),
});

export type MerchantApplicationInput = z.infer<typeof merchantApplicationSchema>;
export type UpdateMerchantCategoryInput = z.infer<typeof updateMerchantCategorySchema>;
