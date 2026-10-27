export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',

  // เส้นทางประชาชน (Citizen Flow)
  CITIZEN_WALLET: '/citizen/wallet',
  CITIZEN_SCAN_COPAY: '/citizen/scan-copay',
  CITIZEN_SLIP: '/citizen/slip/:id',
  CITIZEN_TRANSACTIONS: '/citizen/transactions',
  CITIZEN_ACHIEVEMENTS: '/citizen/achievements',
  CITIZEN_NEAR_ME: '/citizen/near-me',
  CITIZEN_MERCHANT_DETAIL: '/citizen/merchant-detail',

  // เส้นทางร้านค้า (Merchant Flow)
  MERCHANT_POS_QR: '/merchant/pos-qr',
  MERCHANT_SALES: '/merchant/sales',

  // เส้นทางผู้ดูแลระบบ (Admin Flow)
  ADMIN_ROOT: '/admin',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_FRAUD_ALERTS: '/admin/fraud-alerts',
  ADMIN_CAMPAIGNS: '/admin/campaigns',
} as const;

export type AppRoute = typeof APP_ROUTES[keyof typeof APP_ROUTES];
