export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  MERCHANT_LOGIN: '/merchant/login',
  MERCHANT_REGISTER: '/merchant/register',
  STAFF_LOGIN: '/staff/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  MERCHANT_HOME: '/merchant/home',
  MERCHANT_APPLICATION_STATUS: '/merchant/application-status',
  MERCHANT_PROFILE: '/merchant/profile',
  CITIZEN_BENEFITS_REGISTER: '/citizen/register-benefits',
  PROFILE: '/profile',

  // เส้นทางประชาชน (Citizen Flow)
  CITIZEN_HOME: '/citizen/home',
  CITIZEN_WALLET: '/citizen/wallet',
  CITIZEN_REWARDS: '/citizen/rewards',
  CITIZEN_SCAN_COPAY: '/citizen/scan-copay',
  CITIZEN_SLIP: '/citizen/slip/:id',
  CITIZEN_TRANSACTIONS: '/citizen/transactions',
  CITIZEN_MISSIONS: '/citizen/missions',
  CITIZEN_NEAR_ME: '/citizen/near-me',
  CITIZEN_MERCHANT_DETAIL: '/citizen/merchant-detail',
  CITIZEN_REFERRALS: '/citizen/referrals',
  CITIZEN_REVIEW: '/citizen/review',
  CITIZEN_ACHIEVEMENTS: '/citizen/achievements',
  CITIZEN_PREFERENCES: '/citizen/preferences',

  // เส้นทางร้านค้า (Merchant Flow)
  MERCHANT_POS_QR: '/merchant/pos-qr',
  MERCHANT_SALES: '/merchant/sales',
  MERCHANT_REVIEWS: '/merchant/reviews',

  // เส้นทางผู้ดูแลระบบ (Admin Flow)
  ADMIN_ROOT: '/admin',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_MERCHANT_APPLICATIONS: '/admin/merchant-applications',
  ADMIN_MERCHANT_LOCATION_REQUESTS: '/admin/merchant-location-requests',
  ADMIN_MERCHANTS: '/admin/merchants',
  ADMIN_SOCIAL_IMPACT: '/admin/social-impact',
  ADMIN_FRAUD_ALERTS: '/admin/fraud-alerts',
  ADMIN_CAMPAIGNS: '/admin/campaigns',
} as const;

export const homeRouteForRole = (role: string | undefined): string => {
  if (role === 'ADMIN') return APP_ROUTES.ADMIN_DASHBOARD;
  if (role === 'MERCHANT') return APP_ROUTES.MERCHANT_POS_QR;
  if (role === 'USER') return APP_ROUTES.CITIZEN_HOME;
  return APP_ROUTES.HOME;
};

export type AppRoute = typeof APP_ROUTES[keyof typeof APP_ROUTES];
