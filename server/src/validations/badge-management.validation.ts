import { z } from 'zod';

const conditionType = z.string()
  .trim()
  .min(2, 'รหัสประเภทเงื่อนไขต้องมีอย่างน้อย 2 ตัวอักษร')
  .max(50, 'รหัสประเภทเงื่อนไขยาวเกินไป')
  .regex(/^[a-z][a-z0-9_]*$/, 'ใช้ตัวอักษรภาษาอังกฤษตัวพิมพ์เล็ก ตัวเลข และขีดล่าง โดยขึ้นต้นด้วยตัวอักษร');

const description = z.string().trim().max(1000, 'คำอธิบายยาวเกินไป').nullable().optional();
const iconUrl = z.string().trim().url('URL รูปไอคอนไม่ถูกต้อง').max(2048, 'URL รูปไอคอนยาวเกินไป').refine(
  (value) => /^https?:\/\//i.test(value),
  'URL รูปไอคอนต้องขึ้นต้นด้วย HTTP หรือ HTTPS'
).nullable().optional();

export const badgeTierSchema = z.object({
  tierId: z.string().uuid('รหัสระดับไม่ถูกต้อง').optional(),
  tierName: z.string().trim().min(1, 'กรุณาระบุชื่อระดับ').max(50, 'ชื่อระดับยาวเกินไป'),
  tierLevel: z.coerce.number({ invalid_type_error: 'ลำดับระดับต้องเป็นจำนวนเต็ม 1 ถึง 4' })
    .int('ลำดับระดับต้องเป็นจำนวนเต็ม 1 ถึง 4')
    .min(1, 'ลำดับระดับต้องเป็น 1 ถึง 4')
    .max(4, 'ลำดับระดับต้องเป็น 1 ถึง 4'),
  requiredCount: z.coerce.number({ invalid_type_error: 'เกณฑ์ต้องเป็นจำนวนเต็มบวก' })
    .int('เกณฑ์ต้องเป็นจำนวนเต็มบวก')
    .positive('เกณฑ์ต้องมากกว่า 0')
    .max(2_147_483_647, 'เกณฑ์เกินขอบเขตที่ระบบรองรับ'),
  iconUrl,
}).strict();

export type BadgeTierInput = z.infer<typeof badgeTierSchema>;

const validateTierSequence = (tiers: BadgeTierInput[], context: z.RefinementCtx) => {
  if (tiers.length !== 4) return;

  const sortedTiers = tiers.map((tier, originalIndex) => ({ tier, originalIndex }))
    .sort((left, right) => left.tier.tierLevel - right.tier.tierLevel);
  const levels = new Set<number>();
  const thresholds = new Set<number>();
  const tierIds = new Set<string>();

  for (let index = 0; index < sortedTiers.length; index += 1) {
    const { tier, originalIndex } = sortedTiers[index];
    const expected = ['Bronze', 'Silver', 'Gold', 'Platinum'][index];
    if (tier.tierLevel !== index + 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', originalIndex, 'tierLevel'], message: 'ต้องกำหนดระดับ 1, 2, 3 และ 4 ให้ครบโดยไม่ซ้ำกัน' });
    }
    if (tier.tierName !== expected) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', originalIndex, 'tierName'], message: 'ชื่อระดับไม่ตรงกับลำดับมาตรฐานที่กำหนด' });
    }
    if (levels.has(tier.tierLevel)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', originalIndex, 'tierLevel'], message: 'ลำดับระดับต้องไม่ซ้ำกัน' });
    }
    if (thresholds.has(tier.requiredCount)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', originalIndex, 'requiredCount'], message: 'เกณฑ์ของแต่ละระดับต้องไม่ซ้ำกัน' });
    }
    if (tier.tierId && tierIds.has(tier.tierId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', originalIndex, 'tierId'], message: 'ห้ามส่งรหัสระดับซ้ำกัน' });
    }
    if (index > 0 && tier.requiredCount <= sortedTiers[index - 1].tier.requiredCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tiers', originalIndex, 'requiredCount'],
        message: 'เกณฑ์ต้องเพิ่มขึ้นตามลำดับระดับอย่างเคร่งครัด',
      });
    }
    levels.add(tier.tierLevel);
    thresholds.add(tier.requiredCount);
    if (tier.tierId) tierIds.add(tier.tierId);
  }
};

const tiers = z.array(badgeTierSchema)
  .length(4, 'ต้องกำหนดเกณฑ์ให้ครบทั้ง 4 ระดับ')
  .superRefine(validateTierSequence);

export const badgeCreateSchema = z.object({
  badgeName: z.string().trim().min(2, 'ชื่อเหรียญตราต้องมีอย่างน้อย 2 ตัวอักษร').max(100, 'ชื่อเหรียญตรายาวเกินไป'),
  description,
  conditionType,
  tiers,
}).strict();

export const badgeUpdateSchema = z.object({
  badgeName: z.string().trim().min(2, 'ชื่อเหรียญตราต้องมีอย่างน้อย 2 ตัวอักษร').max(100, 'ชื่อเหรียญตรายาวเกินไป').optional(),
  description,
  tiers: tiers.optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'ระบุข้อมูลที่ต้องการแก้ไขอย่างน้อย 1 รายการ');

export const badgeImplementationStatusSchema = z.object({
  implementationStatus: z.enum(['pending', 'in_progress', 'ready']),
}).strict();

export const badgeListQuerySchema = z.object({
  implementation_status: z.enum(['pending', 'in_progress', 'ready']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).strict();

export const badgeIdParamSchema = z.string().uuid();

