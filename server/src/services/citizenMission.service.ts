import prisma from '../utils/prisma';
import { badgeConditionRegistry } from './achievements/conditionRegistry';

export interface CitizenMissionView {
  id: string;
  name: string;
  description: string | null;
  conditionType: string;
  conditionDisplayName: string;
  targetValue: number;
  progress: number | null;
  campaignName: string | null;
  rewardName: string | null;
  startsAt: string;
  endsAt: string;
}

const getProgress = async (
  mission: {
    quest_id: string;
    condition_type: string;
    starts_at: Date;
    ends_at: Date;
  },
  userId: string
): Promise<number | null> => {
  if (!badgeConditionRegistry.has(mission.condition_type)) return null;

  try {
    return await badgeConditionRegistry.getProgress(mission.condition_type, userId, {
      startsAt: mission.starts_at,
      endsAt: mission.ends_at,
    });
  } catch (error) {
    console.warn('[Missions] Progress handler failed for ' + mission.quest_id, error);
    return null;
  }
};

export const listCitizenMissions = async (
  userId: string,
  now = new Date()
): Promise<CitizenMissionView[]> => {
  const missions = await prisma.quests.findMany({
    where: {
      status: 'active',
      starts_at: { lte: now },
      ends_at: { gte: now },
    },
    select: {
      quest_id: true,
      quest_name: true,
      description: true,
      condition_type: true,
      target_value: true,
      starts_at: true,
      ends_at: true,
      campaigns: { select: { campaign_name: true } },
      rewards: { select: { reward_name: true } },
      condition_type_definition: { select: { display_name: true } },
    },
    orderBy: [{ ends_at: 'asc' }, { created_at: 'asc' }],
  });

  return Promise.all(missions.map(async (mission) => ({
    id: mission.quest_id,
    name: mission.quest_name,
    description: mission.description,
    conditionType: mission.condition_type,
    conditionDisplayName: mission.condition_type_definition.display_name,
    targetValue: mission.target_value.toNumber(),
    progress: await getProgress(mission, userId),
    campaignName: mission.campaigns?.campaign_name ?? null,
    rewardName: mission.rewards?.reward_name ?? null,
    startsAt: mission.starts_at.toISOString(),
    endsAt: mission.ends_at.toISOString(),
  })));
};
