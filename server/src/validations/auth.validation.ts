import { z } from 'zod';

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
