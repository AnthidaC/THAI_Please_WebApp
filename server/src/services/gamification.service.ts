import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { validateCampaignPeriodConfiguration } from './campaign-periods';

export class GamificationServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'GamificationServiceError';
  }
}

const translateDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new GamificationServiceError('A record with these details already exists', 409);
    if (error.code === 'P2003') throw new GamificationServiceError('A linked record could not be found', 400);
    if (error.code === 'P2004') throw new GamificationServiceError('Campaign period data violates a database quota or date rule', 409);
    if (error.code === 'P2025') throw new GamificationServiceError('Record not found', 404);
  }
  throw error;
};

const toIso = (value: Date) => value.toISOString();

const mapCampaign = (row: any, usedByPeriod = new Map<string, number>(), now = new Date()) => ({
  id: row.campaign_id,
  name: row.campaign_name,
  governmentCopayRatePercent: row.government_copay_rate_percent.toString(),
  citizenPaymentRatePercent: row.citizen_payment_rate_percent.toString(),
  dailyQuotaLimit: row.daily_quota_limit.toString(),
  totalQuotaLimit: row.total_quota_limit.toString(),
  startDate: toIso(row.start_date),
  endDate: toIso(row.end_date),
  status: row.status,
  createdAt: toIso(row.created_at),
  missionCount: row._count?.quests ?? 0,
  periods: (row.campaign_periods ?? []).map((period: any) => {
    const usedAmount = usedByPeriod.get(period.period_id) ?? 0;
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    return {
      id: period.period_id,
      name: period.period_name,
      quotaLimit: period.period_quota_limit.toString(),
      usedAmount: usedAmount.toFixed(2),
      startDate: toIso(startDate),
      endDate: toIso(endDate),
      status: now < startDate ? 'UPCOMING' : now < endDate ? 'ACTIVE' : 'ENDED',
      allocationCount: period._count?.wallet_period_quotas ?? 0,
      isEditable: now < startDate && usedAmount === 0,
    };
  }),
});

const campaignInclude = {
  campaign_periods: {
    orderBy: { start_date: 'asc' },
    include: { _count: { select: { wallet_period_quotas: true } } },
  },
  _count: { select: { quests: true } },
} satisfies Prisma.campaignsInclude;

const getPeriodUsage = async (db: any, periodIds: string[]) => {
  if (!periodIds.length) return new Map<string, number>();
  const rows = await db.wallet_period_quotas.groupBy({
    by: ['period_id'],
    where: { period_id: { in: periodIds } },
    _sum: { quota_used: true },
  });
  return new Map<string, number>(rows.map((row: any) => [row.period_id, Number(row._sum.quota_used ?? 0)]));
};

const assertPeriodsValid = (periods: any[], startDate: Date, endDate: Date, totalQuotaLimit: number) => {
  const issues = validateCampaignPeriodConfiguration(periods, startDate, endDate, totalQuotaLimit);
  if (issues.length) throw new GamificationServiceError(issues[0].message, 400);
};

const loadCampaignRecord = async (db: any, campaignId: string) => {
  const row = await db.campaigns.findUnique({ where: { campaign_id: campaignId }, include: campaignInclude });
  if (!row) throw new GamificationServiceError('Record not found', 404);
  const usedByPeriod = await getPeriodUsage(db, row.campaign_periods.map((period: any) => period.period_id));
  return mapCampaign(row, usedByPeriod);
};

const mapQuest = (row: any) => ({
  id: row.quest_id,
  campaignId: row.campaign_id,
  campaignName: row.campaigns?.campaign_name ?? null,
  rewardId: row.reward_id,
  rewardName: row.rewards?.reward_name ?? null,
  name: row.quest_name,
  description: row.description,
  type: row.quest_type,
  targetValue: row.target_value.toString(),
  startsAt: toIso(row.starts_at),
  endsAt: toIso(row.ends_at),
  status: row.status,
  createdAt: toIso(row.created_at),
  participantCount: row._count?.user_quests ?? 0,
});

const mapReward = (row: any) => ({
  id: row.reward_id,
  name: row.reward_name,
  description: row.description,
  type: row.reward_type,
  discountType: row.discount_type,
  discountValue: row.discount_value?.toString() ?? null,
  validDays: row.valid_days,
  status: row.status,
  createdAt: toIso(row.created_at),
  issuedCount: row._count?.user_rewards ?? 0,
});

const assertDateRange = (start: Date, end: Date) => {
  if (start >= end) throw new GamificationServiceError('End date must be after start date', 400);
};

const assertCampaignShares = (governmentShare: number, citizenShare: number) => {
  if (Math.round((governmentShare + citizenShare) * 100) !== 10000) {
    throw new GamificationServiceError('Co-pay shares must total 100%', 400);
  }
};

const assertRewardDiscount = (
  rewardType: string,
  discountType: string | null | undefined,
  discountValue: number | null | undefined
) => {
  if (rewardType === 'discount' && (discountType == null || discountValue == null)) {
    throw new GamificationServiceError('Discounts require a type and value', 400);
  }
  if (discountType === 'percent' && discountValue != null && discountValue > 100) {
    throw new GamificationServiceError('Percentage discount cannot exceed 100%', 400);
  }
};

const withDatabaseErrors = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    return translateDatabaseError(error);
  }
};

export const gamificationService = {
  listCampaigns: () => withDatabaseErrors(async () => {
    const rows = await prisma.campaigns.findMany({ orderBy: { created_at: 'desc' }, include: campaignInclude });
    const usedByPeriod = await getPeriodUsage(prisma, rows.flatMap((row: any) => row.campaign_periods.map((period: any) => period.period_id)));
    return rows.map((row: any) => mapCampaign(row, usedByPeriod));
  }),
  createCampaign: (input: any) => withDatabaseErrors(async () => {
    assertDateRange(input.startDate, input.endDate);
    assertCampaignShares(input.governmentCopayRatePercent, input.citizenPaymentRatePercent);
    const configuredPeriods = input.periods ?? [];
    assertPeriodsValid(configuredPeriods, input.startDate, input.endDate, input.totalQuotaLimit);
    const row = await prisma.campaigns.create({ data: {
      campaign_name: input.campaignName,
      government_copay_rate_percent: input.governmentCopayRatePercent,
      citizen_payment_rate_percent: input.citizenPaymentRatePercent,
      daily_quota_limit: input.dailyQuotaLimit,
      total_quota_limit: input.totalQuotaLimit,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
      ...(configuredPeriods.length > 0 && {
        campaign_periods: {
          create: configuredPeriods.map((period: any) => ({
            period_name: period.periodName,
            period_quota_limit: period.periodQuotaLimit,
            start_date: period.startDate,
            end_date: period.endDate,
          })),
        },
      }),
    }, include: campaignInclude });
    return loadCampaignRecord(prisma, row.campaign_id);
  }),
  updateCampaign: (id: string, input: any) => withDatabaseErrors(async () => {
    await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT campaign_id FROM public.campaigns WHERE campaign_id = ${id}::uuid FOR UPDATE`;
      const current = await tx.campaigns.findUnique({ where: { campaign_id: id }, include: campaignInclude });
      if (!current) throw new GamificationServiceError('Record not found', 404);

      const start = input.startDate ?? current.start_date;
      const end = input.endDate ?? current.end_date;
      const totalLimit = input.totalQuotaLimit ?? Number(current.total_quota_limit);
      assertDateRange(start, end);
      assertCampaignShares(
        input.governmentCopayRatePercent ?? Number(current.government_copay_rate_percent),
        input.citizenPaymentRatePercent ?? Number(current.citizen_payment_rate_percent)
      );

      const periodIds = current.campaign_periods.map((period: any) => period.period_id);
      const usageRows = input.periods !== undefined && periodIds.length ? await tx.wallet_period_quotas.groupBy({
        by: ['period_id'],
        where: { period_id: { in: periodIds } },
        _sum: { quota_used: true },
      }) : [];
      const usedByPeriod = new Map<string, number>(usageRows.map((row: any) => [row.period_id, Number(row._sum.quota_used ?? 0)]));
      const requestedPeriods = input.periods ?? current.campaign_periods.map((period: any) => ({
        periodId: period.period_id,
        periodName: period.period_name,
        periodQuotaLimit: Number(period.period_quota_limit),
        startDate: period.start_date,
        endDate: period.end_date,
      }));
      const validatesPeriodConfiguration = input.periods !== undefined ||
        input.totalQuotaLimit !== undefined ||
        input.startDate !== undefined ||
        input.endDate !== undefined;
      if (validatesPeriodConfiguration) {
        assertPeriodsValid(requestedPeriods, start, end, totalLimit);
      }

      if (input.periods !== undefined) {
        if (requestedPeriods.some((period: any) => !period.periodId && period.startDate <= new Date())) {
          throw new GamificationServiceError('New periods must start in the future.', 400);
        }

        const existingById = new Map<string, any>(current.campaign_periods.map((period: any) => [period.period_id, period]));
        for (const period of requestedPeriods) {
          if (period.periodId && !existingById.has(period.periodId)) {
            throw new GamificationServiceError('A period does not belong to this campaign', 400);
          }
        }

        const now = new Date();
        for (const currentPeriod of current.campaign_periods) {
          const requested = requestedPeriods.find((period: any) => period.periodId === currentPeriod.period_id);
          const hasUsage = (usedByPeriod.get(currentPeriod.period_id) ?? 0) > 0;
          const locked = now >= currentPeriod.start_date || hasUsage;
          if (locked && (!requested ||
            requested.periodName !== currentPeriod.period_name ||
            Math.round(requested.periodQuotaLimit * 100) !== Math.round(Number(currentPeriod.period_quota_limit) * 100) ||
            requested.startDate.getTime() !== currentPeriod.start_date.getTime() ||
            requested.endDate.getTime() !== currentPeriod.end_date.getTime())) {
            throw new GamificationServiceError('Started or used periods cannot be edited or removed.', 409);
          }
        }

        const requestedIds = new Set(requestedPeriods.flatMap((period: any) => period.periodId ? [period.periodId] : []));
        const removable = current.campaign_periods.filter((period: any) => !requestedIds.has(period.period_id));
        if (removable.length) {
          await tx.campaign_periods.deleteMany({ where: { period_id: { in: removable.map((period: any) => period.period_id) } } });
        }

        for (const period of requestedPeriods) {
          const data = {
            period_name: period.periodName,
            period_quota_limit: period.periodQuotaLimit,
            start_date: period.startDate,
            end_date: period.endDate,
          };
          if (period.periodId) {
            const prior = existingById.get(period.periodId);
            const changed = period.periodName !== prior.period_name ||
              Math.round(Number(prior.period_quota_limit) * 100) !== Math.round(period.periodQuotaLimit * 100) ||
              period.startDate.getTime() !== prior.start_date.getTime() ||
              period.endDate.getTime() !== prior.end_date.getTime();
            if (!changed) continue;
            const changedQuota = Math.round(Number(prior.period_quota_limit) * 100) !== Math.round(period.periodQuotaLimit * 100);
            await tx.campaign_periods.update({ where: { period_id: period.periodId }, data });
            if (changedQuota) {
              await tx.wallet_period_quotas.updateMany({
                where: { period_id: period.periodId },
                data: { quota_limit: period.periodQuotaLimit, quota_remaining: period.periodQuotaLimit },
              });
            }
          } else {
            await tx.campaign_periods.create({ data: { campaign_id: id, ...data } });
          }
        }
      }

      await tx.campaigns.update({ where: { campaign_id: id }, data: {
        ...(input.campaignName !== undefined && { campaign_name: input.campaignName }),
        ...(input.governmentCopayRatePercent !== undefined && { government_copay_rate_percent: input.governmentCopayRatePercent }),
        ...(input.citizenPaymentRatePercent !== undefined && { citizen_payment_rate_percent: input.citizenPaymentRatePercent }),
        ...(input.dailyQuotaLimit !== undefined && { daily_quota_limit: input.dailyQuotaLimit }),
        ...(input.totalQuotaLimit !== undefined && { total_quota_limit: input.totalQuotaLimit }),
        ...(input.startDate !== undefined && { start_date: input.startDate }),
        ...(input.endDate !== undefined && { end_date: input.endDate }),
        ...(input.status !== undefined && { status: input.status }),
      } });
    });
    return loadCampaignRecord(prisma, id);
  }),

  listQuests: () => withDatabaseErrors(async () =>
    (await prisma.quests.findMany({ orderBy: { created_at: 'desc' }, include: {
      campaigns: { select: { campaign_name: true } }, rewards: { select: { reward_name: true } },
      _count: { select: { user_quests: true } },
    } })).map(mapQuest)
  ),
  createQuest: (input: any) => withDatabaseErrors(async () => {
    assertDateRange(input.startsAt, input.endsAt);
    return mapQuest(await prisma.quests.create({ data: {
      campaign_id: input.campaignId ?? null,
      reward_id: input.rewardId ?? null,
      quest_name: input.questName,
      description: input.description ?? null,
      quest_type: input.questType,
      target_value: input.targetValue,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      status: input.status,
    }, include: { campaigns: { select: { campaign_name: true } }, rewards: { select: { reward_name: true } }, _count: { select: { user_quests: true } } } }));
  }),
  updateQuest: (id: string, input: any) => withDatabaseErrors(async () => {
    const current = await prisma.quests.findUnique({ where: { quest_id: id } });
    if (!current) throw new GamificationServiceError('Record not found', 404);
    assertDateRange(input.startsAt ?? current.starts_at, input.endsAt ?? current.ends_at);
    return mapQuest(await prisma.quests.update({ where: { quest_id: id }, data: {
      ...(input.campaignId !== undefined && { campaign_id: input.campaignId }),
      ...(input.rewardId !== undefined && { reward_id: input.rewardId }),
      ...(input.questName !== undefined && { quest_name: input.questName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.questType !== undefined && { quest_type: input.questType }),
      ...(input.targetValue !== undefined && { target_value: input.targetValue }),
      ...(input.startsAt !== undefined && { starts_at: input.startsAt }),
      ...(input.endsAt !== undefined && { ends_at: input.endsAt }),
      ...(input.status !== undefined && { status: input.status }),
      updated_at: new Date(),
    }, include: { campaigns: { select: { campaign_name: true } }, rewards: { select: { reward_name: true } }, _count: { select: { user_quests: true } } } }));
  }),

  listRewards: () => withDatabaseErrors(async () =>
    (await prisma.rewards.findMany({ orderBy: { created_at: 'desc' }, include: { _count: { select: { user_rewards: true } } } })).map(mapReward)
  ),
  createReward: (input: any) => withDatabaseErrors(async () => {
    assertRewardDiscount(input.rewardType, input.discountType, input.discountValue);
    return mapReward(await prisma.rewards.create({ data: {
      reward_name: input.rewardName,
      description: input.description ?? null,
      reward_type: input.rewardType,
      discount_type: input.discountType ?? null,
      discount_value: input.discountValue ?? null,
      valid_days: input.validDays,
      status: input.status,
    }, include: { _count: { select: { user_rewards: true } } } }));
  }),
  updateReward: (id: string, input: any) => withDatabaseErrors(async () => {
    const current = await prisma.rewards.findUnique({ where: { reward_id: id } });
    if (!current) throw new GamificationServiceError('Record not found', 404);
    assertRewardDiscount(
      input.rewardType ?? current.reward_type,
      input.discountType !== undefined ? input.discountType : current.discount_type,
      input.discountValue !== undefined ? input.discountValue : (current.discount_value == null ? null : Number(current.discount_value))
    );
    return mapReward(await prisma.rewards.update({ where: { reward_id: id }, data: {
      ...(input.rewardName !== undefined && { reward_name: input.rewardName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.rewardType !== undefined && { reward_type: input.rewardType }),
      ...(input.discountType !== undefined && { discount_type: input.discountType }),
      ...(input.discountValue !== undefined && { discount_value: input.discountValue }),
      ...(input.validDays !== undefined && { valid_days: input.validDays }),
      ...(input.status !== undefined && { status: input.status }),
      updated_at: new Date(),
    }, include: { _count: { select: { user_rewards: true } } } }));
  }),

};
