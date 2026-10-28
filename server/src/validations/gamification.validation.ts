import { z } from 'zod';
import { validateCampaignPeriodConfiguration } from '../services/campaign-periods';

const description = z.string().trim().max(1000).nullable().optional();
const positiveAmount = z.coerce.number().positive().max(9_999_999_999.99);
const percent = z.coerce.number().min(0).max(100);
const date = z.coerce.date();
const rewardQuota = z.preprocess(
  (value) => value === '' ? null : value,
  z.coerce.number().int().min(0).max(2_147_483_647).nullable()
);

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

const campaignPeriodSchema = z.object({
  periodId: z.string().uuid().optional(),
  periodName: z.string().trim().min(1).max(100),
  periodQuotaLimit: z.coerce.number().min(0).max(9_999_999_999.99)
    .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001, 'Use up to 2 decimal places'),
  startDate: date,
  endDate: date,
}).strict();

const periods = z.array(campaignPeriodSchema).optional();

const addPeriodIssues = (
  value: { periods?: z.infer<typeof periods>; startDate: Date; endDate: Date; totalQuotaLimit: number },
  context: z.RefinementCtx
) => {
  if (!value.periods?.length) return;
  for (const issue of validateCampaignPeriodConfiguration(
    value.periods,
    value.startDate,
    value.endDate,
    value.totalQuotaLimit
  )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: issue.index === null ? ['periods'] : ['periods', issue.index, ...(issue.field ? [issue.field] : [])],
      message: issue.message,
    });
  }
};

export const createCampaignSchema = dateRange({ ...campaignFields, periods }).superRefine((value, context) => {
  if (value.governmentCopayRatePercent + value.citizenPaymentRatePercent !== 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['citizenPaymentRatePercent'], message: 'Co-pay shares must total 100%' });
  }
  addPeriodIssues(value, context);
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
  periods,
}).strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update')
  .superRefine((value, context) => {
    if (value.periods && value.startDate && value.endDate && value.totalQuotaLimit !== undefined) {
      addPeriodIssues(value as typeof value & { startDate: Date; endDate: Date; totalQuotaLimit: number }, context);
    }
  });

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
  quotaLimit: rewardQuota.default(null),
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
  quotaLimit: rewardQuota.optional(),
  validDays: rewardFields.validDays.optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const uuidParamSchema = z.string().uuid();
