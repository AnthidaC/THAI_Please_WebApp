import { z } from 'zod';
import { isValidThaiCitizenId } from '../utils/citizen-id';

export const DEMO_LOGIN_ROLES = ['CITIZEN', 'MERCHANT', 'ADMIN'] as const;
export type DemoLoginRole = typeof DEMO_LOGIN_ROLES[number];

export const demoLoginSchema = z.object({
  role: z.enum(DEMO_LOGIN_ROLES),
  accountId: z.string().uuid().optional(),
}).strict();

export const authLoginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(100),
}).strict();

export const citizenRegisterSchema = z.object({
  fullName: z.string().trim().min(1, 'กรุณากรอกชื่อและนามสกุล').max(100),
  citizenId: z.string().trim().refine((val) => isValidThaiCitizenId(val), {
    message: 'เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบเลข 13 หลัก',
  }),
  provinceCode: z.string().trim().min(1, 'กรุณาเลือกจังหวัด').max(10),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'รหัสผ่านต้องมีความยาว 8–72 ตัวอักษร').max(72, 'รหัสผ่านต้องมีความยาว 8–72 ตัวอักษร'),
}).strict();

export type CitizenRegisterInput = z.infer<typeof citizenRegisterSchema>;
