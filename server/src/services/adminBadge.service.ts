import { Prisma } from '@prisma/client';
import { BadgeTierInput } from '../validations/badge-management.validation';
import {
  assertEarnedTiersUnchanged,
  getBadgeActivationBlocker,
  TierDefinition,
} from './badge-management.rules';
import { badgeConditionRegistry } from './achievements/conditionRegistry';
import prisma from '../utils/prisma';

export class AdminBadgeServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AdminBadgeServiceError';
  }
}

const badgeDetails = {
  condition_type_definition: { select: { display_name: true, implementation_status: true } },
  badge_tiers: {
    orderBy: { tier_level: 'asc' as const },
    include: { _count: { select: { user_badges: true, user_badge_history: true } } },
  },
  _count: { select: { user_badges: true } },
};

const mapBadge = (row: any) => {
  const handlerRegistered = badgeConditionRegistry.has(row.condition_type);
  return {
    id: row.badge_id,
    name: row.badge_name,
    description: row.description,
    conditionType: row.condition_type,
    conditionDisplayName: row.condition_type_definition?.display_name ?? row.condition_type,
    conditionTypeImplementationStatus: row.condition_type_definition?.implementation_status ?? 'pending',
    status: row.status,
    implementationStatus: row.implementation_status,
    handlerRegistered,
    activationEligible: getBadgeActivationBlocker({
      implementationStatus: row.implementation_status,
      conditionType: row.condition_type,
      tierCount: row.badge_tiers.length,
      handlerRegistered: handlerRegistered && row.condition_type_definition?.implementation_status === 'ready',
    }) === null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    tierCount: row.badge_tiers.length,
    awardedCount: row._count?.user_badges ?? 0,
    tiers: row.badge_tiers.map((tier: any) => ({
      id: tier.tier_id,
      name: tier.tier_name,
      level: tier.tier_level,
      requiredCount: tier.required_count,
      iconUrl: tier.icon_url,
      earnedCount: tier._count?.user_badge_history ?? 0,
    })),
  };
};

const translateDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new AdminBadgeServiceError('มีเหรียญตราหรือระดับที่ใช้ข้อมูลนี้อยู่แล้ว', 409);
    if (error.code === 'P2003') throw new AdminBadgeServiceError('ไม่สามารถลบหรือย้ายระดับที่มีผู้ได้รับแล้วได้', 409);
    if (error.code === 'P2025') throw new AdminBadgeServiceError('ไม่พบเหรียญตรานี้', 404);
  }
  throw error;
};

const withDatabaseErrors = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    return translateDatabaseError(error);
  }
};

const mapTierDefinition = (tier: any): TierDefinition => ({
  tierId: tier.tier_id,
  tierName: tier.tier_name,
  tierLevel: tier.tier_level,
  requiredCount: tier.required_count,
  iconUrl: tier.icon_url,
});

const tierData = (tier: BadgeTierInput) => ({
  tier_name: tier.tierName,
  tier_level: tier.tierLevel,
  required_count: tier.requiredCount,
  icon_url: tier.iconUrl ?? null,
});

const lockBadge = async (tx: Prisma.TransactionClient, id: string): Promise<boolean> => {
  const rows = await tx.$queryRaw<Array<{ badge_id: string }>>`
    SELECT badge_id FROM badges WHERE badge_id = ${id}::uuid FOR UPDATE
  `;
  return rows.length > 0;
};

const ensureEarnedTiersCanBeChanged = (
  existingTiers: Array<any>,
  requestedTiers: BadgeTierInput[]
): void => {
  const earned = existingTiers
    .filter((tier) => tier._count.user_badges > 0 || tier._count.user_badge_history > 0)
    .map(mapTierDefinition);
  try {
    assertEarnedTiersUnchanged(earned, requestedTiers.map((tier) => ({
      tierId: tier.tierId,
      tierName: tier.tierName,
      tierLevel: tier.tierLevel,
      requiredCount: tier.requiredCount,
      iconUrl: tier.iconUrl ?? null,
    })));
  } catch (error) {
    throw new AdminBadgeServiceError((error as Error).message, 409);
  }
};

export interface BadgeCreateInput {
  badgeName: string;
  description?: string | null;
  conditionType: string;
  tiers: BadgeTierInput[];
}

type BadgeUpdateInput = {
  badgeName?: string;
  description?: string | null;
  tiers?: BadgeTierInput[];
};

export const toBadgeCreateData = (input: BadgeCreateInput) => ({
  badge_name: input.badgeName,
  description: input.description ?? null,
  condition_type: input.conditionType,
  // Nested tier creation is one Prisma write; database defaults force inactive/pending.
  badge_tiers: { create: input.tiers.map((tier) => tierData(tier)) },
});

export const adminBadgeService = {
  list: (filters: { status?: 'active' | 'inactive'; implementation_status?: 'pending' | 'in_progress' | 'ready' }) =>
    withDatabaseErrors(async () => {
      const rows = await prisma.badges.findMany({
        where: {
          ...(filters.status && { status: filters.status }),
          ...(filters.implementation_status && { implementation_status: filters.implementation_status }),
        },
        orderBy: { created_at: 'desc' },
        include: badgeDetails,
      });
      return rows.map(mapBadge);
    }),

  get: (id: string) => withDatabaseErrors(async () => {
    const row = await prisma.badges.findUnique({ where: { badge_id: id }, include: badgeDetails });
    if (!row) throw new AdminBadgeServiceError('Badge not found', 404);
    return mapBadge(row);
  }),

  listConditionTypes: async () => ({ supported: badgeConditionRegistry.listConditionTypes() }),

  create: (input: BadgeCreateInput) => withDatabaseErrors(async () => {
    const conditionType = await prisma.badge_condition_types.findUnique({
      where: { condition_key: input.conditionType },
      select: { condition_key: true },
    });
    if (!conditionType) {
      throw new AdminBadgeServiceError('กรุณาเลือกประเภทเงื่อนไขจากรายการที่ลงทะเบียนไว้', 400);
    }
    const row = await prisma.badges.create({
      data: toBadgeCreateData(input),
      include: badgeDetails,
    });
    return mapBadge(row);
  }),

  update: (id: string, input: BadgeUpdateInput) => withDatabaseErrors(async () => {
    return prisma.$transaction(async (tx) => {
      if (!await lockBadge(tx, id)) throw new AdminBadgeServiceError('Badge not found', 404);
      const current = await tx.badges.findUnique({
        where: { badge_id: id },
        include: {
          badge_tiers: { include: { _count: { select: { user_badges: true, user_badge_history: true } } } },
        },
      });
      if (!current) throw new AdminBadgeServiceError('Badge not found', 404);

      if (input.tiers) {
        const tierDefinitionsUnchanged = current.badge_tiers.length === input.tiers.length
          && current.badge_tiers.every((existing) => {
            const requested = input.tiers?.find((tier) => tier.tierId === existing.tier_id);
            return requested !== undefined
              && requested.tierName === existing.tier_name
              && requested.tierLevel === existing.tier_level
              && requested.requiredCount === existing.required_count
              && (requested.iconUrl ?? null) === existing.icon_url;
          });

        if (current.status === 'active' && !tierDefinitionsUnchanged) {
          throw new AdminBadgeServiceError('Deactivate this Badge before changing its tiers', 409);
        }

        const currentById = new Map(current.badge_tiers.map((tier) => [tier.tier_id, tier]));
        for (const tier of input.tiers) {
          if (tier.tierId && !currentById.has(tier.tierId)) {
            throw new AdminBadgeServiceError('A tier does not belong to this Badge', 400);
          }
        }
        if (!tierDefinitionsUnchanged) {
          ensureEarnedTiersCanBeChanged(current.badge_tiers, input.tiers);

          const requestedIds = new Set(input.tiers.flatMap((tier) => tier.tierId ? [tier.tierId] : []));
          const removedIds = current.badge_tiers
            .filter((tier) => !requestedIds.has(tier.tier_id))
            .map((tier) => tier.tier_id);

          // Both tier uniqueness constraints and the database ordering trigger are
          // deferred so a valid multi-tier edit is checked as one final state.
          await tx.$executeRawUnsafe(
            'SET CONSTRAINTS uq_badge_tiers_badge_level, uq_badge_tiers_badge_required_count DEFERRED'
          );

          if (removedIds.length) {
            await tx.badge_tiers.deleteMany({ where: { badge_id: id, tier_id: { in: removedIds } } });
          }
          for (const tier of input.tiers) {
            if (tier.tierId) {
              await tx.badge_tiers.update({ where: { tier_id: tier.tierId }, data: tierData(tier) });
            } else {
              await tx.badge_tiers.create({ data: { badge_id: id, ...tierData(tier) } });
            }
          }
        }
      }

      await tx.badges.update({
        where: { badge_id: id },
        data: {
          ...(input.badgeName !== undefined && { badge_name: input.badgeName }),
          ...(input.description !== undefined && { description: input.description }),
        },
      });

      const updated = await tx.badges.findUniqueOrThrow({ where: { badge_id: id }, include: badgeDetails });
      return mapBadge(updated);
    });
  }),

  updateImplementationStatus: (id: string, implementationStatus: 'pending' | 'in_progress' | 'ready') =>
    withDatabaseErrors(async () => prisma.$transaction(async (tx) => {
      if (!await lockBadge(tx, id)) throw new AdminBadgeServiceError('Badge not found', 404);
      const current = await tx.badges.findUniqueOrThrow({ where: { badge_id: id } });
      const canRemainActive = implementationStatus === 'ready' && badgeConditionRegistry.has(current.condition_type);
      const row = await tx.badges.update({
        where: { badge_id: id },
        data: {
          implementation_status: implementationStatus,
          ...(!canRemainActive && { status: 'inactive' }),
        },
        include: badgeDetails,
      });
      return mapBadge(row);
    })),

  activate: (id: string) => withDatabaseErrors(async () => prisma.$transaction(async (tx) => {
    if (!await lockBadge(tx, id)) throw new AdminBadgeServiceError('Badge not found', 404);
    const badge = await tx.badges.findUnique({ where: { badge_id: id }, include: { badge_tiers: true } });
    if (!badge) throw new AdminBadgeServiceError('Badge not found', 404);
    const blocker = getBadgeActivationBlocker({
      implementationStatus: badge.implementation_status,
      conditionType: badge.condition_type,
      tierCount: badge.badge_tiers.length,
      handlerRegistered: badgeConditionRegistry.has(badge.condition_type),
    });
    if (blocker) throw new AdminBadgeServiceError(blocker, 409);
    const conditionType = await tx.badge_condition_types.findUnique({
      where: { condition_key: badge.condition_type },
      select: { implementation_status: true },
    });
    if (conditionType?.implementation_status !== 'ready') {
      throw new AdminBadgeServiceError('ประเภทเงื่อนไขต้องพร้อมใช้งานและมีตัวประมวลผลในระบบก่อนเปิดเหรียญตรา', 409);
    }
    const changed = await tx.badges.updateMany({
      where: { badge_id: id, implementation_status: 'ready' },
      data: { status: 'active' },
    });
    if (!changed.count) throw new AdminBadgeServiceError('Implementation status changed; reload the Badge and retry activation', 409);
    return mapBadge(await tx.badges.findUniqueOrThrow({ where: { badge_id: id }, include: badgeDetails }));
  })),

  deactivate: (id: string) => withDatabaseErrors(async () => {
    const row = await prisma.badges.update({ where: { badge_id: id }, data: { status: 'inactive' }, include: badgeDetails });
    return mapBadge(row);
  }),
};

