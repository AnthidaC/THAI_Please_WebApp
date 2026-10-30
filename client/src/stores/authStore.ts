import { create } from 'zustand';
import { User } from '../types';
import { queryClient } from '../lib/queryClient';

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
    // ล้างแคชข้อมูลเดิมทั้งหมดในหน่วยความจำทันทีเมื่อมีการเข้าสู่ระบบด้วยบัญชีใหม่
    queryClient.clear();
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    // ล้างแคชคำขอทั้งหมด (ยอดเงิน, ประวัติธุรกรรม, ข้อมูลส่วนตัว ฯลฯ) ทันทีที่ออกจากระบบ
    queryClient.clear();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('thai-please:pin-reset-intent');
    sessionStorage.removeItem('thai-please:pin-reset-return');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
