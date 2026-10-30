import prisma from '../utils/prisma';
import { issueCompletedMissionRewards } from './citizenMissionReward.service';

export interface CitizenRewardView {
  userRewardId: string;
  rewardCode: string;
  rewardName: string;
  rewardType: string;
  discountType: string | null;
  discountValue: number | null;
  minimumSpend: number;
  status: string;
  earnedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
}

export const listCitizenRewards = async (
  userId: string,
  now = new Date()
): Promise<CitizenRewardView[]> => {
  // Recover eligible mission rewards for users who completed a mission before
  // the post-activity reward hook was available.
  await issueCompletedMissionRewards(userId);

  const userRewards = await prisma.user_rewards.findMany({
    where: { user_id: userId },
    include: { rewards: true },
    orderBy: { earned_at: 'desc' },
  });

  return userRewards.map((userReward) => {
    const isExpired = Boolean(userReward.expires_at && userReward.expires_at <= now);

    return {
      userRewardId: userReward.user_reward_id,
      rewardCode: userReward.reward_code,
      rewardName: userReward.rewards.reward_name,
      rewardType: userReward.rewards.reward_type,
      discountType: userReward.rewards.discount_type,
      discountValue: userReward.rewards.discount_value === null
        ? null
        : Number(userReward.rewards.discount_value),
      minimumSpend: Number(userReward.rewards.minimum_spend),
      status: isExpired && userReward.status === 'available' ? 'expired' : userReward.status,
      earnedAt: userReward.earned_at.toISOString(),
      expiresAt: userReward.expires_at?.toISOString() ?? null,
      usedAt: userReward.used_at?.toISOString() ?? null,
    };
  });
};
