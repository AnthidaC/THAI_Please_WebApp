import api from '../lib/axios';
import { AuthResponse, ApiResponse, User } from '../types';
import { mockUsernamePasswordLogin } from './authMock';

export const authApi = {
  loginWithUsername: async (credentials: { username: string; password: string }): Promise<AuthResponse> => {
    if (import.meta.env.VITE_AUTH_MOCK === 'true') return mockUsernamePasswordLogin(credentials);
    // The backend endpoint may not be available until the auth migration is applied.
    // Bound the wait so the form never stays disabled indefinitely on a pending request.
    const response = await api.post<AuthResponse>('/v1/auth/login', credentials, { timeout: 10_000 });
    return response.data;
  },

  login: async (credentials: { citizenId: string }): Promise<AuthResponse> => {
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
