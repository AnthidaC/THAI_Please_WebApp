import { z } from 'zod';

const conditionKey = z.string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z][a-z0-9_]{1,49}$/, 'ใช้รหัสภาษาอังกฤษตัวพิมพ์เล็ก ตัวเลข และขีดล่าง โดยขึ้นต้นด้วยตัวอักษร');

const displayName = z.string().trim().min(2, 'กรุณาระบุชื่อเงื่อนไข').max(100);
const description = z.string().trim().max(1000).nullable().optional();
const measurementUnit = z.enum(['count', 'amount', 'other']);
const implementationStatus = z.enum(['pending', 'in_progress', 'ready']);

export const conditionTypeCreateSchema = z.object({
  conditionKey,
  displayName,
  description,
  measurementUnit,
}).strict();

export const conditionTypeUpdateSchema = z.object({
  displayName: displayName.optional(),
  description,
  measurementUnit: measurementUnit.optional(),
  implementationStatus: implementationStatus.optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'กรุณาระบุข้อมูลที่ต้องการแก้ไข');

export const conditionTypeListQuerySchema = z.object({
  implementation_status: implementationStatus.optional(),
  handler_registered: z.enum(['true', 'false']).optional(),
}).strict();

export const conditionTypeIdParamSchema = z.string().uuid();

export type ConditionTypeCreateInput = z.infer<typeof conditionTypeCreateSchema>;
export type ConditionTypeUpdateInput = z.infer<typeof conditionTypeUpdateSchema>;
