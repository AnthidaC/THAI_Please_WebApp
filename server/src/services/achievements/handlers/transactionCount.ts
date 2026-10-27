import type { PrismaClient } from '@prisma/client';
import type { BadgeConditionHandler } from '../conditionRegistry';
import { ELIGIBLE_TRANSACTION_STATUSES } from './eligibleActivity';

export type TransactionProgressClient = Pick<PrismaClient, 'transactions'>;

/** Counts completed, paid transactions. One row is one purchase, so no duplicates. */
export const createTransactionCountHandler = (
  client: TransactionProgressClient
): BadgeConditionHandler => ({
  conditionType: 'transaction_count',
  getProgress: (userId) => client.transactions.count({
    where: {
      user_id: userId,
      status: { in: [...ELIGIBLE_TRANSACTION_STATUSES] },
    },
  }),
});
