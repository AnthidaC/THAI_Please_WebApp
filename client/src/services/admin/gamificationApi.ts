import api from '../../lib/axios';

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | string;
export type RecordStatus = 'active' | 'paused' | 'archived' | 'draft' | 'completed' | string;
export type BadgeStatus = 'active' | 'inactive';
export type BadgeImplementationStatus = 'pending' | 'in_progress' | 'ready';

export interface CampaignPeriodRecord {
  id: string;
  name: string;
  quotaLimit: string;
  usedAmount: string;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED';
  allocationCount: number;
  isEditable: boolean;
}

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
  periods: CampaignPeriodRecord[];
}

export interface MissionRecord {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  rewardId: string | null;
  rewardName: string | null;
  name: string;
  description: string | null;
  conditionType: string;
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
  quotaLimit: number | null;
  validDays: number;
  status: RecordStatus;
  createdAt: string;
  issuedCount: number;
  redeemedCount: number;
}

export interface BadgeRecord {
  id: string;
  name: string;
  description: string | null;
  conditionType: string;
  conditionDisplayName: string;
  conditionTypeImplementationStatus: ConditionTypeStatus;
  status: BadgeStatus;
  implementationStatus: BadgeImplementationStatus;
  handlerRegistered: boolean;
  activationEligible: boolean;
  tierCount: number;
  tierStructureCompatible: boolean;
  createdAt: string;
  updatedAt: string;
  awardedCount: number;
  tiers: BadgeTierRecord[];
}

export interface BadgeTierRecord {
  id: string;
  name: string;
  level: number;
  requiredCount: number;
  iconUrl: string | null;
  earnedCount: number;
}

export interface BadgeConditionTypes {
  supported: string[];
}

export type ConditionTypeStatus = 'pending' | 'in_progress' | 'ready';
export type ConditionTypeUnit = 'count' | 'amount' | 'other';

export interface ConditionTypeRecord {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  measurementUnit: ConditionTypeUnit;
  implementationStatus: ConditionTypeStatus;
  handlerRegistered: boolean;
  badge: { id: string; name: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
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
  badges: async (filters: { status?: string; implementation_status?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
    const response = await api.get<ApiResponse<BadgeRecord[]>>(`/badges${query ? `?${query}` : ''}`);
    return response.data.data;
  },
  badgeConditionTypes: async () => {
    const response = await api.get<ApiResponse<BadgeConditionTypes>>('/badge-condition-types');
    return response.data.data;
  },
  conditionTypes: async (filters: { implementation_status?: ConditionTypeStatus; handler_registered?: boolean } = {}) => {
    const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])).toString();
    const response = await api.get<ApiResponse<ConditionTypeRecord[]>>(`/condition-types${query ? `?${query}` : ''}`);
    return response.data.data;
  },
  createConditionType: (body: Record<string, unknown>) => createRecord<ConditionTypeRecord>('/condition-types', body),
  updateConditionType: (id: string, body: Record<string, unknown>) => updateRecord<ConditionTypeRecord>('/condition-types', id, body),
  createBadge: (body: Record<string, unknown>) => createRecord<BadgeRecord>('/badges', body),
  updateBadge: (id: string, body: Record<string, unknown>) => updateRecord<BadgeRecord>('/badges', id, body),
  updateBadgeImplementationStatus: async (id: string, implementationStatus: BadgeImplementationStatus) => {
    const response = await api.patch<ApiResponse<BadgeRecord>>(`/badges/${id}/implementation-status`, { implementationStatus });
    return response.data.data;
  },
  activateBadge: (id: string) => api.post<ApiResponse<BadgeRecord>>(`/badges/${id}/activate`).then((response) => response.data.data),
  deactivateBadge: (id: string) => api.post<ApiResponse<BadgeRecord>>(`/badges/${id}/deactivate`).then((response) => response.data.data),
};
