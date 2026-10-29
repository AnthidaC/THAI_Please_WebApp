import prisma from '../utils/prisma';
import { badgeConditionRegistry } from './achievements/conditionRegistry';

export interface CitizenTierView {
  id: string;
  name: string;
  level: number;
  requiredCount: number;
  iconUrl: string | null;
  unlocked: boolean;
  earnedAt: string | null;
}

export interface CitizenBadgeView {
  id: string;
  name: string;
  description: string | null;
  conditionType: string;
  conditionDisplayName: string;
  iconUrl: string | null;
  /** Authoritative progress from the condition handler; null when it is unavailable. */
  progress: number | null;
  currentTier: CitizenTierView | null;
  nextTier: CitizenTierView | null;
  isMaxTier: boolean;
  isUnlocked: boolean;
  tiers: CitizenTierView[];
}

type BadgeRow = {
  badge_id: string;
  badge_name: string;
  description: string | null;
  condition_type: string;
  condition_type_definition: { display_name: string };
  badge_tiers: Array<{
    tier_id: string;
    tier_name: string;
    tier_level: number;
    required_count: number;
    icon_url: string | null;
  }>;
};

const progressForConditions = async (
  userId: string,
  conditionTypes: string[]
): Promise<Map<string, number | null>> => {
  const entries = await Promise.all(conditionTypes.map(async (conditionType) => {
    if (!badgeConditionRegistry.has(conditionType)) {
      return [conditionType, null] as const;
    }
    try {
      return [conditionType, await badgeConditionRegistry.getProgress(conditionType, userId)] as const;
    } catch (error) {
      console.warn(`[Badges] Progress handler failed for ${conditionType}`, error);
      return [conditionType, null] as const;
    }
  }));
  return new Map(entries);
};

const toView = (
  badge: BadgeRow,
  progress: number | null,
  currentTierId: string | null,
  earnedAtByTier: ReadonlyMap<string, string>
): CitizenBadgeView => {
  const tiers: CitizenTierView[] = badge.badge_tiers.map((tier) => ({
    id: tier.tier_id,
    name: tier.tier_name,
    level: tier.tier_level,
    requiredCount: tier.required_count,
    iconUrl: tier.icon_url,
    unlocked: earnedAtByTier.has(tier.tier_id),
    earnedAt: earnedAtByTier.get(tier.tier_id) ?? null,
  }));

  const currentTier = tiers.find((tier) => tier.id === currentTierId) ?? null;
  const nextTier = tiers.find((tier) => tier.level > (currentTier?.level ?? 0)) ?? null;
  const highestTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;

  return {
    id: badge.badge_id,
    name: badge.badge_name,
    description: badge.description,
    conditionType: badge.condition_type,
    conditionDisplayName: badge.condition_type_definition.display_name,
    iconUrl: currentTier?.iconUrl ?? nextTier?.iconUrl ?? null,
    progress,
    currentTier,
    nextTier,
    isMaxTier: currentTier !== null && highestTier !== null && currentTier.level === highestTier.level,
    isUnlocked: currentTier !== null,
    tiers,
  };
};

const loadUserBadgeRows = async (userId: string, badgeIds: string[]) => {
  if (badgeIds.length === 0) {
    return { currentByBadge: new Map(), earnedAtByTier: new Map<string, string>() };
  }
  const [current, history] = await Promise.all([
    prisma.user_badges.findMany({
      where: { user_id: userId, badge_id: { in: badgeIds } },
      select: { badge_id: true, badge_tier_id: true },
    }),
    prisma.user_badge_history.findMany({
      where: { user_id: userId, badge_id: { in: badgeIds } },
      select: { badge_tier_id: true, earned_at: true },
    }),
  ]);

  return {
    currentByBadge: new Map(current.map((row) => [row.badge_id, row.badge_tier_id])),
    earnedAtByTier: new Map(history.map((row) => [row.badge_tier_id, row.earned_at.toISOString()])),
  };
};

/**
 * Active Badges only. Progress is read once per condition type, so a list of many
 * Badges costs one aggregate query per distinct condition instead of one per Badge.
 */
export const listCitizenBadges = async (userId: string): Promise<CitizenBadgeView[]> => {
  const badges = await prisma.badges.findMany({
    where: { status: 'active' },
    include: {
      badge_tiers: { orderBy: { tier_level: 'asc' } },
      condition_type_definition: { select: { display_name: true } },
    },
    orderBy: { created_at: 'asc' },
  });
  if (badges.length === 0) return [];

  const conditionTypes = [...new Set(badges.map((badge) => badge.condition_type))];
  const [progressByCondition, state] = await Promise.all([
    progressForConditions(userId, conditionTypes),
    loadUserBadgeRows(userId, badges.map((badge) => badge.badge_id)),
  ]);

  return badges.map((badge) => toView(
    badge,
    progressByCondition.get(badge.condition_type) ?? null,
    state.currentByBadge.get(badge.badge_id) ?? null,
    state.earnedAtByTier
  ));
};

/** Returns null when the Badge does not exist or is not active for citizens. */
export const getCitizenBadge = async (
  userId: string,
  badgeId: string
): Promise<CitizenBadgeView | null> => {
  const badge = await prisma.badges.findFirst({
    where: { badge_id: badgeId, status: 'active' },
    include: {
      badge_tiers: { orderBy: { tier_level: 'asc' } },
      condition_type_definition: { select: { display_name: true } },
    },
  });
  if (!badge) return null;

  const [progressByCondition, state] = await Promise.all([
    progressForConditions(userId, [badge.condition_type]),
    loadUserBadgeRows(userId, [badge.badge_id]),
  ]);

  return toView(
    badge,
    progressByCondition.get(badge.condition_type) ?? null,
    state.currentByBadge.get(badge.badge_id) ?? null,
    state.earnedAtByTier
  );
};
