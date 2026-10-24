import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

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
    if (error.code === 'P2025') throw new GamificationServiceError('Record not found', 404);
  }
  throw error;
};

const toIso = (value: Date) => value.toISOString();

const mapCampaign = (row: any) => ({
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
});

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

const mapBadge = (row: any) => ({
  id: row.badge_id,
  name: row.badge_name,
  level: row.badge_level,
  description: row.description,
  conditionType: row.condition_type,
  requiredCount: row.required_count,
  status: row.status,
  createdAt: toIso(row.created_at),
  awardedCount: row._count?.user_badges ?? 0,
});

const badgeLevels = ['Bronze', 'Silver', 'Gold', 'Rainbow'] as const;
type BadgeLevel = typeof badgeLevels[number];

const mapBadgeConfig = (rows: any[]) => {
  const byLevel = new Map<string, any>(rows.map((row) => [row.badge_level, row]));
  const firstConfiguredLevel = badgeLevels.map((level) => byLevel.get(level)).find(Boolean) ?? rows[0];
  const statuses = new Set(rows.map((row) => row.status));
  const createdAt = rows.reduce((earliest, row) => row.created_at < earliest ? row.created_at : earliest, rows[0].created_at);

  return {
    id: byLevel.get('Bronze')?.badge_id ?? firstConfiguredLevel.badge_id,
    name: firstConfiguredLevel.badge_name,
    description: firstConfiguredLevel.description,
    conditionType: firstConfiguredLevel.condition_type,
    thresholds: Object.fromEntries(
      badgeLevels.flatMap((level) => {
        const row = byLevel.get(level);
        return row ? [[level, row.required_count]] : [];
      })
    ) as Partial<Record<BadgeLevel, number>>,
    status: statuses.size === 1 ? firstConfiguredLevel.status : 'paused',
    createdAt: toIso(createdAt),
    awardedCount: rows.reduce((total, row) => total + (row._count?.user_badges ?? 0), 0),
  };
};

const mapBadgeConfigs = (rows: any[]) => {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const group = groups.get(row.condition_type) ?? [];
    group.push(row);
    groups.set(row.condition_type, group);
  }
  return Array.from(groups.values(), mapBadgeConfig).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

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
  listCampaigns: () => withDatabaseErrors(async () =>
    (await prisma.campaigns.findMany({ orderBy: { created_at: 'desc' }, include: { _count: { select: { quests: true } } } })).map(mapCampaign)
  ),
  createCampaign: (input: any) => withDatabaseErrors(async () => {
    assertDateRange(input.startDate, input.endDate);
    assertCampaignShares(input.governmentCopayRatePercent, input.citizenPaymentRatePercent);
    return mapCampaign(await prisma.campaigns.create({ data: {
      campaign_name: input.campaignName,
      government_copay_rate_percent: input.governmentCopayRatePercent,
      citizen_payment_rate_percent: input.citizenPaymentRatePercent,
      daily_quota_limit: input.dailyQuotaLimit,
      total_quota_limit: input.totalQuotaLimit,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status,
    }, include: { _count: { select: { quests: true } } } }));
  }),
  updateCampaign: (id: string, input: any) => withDatabaseErrors(async () => {
    const current = await prisma.campaigns.findUnique({ where: { campaign_id: id } });
    if (!current) throw new GamificationServiceError('Record not found', 404);
    const start = input.startDate ?? current.start_date;
    const end = input.endDate ?? current.end_date;
    assertDateRange(start, end);
    assertCampaignShares(
      input.governmentCopayRatePercent ?? Number(current.government_copay_rate_percent),
      input.citizenPaymentRatePercent ?? Number(current.citizen_payment_rate_percent)
    );
    return mapCampaign(await prisma.campaigns.update({ where: { campaign_id: id }, data: {
      ...(input.campaignName !== undefined && { campaign_name: input.campaignName }),
      ...(input.governmentCopayRatePercent !== undefined && { government_copay_rate_percent: input.governmentCopayRatePercent }),
      ...(input.citizenPaymentRatePercent !== undefined && { citizen_payment_rate_percent: input.citizenPaymentRatePercent }),
      ...(input.dailyQuotaLimit !== undefined && { daily_quota_limit: input.dailyQuotaLimit }),
      ...(input.totalQuotaLimit !== undefined && { total_quota_limit: input.totalQuotaLimit }),
      ...(input.startDate !== undefined && { start_date: input.startDate }),
      ...(input.endDate !== undefined && { end_date: input.endDate }),
      ...(input.status !== undefined && { status: input.status }),
    }, include: { _count: { select: { quests: true } } } }));
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

  listBadges: () => withDatabaseErrors(async () =>
    (await prisma.badges.findMany({ orderBy: { created_at: 'desc' }, include: { _count: { select: { user_badges: true } } } })).map(mapBadge)
  ),
  createBadge: (input: any) => withDatabaseErrors(async () => mapBadge(await prisma.badges.create({ data: {
    badge_name: input.badgeName,
    badge_level: input.badgeLevel,
    description: input.description ?? null,
    condition_type: input.conditionType,
    required_count: input.requiredCount,
    status: input.status,
  }, include: { _count: { select: { user_badges: true } } } }))),
  updateBadge: (id: string, input: any) => withDatabaseErrors(async () => mapBadge(await prisma.badges.update({ where: { badge_id: id }, data: {
    ...(input.badgeName !== undefined && { badge_name: input.badgeName }),
    ...(input.badgeLevel !== undefined && { badge_level: input.badgeLevel }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.conditionType !== undefined && { condition_type: input.conditionType }),
    ...(input.requiredCount !== undefined && { required_count: input.requiredCount }),
    ...(input.status !== undefined && { status: input.status }),
  }, include: { _count: { select: { user_badges: true } } } }))),

  listBadgeConfigs: () => withDatabaseErrors(async () =>
    mapBadgeConfigs(await prisma.badges.findMany({
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { user_badges: true } } },
    }))
  ),
  createBadgeConfig: (input: any) => withDatabaseErrors(async () => prisma.$transaction(async (tx: any) => {
    const rows = await Promise.all(badgeLevels.map((level) => tx.badges.create({
      data: {
        badge_name: input.badgeName,
        badge_level: level,
        description: input.description ?? null,
        condition_type: input.conditionType,
        required_count: input.thresholds[level],
        status: input.status,
      },
      include: { _count: { select: { user_badges: true } } },
    })));
    return mapBadgeConfig(rows);
  })),
  updateBadgeConfig: (id: string, input: any) => withDatabaseErrors(async () => {
    const selected = await prisma.badges.findUnique({ where: { badge_id: id } });
    if (!selected) throw new GamificationServiceError('Record not found', 404);

    return prisma.$transaction(async (tx: any) => {
      const rows = await tx.badges.findMany({
        where: { condition_type: selected.condition_type },
        include: { _count: { select: { user_badges: true } } },
      });
      if (!rows.length) throw new GamificationServiceError('Record not found', 404);

      const name = input.badgeName ?? selected.badge_name;
      const description = input.description !== undefined ? input.description : selected.description;
      const conditionType = input.conditionType ?? selected.condition_type;

      for (const level of badgeLevels) {
        const current = rows.find((row: any) => row.badge_level === level);
        const data = {
          ...(input.badgeName !== undefined && { badge_name: input.badgeName }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.conditionType !== undefined && { condition_type: input.conditionType }),
          ...(input.thresholds !== undefined && { required_count: input.thresholds[level] }),
          ...(input.status !== undefined && { status: input.status }),
        };

        if (current) {
          if (Object.keys(data).length > 0) {
            await tx.badges.update({ where: { badge_id: current.badge_id }, data });
          }
        } else if (input.thresholds !== undefined) {
          await tx.badges.create({
            data: {
              badge_name: name,
              badge_level: level,
              description,
              condition_type: conditionType,
              required_count: input.thresholds[level],
              status: input.status ?? selected.status,
            },
          });
        }
      }

      const updatedRows = await tx.badges.findMany({
        where: { condition_type: conditionType },
        include: { _count: { select: { user_badges: true } } },
      });
      return mapBadgeConfig(updatedRows);
    });
  }),
};
