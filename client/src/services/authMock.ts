import { AuthResponse } from '../types';

const mockPrincipals = {
  citizen: { id: 'mock-citizen', email: 'citizen@example.test', name: 'ผู้ใช้ทดสอบ', role: 'USER' as const },
  merchant: { id: 'mock-merchant', email: 'merchant@example.test', name: 'ร้านค้าทดสอบ', role: 'MERCHANT' as const, merchantApprovalStatus: 'APPROVED' as const },
  'pending-merchant': {
    id: 'mock-pending-merchant', email: 'pending@example.test', name: 'ร้านค้ารอตรวจสอบ', role: 'MERCHANT' as const,
    merchantApprovalStatus: 'PENDING' as const, merchantApplicationSubmittedAt: '2026-10-22T09:00:00.000Z',
    merchantApplicationSummary: { businessName: 'ร้านค้าทดสอบรอตรวจ', contactName: 'ผู้ติดต่อทดสอบ', phone: '02-000-0000', address: 'ข้อมูลที่อยู่ตัวอย่าง เขตปทุมวัน กรุงเทพมหานคร' },
  },
  admin: { id: 'mock-admin', email: 'admin@example.test', name: 'ผู้ดูแลระบบทดสอบ', role: 'ADMIN' as const },
  executive: { id: 'mock-executive', email: 'executive@example.test', name: 'ผู้บริหารทดสอบ', role: 'GOVERNMENT_EXECUTIVE' as const },
};

export const mockUsernamePasswordLogin = async ({ username, password }: { username: string; password: string }): Promise<AuthResponse> => {
  const principal = mockPrincipals[username as keyof typeof mockPrincipals];
  if (!principal || password !== 'demo123') throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  return {
    status: 'success',
    data: { user: { ...principal, createdAt: new Date().toISOString() }, token: `mock-credential-${username}-${Date.now()}` },
  };
};

export const mockQuickLogin = async (role: keyof typeof mockPrincipals): Promise<AuthResponse> => ({
  status: 'success',
  data: {
    user: { ...mockPrincipals[role], createdAt: new Date().toISOString() },
    token: `mock-quick-${role}-${Date.now()}`,
  },
});

/** UI-only identity-provider simulation; it does not authenticate against the server. */
export const mockThaiDLogin = async (): Promise<AuthResponse> => ({
  status: 'success',
  data: {
    user: {
      id: 'mock-citizen', email: 'citizen@example.test', name: 'ผู้ใช้ทดสอบ',
      role: 'USER', createdAt: new Date().toISOString(),
    },
    token: `mock-thaid-${crypto.randomUUID()}`,
  },
});
