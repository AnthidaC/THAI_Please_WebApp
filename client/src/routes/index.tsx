import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { APP_ROUTES } from '../constants/routes';
import { RootLayout } from '../layouts/RootLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

import { HomePage } from '../pages/home/HomePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { NotFoundPage } from '../pages/notFound/NotFoundPage';

export const router = createBrowserRouter([
  // Main Application Routes
  {
    path: APP_ROUTES.HOME,
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      // Protected Routes (Required Authentication)
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: APP_ROUTES.DASHBOARD,
            element: <DashboardPage />,
          },
        ],
      },
    ],
  },

  // Auth Routes (Public Only)
  {
    element: <AuthLayout />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          {
            path: APP_ROUTES.LOGIN,
            element: <LoginPage />,
          },
          {
            path: APP_ROUTES.REGISTER,
            element: <RegisterPage />,
          },
        ],
      },
    ],
  },

  // Catch-all 404 Route
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
