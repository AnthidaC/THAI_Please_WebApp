import { z } from 'zod';

const conditionType = z.string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use a lowercase identifier with letters, numbers, and underscores');

const description = z.string().trim().max(1000).nullable().optional();
const iconUrl = z.string().trim().url().max(2048).refine(
  (value) => /^https?:\/\//i.test(value),
  'Icon URL must use HTTP or HTTPS'
).nullable().optional();

export const badgeTierSchema = z.object({
  tierId: z.string().uuid().optional(),
  tierName: z.string().trim().min(1).max(50),
  tierLevel: z.coerce.number().int().positive().max(1000),
  requiredCount: z.coerce.number().int().positive().max(2_147_483_647),
  iconUrl,
}).strict();

export type BadgeTierInput = z.infer<typeof badgeTierSchema>;

const validateTierSequence = (tiers: BadgeTierInput[], context: z.RefinementCtx) => {
  const sortedTiers = [...tiers].sort((left, right) => left.tierLevel - right.tierLevel);
  const levels = new Set<number>();
  const thresholds = new Set<number>();
  const tierIds = new Set<string>();

  for (let index = 0; index < sortedTiers.length; index += 1) {
    const tier = sortedTiers[index];
    if (levels.has(tier.tierLevel)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', index, 'tierLevel'], message: 'Tier levels must be unique' });
    }
    if (thresholds.has(tier.requiredCount)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', index, 'requiredCount'], message: 'Tier thresholds must be unique' });
    }
    if (tier.tierId && tierIds.has(tier.tierId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers', index, 'tierId'], message: 'A tier can only be listed once' });
    }
    if (index > 0 && tier.requiredCount <= sortedTiers[index - 1].requiredCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tiers', index, 'requiredCount'],
        message: 'Required counts must strictly increase with tier level',
      });
    }
    levels.add(tier.tierLevel);
    thresholds.add(tier.requiredCount);
    if (tier.tierId) tierIds.add(tier.tierId);
  }
};

const tiers = z.array(badgeTierSchema).min(1).max(50).superRefine(validateTierSequence);

export const badgeCreateSchema = z.object({
  badgeName: z.string().trim().min(2).max(100),
  description,
  conditionType,
  tiers,
}).strict();

export const badgeUpdateSchema = z.object({
  badgeName: z.string().trim().min(2).max(100).optional(),
  description,
  tiers: tiers.optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const badgeImplementationStatusSchema = z.object({
  implementationStatus: z.enum(['pending', 'in_progress', 'ready']),
}).strict();

export const badgeListQuerySchema = z.object({
  implementation_status: z.enum(['pending', 'in_progress', 'ready']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).strict();

export const badgeIdParamSchema = z.string().uuid();

