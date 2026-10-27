import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { BadgeConditionHandler } from '../conditionRegistry';
import { ELIGIBLE_TRANSACTION_STATUSES } from './eligibleActivity';

export type SpendingProgressClient = Pick<PrismaClient, 'transactions'>;

/**
 * Cumulative citizen spending for completed transactions.
 *
 * Interpretation: `citizen_paid_amount` is the money the citizen actually paid
 * from their wallet. `total_amount` also includes the government co-pay subsidy,
 * which is not the citizen's spending. Summation happens in PostgreSQL DECIMAL;
 * the value is converted once, after rounding to two decimals, because Badge
 * thresholds are stored as whole baht (`badge_tiers.required_count` is INTEGER).
 */
export const createTotalSpendingHandler = (
  client: SpendingProgressClient
): BadgeConditionHandler => ({
  conditionType: 'total_spending',
  getProgress: async (userId) => {
    const result = await client.transactions.aggregate({
      where: {
        user_id: userId,
        status: { in: [...ELIGIBLE_TRANSACTION_STATUSES] },
      },
      _sum: { citizen_paid_amount: true },
    });

    const total = result._sum.citizen_paid_amount ?? new Prisma.Decimal(0);
    const rounded = Number(total.toFixed(2));
    return Number.isFinite(rounded) && rounded > 0 ? rounded : 0;
  },
});
