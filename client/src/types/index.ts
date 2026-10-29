export interface User {
  id: string;
  email?: string;
  name?: string | null;
  role: 'USER' | 'ADMIN' | 'MERCHANT' | 'MERCHANT_APPLICATION_STATUS' | 'STAFF' | 'GOVERNMENT_EXECUTIVE';
  createdAt: string;
  merchantApprovalStatus?: 'SUBMITTING' | 'PENDING' | 'APPROVED' | 'REJECTED';
  merchantApplicationSubmittedAt?: string | null;
  merchantRejectionReason?: string | null;
}

export type DemoLoginRole = 'CITIZEN' | 'MERCHANT' | 'ADMIN';

export interface AuthResponse {
  status: 'success' | 'error';
  data: {
    user: User;
    token: string;
  };
  message?: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  source?: 'cache' | 'database';
  message?: string;
}
