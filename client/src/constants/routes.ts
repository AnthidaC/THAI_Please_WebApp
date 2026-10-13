export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
} as const;

export type AppRoute = typeof APP_ROUTES[keyof typeof APP_ROUTES];
