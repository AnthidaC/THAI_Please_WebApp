import { z } from 'zod';

export const demoCitizenLoginSchema = z.object({
  userId: z.string().uuid().optional(),
}).strict();
