import api from '../lib/axios';

export type MerchantApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MerchantApplicationDocument {
  id: string;
  type: string;
  label: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  signedUrl?: string;
}

export interface MerchantApplication {
  id: string;
  businessType: 'INDIVIDUAL' | 'JURISTIC';
  taxId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  status: MerchantApplicationStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  documents: MerchantApplicationDocument[];
  history?: Array<{
    action: string;
    note: string | null;
    createdAt: string;
    reviewedBy: string;
  }>;
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export const submitMerchantApplication = async (formData: FormData): Promise<{ applicationId: string; status: string }> => {
  const response = await api.post<ApiResponse<{ applicationId: string; status: string }>>(
    '/merchant/applications',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data.data;
};

export const getMerchantApplications = async (status: MerchantApplicationStatus): Promise<MerchantApplication[]> => {
  const response = await api.get<ApiResponse<MerchantApplication[]>>('/merchant/applications', {
    params: { status },
  });
  return response.data.data;
};

export const getMerchantApplication = async (id: string): Promise<MerchantApplication> => {
  const response = await api.get<ApiResponse<MerchantApplication>>(`/merchant/applications/${id}`);
  return response.data.data;
};

export const decideMerchantApplication = async (
  id: string,
  action: 'APPROVE' | 'REJECT',
  note?: string
): Promise<{ applicationId: string; status: MerchantApplicationStatus; merchantId?: string }> => {
  const response = await api.patch<ApiResponse<{ applicationId: string; status: MerchantApplicationStatus; merchantId?: string }>>(
    `/merchant/applications/${id}/decision`,
    { action, note }
  );
  return response.data.data;
};
