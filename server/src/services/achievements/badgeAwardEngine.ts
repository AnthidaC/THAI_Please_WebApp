import type { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { badgeConditionRegistry } from './conditionRegistry';
import { issueCompletedMissionRewards } from '../citizenMissionReward.service';

export interface TierView {
  tierId: string;
  tierName: string;
  tierLevel: number;
  requiredCount: number;
}

export interface AwardedTier extends TierView {
  badgeId: string;
  badgeName: string;
  earnedAt: string | null;
}

export type EvaluationStatus = 'evaluated' | 'unregistered' | 'no_active_badge';

export interface ConditionEvaluationResult {
  conditionType: string;
  status: EvaluationStatus;
  /** Authoritative progress from the registered handler, or null when unavailable. */
  progress: number | null;
  awarded: AwardedTier[];
}

export interface AwardPlan {
  /** Eligible tiers missing from unlock history. */
  tiersToRecord: TierView[];
  /** Highest eligible tier when it is above the stored current tier. */
  promoteTo: TierView | null;
}

const byTierLevel = (left: TierView, right: TierView) => left.tierLevel - right.tierLevel;

export const sortTiers = (tiers: TierView[]): TierView[] => [...tiers].sort(byTierLevel);

export const getEligibleTiers = (tiers: TierView[], progress: number): TierView[] =>
  sortTiers(tiers).filter((tier) => tier.requiredCount <= progress);

export const getNextTier = (tiers: TierView[], currentLevel: number): TierView | null =>
  sortTiers(tiers).find((tier) => tier.tierLevel > currentLevel) ?? null;

/**
 * Pure decision step: which tiers still need history rows, and which tier (if
 * any) becomes the user's new current tier. It never lowers the stored tier.
 */
export const planAwards = (input: {
  tiers: TierView[];
  progress: number;
  unlockedTierIds: ReadonlySet<string>;
  currentTierLevel: number;
}): AwardPlan => {
  const eligible = getEligibleTiers(input.tiers, input.progress);
  const tiersToRecord = eligible.filter((tier) => !input.unlockedTierIds.has(tier.tierId));
  const highest = eligible[eligible.length - 1] ?? null;
  return {
    tiersToRecord,
    promoteTo: highest && highest.tierLevel > input.currentTierLevel ? highest : null,
  };
};

const mapTier = (tier: {
  tier_id: string;
  tier_name: string;
  tier_level: number;
  required_count: number;
}): TierView => ({
  tierId: tier.tier_id,
  tierName: tier.tier_name,
  tierLevel: tier.tier_level,
  requiredCount: tier.required_count,
});

const mapAwarded = (
  badge: { badge_id: string; badge_name: string },
  tiers: TierView[],
  earnedAt: string | null
): AwardedTier[] => tiers.map((tier) => ({
  ...tier,
  badgeId: badge.badge_id,
  badgeName: badge.badge_name,
  earnedAt,
}));

const loadBadgeState = async (
  client: Prisma.TransactionClient | typeof prisma,
  userId: string,
  badgeId: string
): Promise<{ currentTierLevel: number; unlockedTierIds: Set<string> }> => {
  const [current, history] = await Promise.all([
    client.user_badges.findUnique({
      where: { user_id_badge_id: { user_id: userId, badge_id: badgeId } },
      include: { badge_tiers: { select: { tier_level: true } } },
    }),
    client.user_badge_history.findMany({
      where: { user_id: userId, badge_id: badgeId },
      select: { badge_tier_id: true },
    }),
  ]);

  return {
    currentTierLevel: current?.badge_tiers.tier_level ?? 0,
    unlockedTierIds: new Set(history.map((row) => row.badge_tier_id)),
  };
};

interface BadgeWithTiers {
  badge_id: string;
  badge_name: string;
  badge_tiers: Array<{
    tier_id: string;
    tier_name: string;
    tier_level: number;
    required_count: number;
  }>;
}

/**
 * Re-reads state under a per-user row lock, then writes history and the current
 * tier atomically. The unique key on (user_id, badge_tier_id) makes duplicate
 * history impossible even if two evaluations race; the lock keeps the current
 * tier from being replaced by a stale evaluation.
 */
const persistPlan = async (input: {
  userId: string;
  badge: BadgeWithTiers;
  progress: number;
}): Promise<{ awarded: TierView[]; earnedAt: string }> => {
  const { userId, badge, progress } = input;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${userId}::uuid FOR UPDATE`;

    const state = await loadBadgeState(tx, userId, badge.badge_id);
    const plan = planAwards({
      tiers: badge.badge_tiers.map(mapTier),
      progress,
      unlockedTierIds: state.unlockedTierIds,
      currentTierLevel: state.currentTierLevel,
    });

    const earnedAt = new Date();
    if (plan.tiersToRecord.length > 0) {
      await tx.user_badge_history.createMany({
        data: plan.tiersToRecord.map((tier) => ({
          user_id: userId,
          badge_id: badge.badge_id,
          badge_tier_id: tier.tierId,
          earned_at: earnedAt,
        })),
        skipDuplicates: true,
      });
    }

    if (plan.promoteTo) {
      await tx.user_badges.upsert({
        where: { user_id_badge_id: { user_id: userId, badge_id: badge.badge_id } },
        create: {
          user_id: userId,
          badge_id: badge.badge_id,
          badge_tier_id: plan.promoteTo.tierId,
          earned_at: earnedAt,
        },
        update: {
          badge_tier_id: plan.promoteTo.tierId,
          earned_at: earnedAt,
        },
      });
    }

    return { awarded: plan.tiersToRecord, earnedAt: earnedAt.toISOString() };
  });
};

/**
 * Evaluates one condition for one user and awards every tier they now qualify
 * for. Safe to call repeatedly: an already-recorded tier is never duplicated and
 * a higher tier is never replaced by a lower one.
 */
export const evaluateCondition = async (
  userId: string,
  conditionType: string,
  options: { dryRun?: boolean } = {}
): Promise<ConditionEvaluationResult> => {
  if (!badgeConditionRegistry.has(conditionType)) {
    return { conditionType, status: 'unregistered', progress: null, awarded: [] };
  }

  const progress = await badgeConditionRegistry.getProgress(conditionType, userId);
  const badges = await prisma.badges.findMany({
    where: { condition_type: conditionType, status: 'active' },
    include: { badge_tiers: { orderBy: { tier_level: 'asc' } } },
  });

  if (badges.length === 0) {
    return { conditionType, status: 'no_active_badge', progress, awarded: [] };
  }

  const awarded: AwardedTier[] = [];
  for (const badge of badges) {
    if (badge.badge_tiers.length === 0) continue;

    if (options.dryRun) {
      const state = await loadBadgeState(prisma, userId, badge.badge_id);
      const plan = planAwards({
        tiers: badge.badge_tiers.map(mapTier),
        progress,
        unlockedTierIds: state.unlockedTierIds,
        currentTierLevel: state.currentTierLevel,
      });
      awarded.push(...mapAwarded(badge, plan.tiersToRecord, null));
      continue;
    }

    const state = await loadBadgeState(prisma, userId, badge.badge_id);
    const plan = planAwards({
      tiers: badge.badge_tiers.map(mapTier),
      progress,
      unlockedTierIds: state.unlockedTierIds,
      currentTierLevel: state.currentTierLevel,
    });
    if (plan.tiersToRecord.length === 0 && !plan.promoteTo) continue;

    const result = await persistPlan({ userId, badge, progress });
    awarded.push(...mapAwarded(badge, result.awarded, result.earnedAt));
  }

  return { conditionType, status: 'evaluated', progress, awarded };
};

/** Every condition type that currently has an active Badge series. */
export const listActiveConditionTypes = async (): Promise<string[]> => {
  const rows = await prisma.badges.findMany({
    where: { status: 'active' },
    select: { condition_type: true },
    distinct: ['condition_type'],
  });
  return rows.map((row) => row.condition_type);
};

/**
 * Reconciliation entry point: evaluates every active condition for one user.
 * With `dryRun` it only reports what would be unlocked.
 */
export const evaluateUserAchievements = async (
  userId: string,
  options: { dryRun?: boolean; conditionTypes?: string[] } = {}
): Promise<ConditionEvaluationResult[]> => {
  const conditionTypes = options.conditionTypes ?? await listActiveConditionTypes();
  const results: ConditionEvaluationResult[] = [];
  for (const conditionType of conditionTypes) {
    results.push(await evaluateCondition(userId, conditionType, options));
  }
  return results;
};

/**
 * Post-commit hook for business flows. A Badge problem must never fail a payment,
 * so every error is logged and swallowed here.
 */
export const awardAfterActivity = async (
  userId: string,
  conditionTypes: string[],
  context = 'activity'
): Promise<ConditionEvaluationResult[]> => {
  const results: ConditionEvaluationResult[] = [];

  try {
    const issuedCount = await issueCompletedMissionRewards(userId, conditionTypes);
    if (issuedCount > 0) {
      console.info(`[MissionReward] Issued ${issuedCount} reward(s) after ${context} for user ${userId}`);
    }
  } catch (error) {
    console.error(`[MissionReward] Evaluation failed after ${context} for user ${userId}`, error);
  }

  for (const conditionType of conditionTypes) {
    try {
      results.push(await evaluateCondition(userId, conditionType));
    } catch (error) {
      console.error(
        `[BadgeAward] Evaluation failed after ${context} for user ${userId} (${conditionType})`,
        error
      );
    }
  }
  return results;
};
