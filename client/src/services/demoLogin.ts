import type { AuthResponse, DemoLoginRole } from '../types';

export type DemoLoginRequest = (role: DemoLoginRole, accountId?: string) => Promise<AuthResponse>;

export const requestDemoLogin: DemoLoginRequest = async (role, accountId) => {
  const { authApi } = await import('./authApi');
  return authApi.demoLogin(role, accountId);
};
