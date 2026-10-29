import api from '../lib/axios';

export type SocialImpactRange = 7 | 30 | 90 | 365;

export interface SocialImpactTimelinePoint {
  date: string;
  totalCirculation: number;
  governmentContribution: number;
  citizenContribution: number;
  transactionCount: number;
}

export interface SocialImpactSummary {
  rangeDays: SocialImpactRange;
  refreshedAt: string;
  summary: {
    totalCirculation: number;
    governmentContribution: number;
    citizenContribution: number;
    transactionCount: number;
  };
  timeline: SocialImpactTimelinePoint[];
}

export interface SocialImpactLocation {
  latitude: number;
  longitude: number;
  totalCirculation: number;
  transactionCount: number;
}

export interface SocialImpactHeatmap {
  rangeDays: SocialImpactRange;
  refreshedAt: string;
  coordinatePrecision: string;
  locations: SocialImpactLocation[];
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export const getSocialImpactSummary = async (days: SocialImpactRange): Promise<SocialImpactSummary> => {
  const response = await api.get<ApiResponse<SocialImpactSummary>>('/admin/social-impact/summary', {
    params: { days },
  });
  return response.data.data;
};

export const getSocialImpactHeatmap = async (days: SocialImpactRange): Promise<SocialImpactHeatmap> => {
  const response = await api.get<ApiResponse<SocialImpactHeatmap>>('/admin/social-impact/heatmap', {
    params: { days },
  });
  return response.data.data;
};
