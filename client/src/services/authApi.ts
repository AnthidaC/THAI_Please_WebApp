import api from '../lib/axios';
import { AuthResponse, ApiResponse, User } from '../types';

export const authApi = {
  demoCitizenLogin: async (userId?: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/demo-citizen-login', userId ? { userId } : {});
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },
};
