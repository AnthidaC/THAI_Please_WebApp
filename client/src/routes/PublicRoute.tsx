import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { APP_ROUTES } from '../constants/routes';

/**
 * Route guard for public-only pages (e.g. Login, Register).
 * Redirects authenticated users to their default landing page.
 */
export const PublicRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'ADMIN' ? APP_ROUTES.ADMIN_DASHBOARD : APP_ROUTES.HOME} replace />;
  }

  return <Outlet />;
};
