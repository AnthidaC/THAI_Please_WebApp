import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { badgeConditionRegistry } from './achievements/conditionRegistry';
import { ConditionTypeCreateInput, ConditionTypeUpdateInput } from '../validations/condition-type.validation';

export class AdminConditionTypeServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AdminConditionTypeServiceError';
  }
}

const conditionTypeInclude = {
  badges: { select: { badge_id: true, badge_name: true, status: true } },
};

const mapConditionType = (row: any) => ({
  id: row.condition_type_id,
  key: row.condition_key,
  displayName: row.display_name,
  description: row.description,
  measurementUnit: row.measurement_unit,
  implementationStatus: row.implementation_status,
  handlerRegistered: badgeConditionRegistry.has(row.condition_key),
  badge: row.badges[0]
    ? { id: row.badges[0].badge_id, name: row.badges[0].badge_name, status: row.badges[0].status }
    : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const withDatabaseErrors = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AdminConditionTypeServiceError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new AdminConditionTypeServiceError('รหัสประเภทเงื่อนไขนี้มีอยู่แล้ว', 409);
      if (error.code === 'P2025') throw new AdminConditionTypeServiceError('ไม่พบประเภทเงื่อนไขนี้', 404);
    }
    throw error;
  }
};

export const adminConditionTypeService = {
  list: (filters: { implementation_status?: string; handler_registered?: 'true' | 'false' }) =>
    withDatabaseErrors(async () => {
      const rows = await prisma.badge_condition_types.findMany({
        where: filters.implementation_status ? { implementation_status: filters.implementation_status } : undefined,
        orderBy: [{ implementation_status: 'asc' }, { display_name: 'asc' }],
        include: conditionTypeInclude,
      });
      const definitions = rows.map(mapConditionType);
      return filters.handler_registered
        ? definitions.filter((item) => item.handlerRegistered === (filters.handler_registered === 'true'))
        : definitions;
    }),

  get: (id: string) => withDatabaseErrors(async () => {
    const row = await prisma.badge_condition_types.findUnique({
      where: { condition_type_id: id },
      include: conditionTypeInclude,
    });
    if (!row) throw new AdminConditionTypeServiceError('ไม่พบประเภทเงื่อนไขนี้', 404);
    return mapConditionType(row);
  }),

  create: (input: ConditionTypeCreateInput) => withDatabaseErrors(async () => {
    const row = await prisma.badge_condition_types.create({
      data: {
        condition_key: input.conditionKey,
        display_name: input.displayName,
        description: input.description ?? null,
        measurement_unit: input.measurementUnit,
      },
      include: conditionTypeInclude,
    });
    return mapConditionType(row);
  }),

  update: (id: string, input: ConditionTypeUpdateInput) => withDatabaseErrors(async () =>
    prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ condition_type_id: string }>>`
        SELECT condition_type_id FROM public.badge_condition_types
        WHERE condition_type_id = ${id}::uuid FOR UPDATE
      `;
      if (!rows.length) throw new AdminConditionTypeServiceError('ไม่พบประเภทเงื่อนไขนี้', 404);

      const current = await tx.badge_condition_types.findUniqueOrThrow({ where: { condition_type_id: id } });
      if (input.implementationStatus === 'ready' && !badgeConditionRegistry.has(current.condition_key)) {
        throw new AdminConditionTypeServiceError('ยังไม่มีตัวประมวลผลในระบบ จึงตั้งสถานะพร้อมใช้งานไม่ได้', 409);
      }

      const row = await tx.badge_condition_types.update({
        where: { condition_type_id: id },
        data: {
          ...(input.displayName !== undefined && { display_name: input.displayName }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.measurementUnit !== undefined && { measurement_unit: input.measurementUnit }),
          ...(input.implementationStatus !== undefined && { implementation_status: input.implementationStatus }),
        },
        include: conditionTypeInclude,
      });

      if (input.implementationStatus && input.implementationStatus !== 'ready') {
        await tx.badges.updateMany({
          where: { condition_type: current.condition_key, status: 'active' },
          data: { status: 'inactive' },
        });
      }
      return mapConditionType(row);
    })
  ),
};
