import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { APP_ROUTES } from '../constants/routes';
import { homeRouteForRole } from '../constants/routes';
import { User } from '../types';

interface ProtectedRouteProps {
  allowedRoles: User['role'][];
}

/**
 * Route guard that requires user to be authenticated.
 * Redirects to LOGIN if not authenticated, remembering the previous location.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to={APP_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
};
