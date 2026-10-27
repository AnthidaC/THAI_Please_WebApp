import type { PrismaClient } from '@prisma/client';
import type { BadgeConditionHandler } from '../conditionRegistry';
import { CONVERTED_REFERRAL_STATUS } from './eligibleActivity';

export type ReferralProgressClient = Pick<PrismaClient, 'referrals'>;

/**
 * Counts referrals owned by the user that reached the converted state.
 * `converted_at` is written with the same update as the status, so requiring it
 * rejects half-written or manually inserted rows.
 */
export const createReferralCountHandler = (
  client: ReferralProgressClient
): BadgeConditionHandler => ({
  conditionType: 'referral_count',
  getProgress: (userId) => client.referrals.count({
    where: {
      referrer_user_id: userId,
      status: CONVERTED_REFERRAL_STATUS,
      converted_at: { not: null },
    },
  }),
});
