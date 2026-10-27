export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: 'USER' | 'ADMIN' | 'STAFF' | 'MERCHANT' | 'GOVERNMENT_EXECUTIVE';
  merchantApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  merchantRejectionReason?: string | null;
  merchantApplicationSubmittedAt?: string | null;
  merchantApplicationSummary?: {
    businessName?: string;
    contactName?: string;
    phone?: string;
    address?: string;
  } | null;
  createdAt: string;
}

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
