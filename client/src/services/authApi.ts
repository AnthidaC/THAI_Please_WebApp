import api from '../lib/axios';
import { AuthResponse, ApiResponse, DemoLoginRole, User } from '../types';

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
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
