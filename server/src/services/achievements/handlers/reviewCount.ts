import type { PrismaClient } from '@prisma/client';
import type { BadgeConditionHandler, ProgressWindow } from '../conditionRegistry';
import { ELIGIBLE_TRANSACTION_STATUSES } from './eligibleActivity';

export type ReviewProgressClient = Pick<PrismaClient, 'reviews'>;

/**
 * Counts the user's verified-purchase reviews on completed transactions.
 * `reviews.transaction_id` is unique, so one purchase can only ever add one
 * review and the count cannot double for a replayed request.
 */
export const createReviewCountHandler = (
  client: ReviewProgressClient
): BadgeConditionHandler => ({
  conditionType: 'review_count',
  getProgress: (userId, window?: ProgressWindow) => client.reviews.count({
    where: {
      user_id: userId,
      is_verified_purchase: true,
      ...(window && { created_at: { gte: window.startsAt, lte: window.endsAt } }),
      transactions: { status: { in: [...ELIGIBLE_TRANSACTION_STATUSES] } },
    },
  }),
});
