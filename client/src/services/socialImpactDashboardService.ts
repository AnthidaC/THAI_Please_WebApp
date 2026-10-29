import api from '../lib/axios';

export type ImpactLevel = 'province' | 'district' | 'subdistrict';
export interface ImpactArea {
  code: string;
  name: string;
  provinceCode: string;
  totalCirculation: number;
  benefitedMerchantDays: number;
}
export interface ImpactDay { date: string; totalCirculation: number; }
export interface ImpactDashboardData {
  source: 'mock' | 'daily_social_impact_metrics';
  level: ImpactLevel;
  areas: ImpactArea[];
  timeline: ImpactDay[];
  totalCirculation: number;
  benefitedMerchantDays: number;
  secondaryCityShare: number | null;
  detailUnavailable?: boolean;
}
export interface BoundaryProperties extends Record<string, unknown> {
  pro_code?: string;
  pro_th?: string;
  amp_code?: string;
  amp_th?: string;
  tam_code?: string;
  tam_th?: string;
}
export interface BoundaryFeature {
  type: 'Feature';
  properties: BoundaryProperties;
  geometry: GeoJSON.Geometry;
}
export interface BoundaryCollection { type: 'FeatureCollection'; features: BoundaryFeature[]; }

export const loadThailandBoundaries = async (level: ImpactLevel): Promise<BoundaryCollection> => {
  const data = level === 'province'
    ? await import('../data/thai-boundaries/provinces.geojson?url')
    : level === 'district'
      ? await import('../data/thai-boundaries/districts.geojson?url')
      : await import('../data/thai-boundaries/subdistricts.geojson?url');
  const response = await fetch(data.default);
  if (!response.ok) throw new Error('Failed to load boundaries');
  return response.json() as Promise<BoundaryCollection>;
};

interface DashboardParams {
  level: ImpactLevel;
  from: string;
  to: string;
  parentProvinceCode?: string;
  parentDistrictCode?: string;
  features: BoundaryFeature[];
}

interface ApiArea { province?: string | null; totalCirculation: number; benefitedMerchantDays: number; }
interface ApiDashboard {
  source: 'daily_social_impact_metrics';
  level: ImpactLevel;
  areas: ApiArea[];
  timeline: ImpactDay[];
  totalCirculation: number;
  benefitedMerchantDays: number;
  secondaryCityShare: null;
  detailUnavailable?: boolean;
}

const apiEnabled = import.meta.env.VITE_SOCIAL_IMPACT_DASHBOARD_API === 'true';
const areaCode = (feature: BoundaryFeature, level: ImpactLevel) => String(level === 'province' ? feature.properties.pro_code : level === 'district' ? feature.properties.amp_code : feature.properties.tam_code ?? '');
const areaName = (feature: BoundaryFeature, level: ImpactLevel) => String(level === 'province' ? feature.properties.pro_th : level === 'district' ? feature.properties.amp_th : feature.properties.tam_th ?? '');

const mockDashboard = ({ level, from, to, parentProvinceCode, parentDistrictCode, features }: DashboardParams): ImpactDashboardData => {
  const selected = features.filter((feature) => {
    if (level === 'district' && parentProvinceCode && feature.properties.pro_code !== parentProvinceCode) return false;
    if (level === 'subdistrict' && parentDistrictCode && feature.properties.amp_code !== parentDistrictCode) return false;
    return true;
  });
  const days = Math.max(1, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1);
  const areas = selected.map((feature) => {
    const numericCode = Number(areaCode(feature, level)) || 1;
    return {
      code: areaCode(feature, level), name: areaName(feature, level), provinceCode: String(feature.properties.pro_code ?? ''),
      totalCirculation: (numericCode * 7919 % 2400000) + 50000,
      benefitedMerchantDays: (numericCode * 13 % 240) + 8,
    };
  });
  const totalCirculation = areas.reduce((sum, area) => sum + area.totalCirculation, 0);
  const date = new Date(`${from}T00:00:00`);
  const timeline = Array.from({ length: Math.min(days, 365) }, (_, index) => {
    const current = new Date(date.getTime() + index * 86400000);
    return { date: current.toISOString().slice(0, 10), totalCirculation: Math.round(totalCirculation / Math.min(days, 365) * (0.7 + ((index * 17) % 60) / 100)) };
  });
  const timelineSum = timeline.reduce((sum, day) => sum + day.totalCirculation, 0);
  return {
    source: 'mock', level, areas, timeline, totalCirculation: timelineSum,
    benefitedMerchantDays: areas.reduce((sum, area) => sum + area.benefitedMerchantDays, 0),
    secondaryCityShare: null,
  };
};

export const getImpactDashboard = async (params: DashboardParams): Promise<ImpactDashboardData> => {
  if (!apiEnabled) return mockDashboard(params);
  const response = await api.get<{ status: 'success'; data: ApiDashboard }>('/admin/social-impact/dashboard', {    params: {
      level: params.level, code: params.parentProvinceCode ?? params.parentDistrictCode,
      provinceName: params.level === 'province' ? undefined : params.features.find((feature) => feature.properties.pro_th)?.properties.pro_th,
      from: params.from, to: params.to,
    },
  });
  const result = response.data.data;
  if (result.detailUnavailable) return { ...result, areas: [], detailUnavailable: true };
  const provinceFeatures = params.features;
  const areas = result.areas.flatMap((area) => {
    const match = provinceFeatures.find((feature) => feature.properties.pro_th === area.province);
    if (!match) return [];
    return [{ code: String(match.properties.pro_code), name: String(area.province), provinceCode: String(match.properties.pro_code), totalCirculation: area.totalCirculation, benefitedMerchantDays: area.benefitedMerchantDays }];
  });
  return { ...result, areas };
};
