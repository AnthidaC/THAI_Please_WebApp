import api from '../../lib/axios';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | string;
export type RecordStatus = 'active' | 'paused' | 'archived' | 'draft' | 'completed' | string;

export interface CampaignRecord {
  id: string;
  name: string;
  governmentCopayRatePercent: string;
  citizenPaymentRatePercent: string;
  dailyQuotaLimit: string;
  totalQuotaLimit: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  createdAt: string;
  missionCount: number;
}

export interface MissionRecord {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  rewardId: string | null;
  rewardName: string | null;
  name: string;
  description: string | null;
  type: string;
  targetValue: string;
  startsAt: string;
  endsAt: string;
  status: RecordStatus;
  createdAt: string;
  participantCount: number;
}

export interface RewardRecord {
  id: string;
  name: string;
  description: string | null;
  type: string;
  discountType: string | null;
  discountValue: string | null;
  validDays: number;
  status: RecordStatus;
  createdAt: string;
  issuedCount: number;
}

export interface BadgeRecord {
  id: string;
  name: string;
  description: string | null;
  conditionType: string;
  thresholds: Partial<Record<'Bronze' | 'Silver' | 'Gold' | 'Rainbow', number>>;
  status: RecordStatus;
  createdAt: string;
  awardedCount: number;
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

const getList = async <T>(path: string): Promise<T[]> => {
  const response = await api.get<ApiResponse<T[]>>(path);
  return response.data.data;
};

const createRecord = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const response = await api.post<ApiResponse<T>>(path, body);
  return response.data.data;
};

const updateRecord = async <T>(path: string, id: string, body: Record<string, unknown>): Promise<T> => {
  const response = await api.patch<ApiResponse<T>>(`${path}/${id}`, body);
  return response.data.data;
};

export const gamificationApi = {
  campaigns: () => getList<CampaignRecord>('/campaigns'),
  createCampaign: (body: Record<string, unknown>) => createRecord<CampaignRecord>('/campaigns', body),
  updateCampaign: (id: string, body: Record<string, unknown>) => updateRecord<CampaignRecord>('/campaigns', id, body),
  missions: () => getList<MissionRecord>('/quests'),
  createMission: (body: Record<string, unknown>) => createRecord<MissionRecord>('/quests', body),
  updateMission: (id: string, body: Record<string, unknown>) => updateRecord<MissionRecord>('/quests', id, body),
  rewards: () => getList<RewardRecord>('/rewards'),
  createReward: (body: Record<string, unknown>) => createRecord<RewardRecord>('/rewards', body),
  updateReward: (id: string, body: Record<string, unknown>) => updateRecord<RewardRecord>('/rewards', id, body),
  badges: () => getList<BadgeRecord>('/badge-configs'),
  createBadge: (body: Record<string, unknown>) => createRecord<BadgeRecord>('/badge-configs', body),
  updateBadge: (id: string, body: Record<string, unknown>) => updateRecord<BadgeRecord>('/badge-configs', id, body),
};
