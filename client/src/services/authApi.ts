import api from '../lib/axios';
import { AuthResponse, ApiResponse, DemoLoginRole, User } from '../types';

export interface DemoMerchantAccount {
  id: string;
  name: string;
}

export const authApi = {
  listDemoMerchants: async (): Promise<DemoMerchantAccount[]> => {
    const response = await api.get<ApiResponse<DemoMerchantAccount[]>>('/auth/demo-merchants');
    return response.data.data;
  },

  demoLogin: async (role: DemoLoginRole, accountId?: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/demo-login', {
      role,
      ...(accountId ? { accountId } : {}),
    });
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },
};
