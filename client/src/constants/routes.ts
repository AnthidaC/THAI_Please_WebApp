export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  MERCHANT_LOGIN: '/merchant/login',
  MERCHANT_REGISTER: '/merchant/register',
  STAFF_LOGIN: '/staff/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',

  // เส้นทางประชาชน (Citizen Flow - Dev 2)
  CITIZEN_WALLET: '/citizen/wallet',
  CITIZEN_SCAN_COPAY: '/citizen/scan-copay',
  CITIZEN_SLIP: '/citizen/slip/:id',
  CITIZEN_TRANSACTIONS: '/citizen/transactions',

  // เส้นทางร้านค้า (Merchant Flow - Dev 2)
  MERCHANT_POS_QR: '/merchant/pos-qr',
  MERCHANT_SALES: '/merchant/sales',
  MERCHANT_PROFILE: '/merchant/profile',

  // เส้นทางผู้ดูแลระบบ (Admin Flow - Dev 2)
  ADMIN_FRAUD_ALERTS: '/admin/fraud-alerts',
  ADMIN_MERCHANT_APPLICATIONS: '/admin/merchant-applications',
  ADMIN_MERCHANTS: '/admin/merchants',
  ADMIN_MERCHANT_LOCATION_REQUESTS: '/admin/merchant-location-requests',
} as const;

export type AppRoute = typeof APP_ROUTES[keyof typeof APP_ROUTES];
