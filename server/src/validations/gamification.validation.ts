import { z } from 'zod';

const description = z.string().trim().max(1000).nullable().optional();
const positiveAmount = z.coerce.number().positive().max(9_999_999_999.99);
const percent = z.coerce.number().min(0).max(100);
const date = z.coerce.date();

const dateRange = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict().superRefine((value, context) => {
    const record = value as Record<string, unknown>;
    const start = record.startDate ?? record.startsAt;
    const end = record.endDate ?? record.endsAt;
    if (start instanceof Date && end instanceof Date && start >= end) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [record.endDate ? 'endDate' : 'endsAt'], message: 'End date must be after start date' });
    }
  });

const campaignFields = {
  campaignName: z.string().trim().min(2).max(150),
  governmentCopayRatePercent: percent,
  citizenPaymentRatePercent: percent,
  dailyQuotaLimit: z.coerce.number().positive().max(99_999_999.99),
  totalQuotaLimit: positiveAmount,
  startDate: date,
  endDate: date,
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).default('ACTIVE'),
};

export const createCampaignSchema = dateRange(campaignFields).superRefine((value, context) => {
  if (value.governmentCopayRatePercent + value.citizenPaymentRatePercent !== 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['citizenPaymentRatePercent'], message: 'Co-pay shares must total 100%' });
  }
});

export const updateCampaignSchema = z.object({
  campaignName: campaignFields.campaignName.optional(),
  governmentCopayRatePercent: percent.optional(),
  citizenPaymentRatePercent: percent.optional(),
  dailyQuotaLimit: positiveAmount.optional(),
  totalQuotaLimit: positiveAmount.optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const questFields = {
  campaignId: z.string().uuid().nullable().optional(),
  rewardId: z.string().uuid().nullable().optional(),
  questName: z.string().trim().min(2).max(150),
  description,
  questType: z.string().trim().min(2).max(50),
  targetValue: positiveAmount,
  startsAt: date,
  endsAt: date,
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
};

export const createQuestSchema = dateRange(questFields);
export const updateQuestSchema = z.object({
  campaignId: questFields.campaignId,
  rewardId: questFields.rewardId,
  questName: questFields.questName.optional(),
  description: questFields.description,
  questType: questFields.questType.optional(),
  targetValue: questFields.targetValue.optional(),
  startsAt: questFields.startsAt.optional(),
  endsAt: questFields.endsAt.optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const rewardFields = {
  rewardName: z.string().trim().min(2).max(150),
  description,
  rewardType: z.enum(['discount', 'coupon']),
  discountType: z.enum(['percent', 'fixed']).nullable().optional(),
  discountValue: z.coerce.number().positive().max(99_999_999.99).nullable().optional(),
  validDays: z.coerce.number().int().min(1).max(3650),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
};

export const createRewardSchema = z.object(rewardFields).strict().superRefine((value, context) => {
  if (value.rewardType === 'discount' && (value.discountType == null || value.discountValue == null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Discounts require a type and value' });
  }
  if (value.discountType === 'percent' && value.discountValue !== null && value.discountValue !== undefined && value.discountValue > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Percentage discount cannot exceed 100%' });
  }
});

export const updateRewardSchema = z.object({
  rewardName: rewardFields.rewardName.optional(),
  description: rewardFields.description,
  rewardType: rewardFields.rewardType.optional(),
  discountType: rewardFields.discountType,
  discountValue: rewardFields.discountValue,
  validDays: rewardFields.validDays.optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const badgeFields = {
  badgeName: z.string().trim().min(2).max(100),
  badgeLevel: z.enum(['Bronze', 'Silver', 'Gold', 'Rainbow']),
  description,
  conditionType: z.string().trim().min(2).max(50),
  requiredCount: z.coerce.number().int().positive(),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
};

export const createBadgeSchema = z.object(badgeFields).strict();
export const updateBadgeSchema = z.object({
  badgeName: badgeFields.badgeName.optional(),
  badgeLevel: badgeFields.badgeLevel.optional(),
  description: badgeFields.description,
  conditionType: badgeFields.conditionType.optional(),
  requiredCount: badgeFields.requiredCount.optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const badgeThresholds = z.object({
  Bronze: z.coerce.number().int().positive().max(100),
  Silver: z.coerce.number().int().positive().max(100),
  Gold: z.coerce.number().int().positive().max(100),
  Rainbow: z.coerce.number().int().positive().max(100),
}).strict().superRefine((thresholds, context) => {
  const levels = ['Bronze', 'Silver', 'Gold', 'Rainbow'] as const;
  for (let index = 1; index < levels.length; index += 1) {
    const previousLevel = levels[index - 1];
    const level = levels[index];
    if (thresholds[level] < thresholds[previousLevel]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [level],
        message: `${level} threshold cannot be lower than ${previousLevel}`,
      });
    }
  }
});

const badgeConfigFields = {
  badgeName: badgeFields.badgeName,
  description,
  conditionType: badgeFields.conditionType,
  thresholds: badgeThresholds,
  status: badgeFields.status,
};

export const createBadgeConfigSchema = z.object(badgeConfigFields).strict();
export const updateBadgeConfigSchema = z.object({
  badgeName: badgeConfigFields.badgeName.optional(),
  description: badgeConfigFields.description,
  conditionType: badgeConfigFields.conditionType.optional(),
  thresholds: badgeThresholds.optional(),
  status: badgeFields.status.optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update')
  .refine((value) => value.conditionType === undefined || value.thresholds !== undefined, {
    path: ['thresholds'],
    message: 'Changing the condition type requires thresholds for every badge level',
  });

export const uuidParamSchema = z.string().uuid();
