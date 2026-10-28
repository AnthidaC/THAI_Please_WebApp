import { z } from 'zod';

export const DEMO_LOGIN_ROLES = ['CITIZEN', 'MERCHANT', 'ADMIN'] as const;
export type DemoLoginRole = typeof DEMO_LOGIN_ROLES[number];

export const demoLoginSchema = z.object({
  role: z.enum(DEMO_LOGIN_ROLES),
  accountId: z.string().uuid().optional(),
}).strict();
