import api from '../lib/axios';
import type { ApiResponse } from '../types';

export interface CitizenReward {
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

export const getMyRewards = async (): Promise<CitizenReward[]> => {
  const response = await api.get<ApiResponse<CitizenReward[]>>('/me/rewards');
  return response.data.data;
};
