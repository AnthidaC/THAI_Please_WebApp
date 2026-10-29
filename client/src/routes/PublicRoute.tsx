import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { homeRouteForRole } from '../constants/routes';

/**
 * Route guard for public-only pages (e.g. Login, Register).
 * Redirects to DASHBOARD if already authenticated.
 */
export const PublicRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={homeRouteForRole(user?.role)} replace />;
  }

  return <Outlet />;
};
