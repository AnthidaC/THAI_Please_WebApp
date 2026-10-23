import api from '../lib/axios';
import { AuthResponse, ApiResponse, User } from '../types';

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: { email: string; password: string; name?: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', userData);
    return response.data;
  },

  loginMerchant: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/merchant/login', credentials);
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
