import api from '../lib/axios';
import type { ApiResponse } from '../types';

export interface CitizenMission {
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

export const getMyMissions = async (): Promise<CitizenMission[]> => {
  const response = await api.get<ApiResponse<CitizenMission[]>>('/me/missions');
  return response.data.data;
};
