import api from '../lib/axios';

export interface CitizenBadgeTier {
  id: string;
  name: string;
  level: number;
  requiredCount: number;
  iconUrl: string | null;
  unlocked: boolean;
  earnedAt: string | null;
}

export interface CitizenBadge {
  id: string;
  name: string;
  description: string | null;
  conditionType: string;
  conditionDisplayName: string;
  iconUrl: string | null;
  progress: number | null;
  currentTier: CitizenBadgeTier | null;
  nextTier: CitizenBadgeTier | null;
  isMaxTier: boolean;
  isUnlocked: boolean;
  tiers: CitizenBadgeTier[];
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export const getMyBadges = async (): Promise<CitizenBadge[]> => {
  const response = await api.get<ApiResponse<CitizenBadge[]>>('/me/badges');
  return response.data.data;
};

export const getMyBadge = async (badgeId: string): Promise<CitizenBadge> => {
  const response = await api.get<ApiResponse<CitizenBadge>>(`/me/badges/${badgeId}`);
  return response.data.data;
};
