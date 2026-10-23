import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { APP_ROUTES } from '../constants/routes';

/**
 * Route guard for public-only pages (e.g. Login, Register).
 * Redirects to DASHBOARD if already authenticated.
 */
export const PublicRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    const destination = user?.role === 'MERCHANT'
      ? APP_ROUTES.MERCHANT_POS_QR
      : user?.role === 'ADMIN' || user?.role === 'STAFF'
        ? APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS
        : APP_ROUTES.DASHBOARD;
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};
