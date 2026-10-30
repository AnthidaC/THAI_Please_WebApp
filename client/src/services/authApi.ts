import api from '../lib/axios';
import { AuthResponse, ApiResponse, DemoLoginRole, User } from '../types';

export interface DemoLoginAccount {
  id: string;
  name: string;
  email: string | null;
}

export interface CitizenRegisterPayload {
  fullName: string;
  citizenId: string;
  provinceCode: string;
  email: string;
  password: string;
}

export interface CitizenRegisterResponse {
  status: 'success';
  data: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  };
  message: string;
}

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  registerCitizen: async (payload: CitizenRegisterPayload): Promise<CitizenRegisterResponse> => {
    const response = await api.post<CitizenRegisterResponse>('/auth/register-citizen', payload);
    return response.data;
  },

  listDemoCitizens: async (): Promise<DemoLoginAccount[]> => {
    const response = await api.get<ApiResponse<DemoLoginAccount[]>>('/auth/demo-citizens');
    return response.data.data;
  },

  listDemoMerchants: async (): Promise<DemoLoginAccount[]> => {
    const response = await api.get<ApiResponse<DemoLoginAccount[]>>('/auth/demo-merchants');
    return response.data.data;
  },

  listDemoAdmins: async (): Promise<DemoLoginAccount[]> => {
    const response = await api.get<ApiResponse<DemoLoginAccount[]>>('/auth/demo-admins');
    return response.data.data;
  },

  demoLogin: async (role: DemoLoginRole, accountId?: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/demo-login', {
      role,
      ...(accountId ? { accountId } : {}),
    });
    return response.data;
  },

  loginMerchant: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/merchant-applications/login', credentials);
    return response.data;
  },

  loginStaff: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/staff/login', credentials);
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },
};
