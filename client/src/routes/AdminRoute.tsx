import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { APP_ROUTES } from '../constants/routes';
import { homeRouteForRole } from '../constants/routes';

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={APP_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to={homeRouteForRole(user?.role)} replace />;
  }

  return <Outlet />;
};
