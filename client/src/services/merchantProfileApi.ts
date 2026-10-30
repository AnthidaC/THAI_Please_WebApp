import api from '../lib/axios';

export interface MerchantProfile {
  merchantId: string;
  taxId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  pendingLocation: {
    requestId: string;
    latitude: number;
    longitude: number;
    requestedAt: string;
  } | null;
}

export interface MerchantProfileInput {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface ApprovedMerchantSummary {
  merchantId: string;
  businessName: string;
  taxId: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface MerchantLocationChangeRequest {
  requestId: string;
  requestedAt: string;
  merchantId: string;
  businessName: string;
  taxId: string;
  address: string;
  currentLatitude: number;
  currentLongitude: number;
  requestedLatitude: number;
  requestedLongitude: number;
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export const getOwnMerchantProfile = async (): Promise<MerchantProfile> => {
  const response = await api.get<ApiResponse<MerchantProfile>>('/merchant/profile');
  return response.data.data;
};

export const updateOwnMerchantProfile = async (profile: MerchantProfileInput): Promise<MerchantProfile> => {
  const response = await api.patch<ApiResponse<MerchantProfile>>('/merchant/profile', profile);
  return response.data.data;
};

export const getApprovedMerchants = async (): Promise<ApprovedMerchantSummary[]> => {
  const response = await api.get<ApiResponse<ApprovedMerchantSummary[]>>('/staff/merchants');
  return response.data.data;
};

export const getStaffMerchantProfile = async (merchantId: string): Promise<MerchantProfile> => {
  const response = await api.get<ApiResponse<MerchantProfile>>(`/staff/merchants/${merchantId}/profile`);
  return response.data.data;
};

export const updateStaffMerchantProfile = async (
  merchantId: string,
  profile: MerchantProfileInput
): Promise<MerchantProfile> => {
  const response = await api.patch<ApiResponse<MerchantProfile>>(
    `/staff/merchants/${merchantId}/profile`,
    profile
  );
  return response.data.data;
};

export const getMerchantLocationChangeRequests = async (): Promise<MerchantLocationChangeRequest[]> => {
  const response = await api.get<ApiResponse<MerchantLocationChangeRequest[]>>(
    '/staff/merchant-location-requests'
  );
  return response.data.data;
};

export const decideMerchantLocationChange = async (
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  note?: string
): Promise<{ requestId: string; status: 'APPROVED' | 'REJECTED' }> => {
  const response = await api.patch<ApiResponse<{ requestId: string; status: 'APPROVED' | 'REJECTED' }>>(
    `/staff/merchant-location-requests/${requestId}/decision`,
    { action, note }
  );
  return response.data.data;
};
