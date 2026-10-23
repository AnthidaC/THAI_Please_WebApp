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
import { MerchantRegisterPage } from '../pages/auth/MerchantRegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { NotFoundPage } from '../pages/notFound/NotFoundPage';

// Developer 2: Payment & Fraud Engine Pages
import { CitizenWalletPage } from '../pages/citizen/wallet/CitizenWalletPage';
import { CitizenScanCopayPage } from '../pages/citizen/scan-copay/CitizenScanCopayPage';
import { CitizenPaymentSlipPage } from '../pages/citizen/scan-copay/CitizenPaymentSlipPage';
import { CitizenTransactionsPage } from '../pages/citizen/transactions/CitizenTransactionsPage';
import { MerchantPosQrPage } from '../pages/merchant/pos-qr/MerchantPosQrPage';
import { MerchantSalesHistoryPage } from '../pages/merchant/sales/MerchantSalesHistoryPage';
import { AdminFraudAlertsPage } from '../pages/admin/fraud-alerts/AdminFraudAlertsPage';
import { AdminMerchantApplicationsPage } from '../pages/admin/merchant-applications/AdminMerchantApplicationsPage';
import { AdminMerchantsPage } from '../pages/admin/merchants/AdminMerchantsPage';
import { AdminMerchantLocationRequestsPage } from '../pages/admin/merchant-location-requests/AdminMerchantLocationRequestsPage';
import { MerchantProfilePage } from '../pages/merchant/profile/MerchantProfilePage';
import { AdminSocialImpactPage } from '../pages/admin/social-impact/AdminSocialImpactPage';

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
      // Citizen Flow (Dev 2)
      {
        path: APP_ROUTES.CITIZEN_WALLET,
        element: <CitizenWalletPage />,
      },
      {
        path: APP_ROUTES.CITIZEN_SCAN_COPAY,
        element: <CitizenScanCopayPage />,
      },
      {
        path: APP_ROUTES.CITIZEN_SLIP,
        element: <CitizenPaymentSlipPage />,
      },
      {
        path: APP_ROUTES.CITIZEN_TRANSACTIONS,
        element: <CitizenTransactionsPage />,
      },

      // Merchant Flow (Dev 2)
      {
        element: <ProtectedRoute allowedRoles={['MERCHANT']} loginPath={APP_ROUTES.MERCHANT_LOGIN} />,
        children: [
          {
            path: APP_ROUTES.MERCHANT_POS_QR,
            element: <MerchantPosQrPage />,
          },
          {
            path: APP_ROUTES.MERCHANT_SALES,
            element: <MerchantSalesHistoryPage />,
          },
          {
            path: APP_ROUTES.MERCHANT_PROFILE,
            element: <MerchantProfilePage />,
          },
        ],
      },

      // Staff-only administration and fraud operations.
      {
        element: <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']} loginPath={APP_ROUTES.STAFF_LOGIN} />,
        children: [
          {
            path: APP_ROUTES.ADMIN_FRAUD_ALERTS,
            element: <AdminFraudAlertsPage />,
          },
          {
            path: APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS,
            element: <AdminMerchantApplicationsPage />,
          },
          {
            path: APP_ROUTES.ADMIN_MERCHANTS,
            element: <AdminMerchantsPage />,
          },
          {
            path: `${APP_ROUTES.ADMIN_MERCHANTS}/:merchantId/edit`,
            element: <MerchantProfilePage />,
          },
          {
            path: APP_ROUTES.ADMIN_MERCHANT_LOCATION_REQUESTS,
            element: <AdminMerchantLocationRequestsPage />,
          },
          {
            element: <ProtectedRoute allowedRoles={['ADMIN']} loginPath={APP_ROUTES.STAFF_LOGIN} />,
            children: [
              {
                path: APP_ROUTES.ADMIN_SOCIAL_IMPACT,
                element: <AdminSocialImpactPage />,
              },
            ],
          },
        ],
      },

      // General authenticated routes.
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
            path: APP_ROUTES.MERCHANT_LOGIN,
            element: <LoginPage audience="MERCHANT" />,
          },
          {
            path: APP_ROUTES.MERCHANT_REGISTER,
            element: <MerchantRegisterPage />,
          },
          {
            path: APP_ROUTES.STAFF_LOGIN,
            element: <LoginPage audience="ADMIN" />,
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
