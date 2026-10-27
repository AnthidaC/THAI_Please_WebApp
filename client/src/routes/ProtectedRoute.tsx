import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { APP_ROUTES } from '../constants/routes';

/**
 * Route guard that requires user to be authenticated.
 * Redirects to LOGIN if not authenticated, remembering the previous location.
 */
interface ProtectedRouteProps {
  allowedRoles?: string[];
  loginPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  loginPath = APP_ROUTES.LOGIN,
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to={user ? APP_ROUTES.DASHBOARD : loginPath} replace />;
  }

  if (user?.role === 'MERCHANT' && user.merchantApprovalStatus === 'PENDING' && location.pathname !== APP_ROUTES.MERCHANT_PROFILE && location.pathname !== APP_ROUTES.MERCHANT_HOME) {
    return <Navigate to={APP_ROUTES.MERCHANT_PROFILE} replace />;
  }

  return <Outlet />;
};
