import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const parseIdList = (value: string) => value.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean);

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  DEMO_AUTH_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DEMO_CITIZEN_USER_IDS: z.string().default('').transform(parseIdList),
  DEMO_MERCHANT_IDS: z.string().default('').transform(parseIdList),
  DEMO_ADMIN_STAFF_IDS: z.string().default('').transform(parseIdList),
  AI_PROVIDER: z.enum(['gemini', 'openai', 'custom']).default('gemini'),
  AI_FRAUD_API_KEY: z.string().optional(),
  AI_FRAUD_MODEL: z.string().default('gemini-1.5-flash'),
  AI_FRAUD_ENDPOINT: z.string().optional(),
}).superRefine((values, context) => {
  if (!values.DEMO_AUTH_ENABLED) return;

  if (values.NODE_ENV !== 'development') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['DEMO_AUTH_ENABLED'], message: 'Demo authentication is development-only' });
  }

  const allowlists = [
    ['DEMO_CITIZEN_USER_IDS', values.DEMO_CITIZEN_USER_IDS],
    ['DEMO_MERCHANT_IDS', values.DEMO_MERCHANT_IDS],
    ['DEMO_ADMIN_STAFF_IDS', values.DEMO_ADMIN_STAFF_IDS],
  ] as const;
  allowlists.forEach(([key, ids]) => {
    const seen = new Set<string>();
    ids.forEach((id, index) => {
      if (!z.string().uuid().safeParse(id).success) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [key, index], message: 'Demo account IDs must be UUIDs' });
      }
      if (seen.has(id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [key, index], message: 'Demo account IDs must be unique' });
      }
      seen.add(id);
    });
  });
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
