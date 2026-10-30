import { randomUUID } from 'node:crypto';
import prisma from '../utils/prisma';
import { badgeConditionRegistry } from './achievements/conditionRegistry';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Issues each qualifying mission reward once per citizen and quest. */
export const issueCompletedMissionRewards = async (
  userId: string,
  conditionTypes?: string[],
  now = new Date()
): Promise<number> => {
  const missions = await prisma.quests.findMany({
    where: {
      status: 'active',
      starts_at: { lte: now },
      ...(conditionTypes?.length ? { condition_type: { in: conditionTypes } } : {}),
    },
    include: { rewards: true },
    orderBy: [{ ends_at: 'asc' }, { created_at: 'asc' }],
  });

  let issuedCount = 0;

  for (const mission of missions) {
    const reward = mission.rewards;
    if (!reward || reward.status !== 'active' || !badgeConditionRegistry.has(mission.condition_type)) {
      continue;
    }

    let progress: number;
    try {
      progress = await badgeConditionRegistry.getProgress(mission.condition_type, userId, {
        startsAt: mission.starts_at,
        endsAt: mission.ends_at,
      });
    } catch (error) {
      console.warn('[MissionReward] Unable to evaluate mission ' + mission.quest_id, error);
      continue;
    }

    if (progress < mission.target_value.toNumber()) continue;

    const issued = await prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      const userQuest = await tx.user_quests.upsert({
        where: { user_id_quest_id: { user_id: userId, quest_id: mission.quest_id } },
        create: {
          user_id: userId,
          quest_id: mission.quest_id,
          progress_value: progress,
          status: 'completed',
          completed_at: completedAt,
        },
        update: {
          progress_value: progress,
          status: 'completed',
        },
      });

      const rewardEarnedAt = userQuest.completed_at ?? completedAt;
      if (!userQuest.completed_at) {
        await tx.user_quests.update({
          where: { user_quest_id: userQuest.user_quest_id },
          data: { completed_at: rewardEarnedAt },
        });
      }

      const existingReward = await tx.user_rewards.findFirst({
        where: { user_id: userId, quest_id: mission.quest_id },
        select: { user_reward_id: true },
      });
      if (existingReward) return false;

      await tx.user_rewards.create({
        data: {
          user_id: userId,
          quest_id: mission.quest_id,
          reward_id: reward.reward_id,
          reward_code: `QST-${randomUUID().replace(/-/g, '').toUpperCase()}`,
          status: 'available',
          earned_at: rewardEarnedAt,
          expires_at: new Date(rewardEarnedAt.getTime() + reward.valid_days * DAY_IN_MILLISECONDS),
        },
      });

      return true;
    });

    if (issued) issuedCount += 1;
  }

  return issuedCount;
};
