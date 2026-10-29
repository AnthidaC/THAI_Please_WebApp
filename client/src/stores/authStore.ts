import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

const isLegacyDemoToken = (token: string | null): boolean => Boolean(token?.startsWith('demo-token-'));

const getInitialUser = (): User | null => {
  try {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const getInitialToken = (): string | null => {
  const token = localStorage.getItem('auth_token');
  if (isLegacyDemoToken(token)) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    return null;
  }
  return token;
};

const initialToken = getInitialToken();

export const useAuthStore = create<AuthState>((set) => ({
  user: getInitialUser(),
  token: initialToken,
  isAuthenticated: !!initialToken,
  setAuth: (user, token) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
