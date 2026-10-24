import React from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { APP_ROUTES } from '../constants/routes';
import { RootLayout } from '../layouts/RootLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { AdminRoute } from './AdminRoute';
import { PublicRoute } from './PublicRoute';

import { HomePage } from '../pages/home/HomePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/admin/dashboard/DashboardPage';
import { NotFoundPage } from '../pages/notFound/NotFoundPage';

// Developer 2: Payment & Fraud Engine Pages
import { CitizenWalletPage } from '../pages/citizen/wallet/CitizenWalletPage';
import { CitizenScanCopayPage } from '../pages/citizen/scan-copay/CitizenScanCopayPage';
import { CitizenPaymentSlipPage } from '../pages/citizen/scan-copay/CitizenPaymentSlipPage';
import { CitizenTransactionsPage } from '../pages/citizen/transactions/CitizenTransactionsPage';
import { MerchantPosQrPage } from '../pages/merchant/pos-qr/MerchantPosQrPage';
import { MerchantSalesHistoryPage } from '../pages/merchant/sales/MerchantSalesHistoryPage';
import { AdminFraudAlertsPage } from '../pages/admin/fraud-alerts/AdminFraudAlertsPage';
const AdminCampaignsPage = React.lazy(() => import('../pages/admin/campaigns/AdminCampaignsPage').then((module) => ({ default: module.AdminCampaignsPage })));

// Developer 3: AI Discovery & Growth Pages
import { CitizenNearMePage } from '../pages/citizen/recommendations/CitizenNearMePage';
import { CitizenMerchantDetailPage } from '../pages/citizen/merchants/CitizenMerchantDetailPage';

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
      // Developer 3: AI Near-Me Discovery & Merchant Detail
      {
        path: APP_ROUTES.CITIZEN_NEAR_ME,
        element: <CitizenNearMePage />,
      },
      {
        path: APP_ROUTES.CITIZEN_MERCHANT_DETAIL,
        element: <CitizenMerchantDetailPage />,
      },

      // Merchant Flow (Dev 2)
      {
        path: APP_ROUTES.MERCHANT_POS_QR,
        element: <MerchantPosQrPage />,
      },
      {
        path: APP_ROUTES.MERCHANT_SALES,
        element: <MerchantSalesHistoryPage />,
      },

      // Admin routes
      {
        path: APP_ROUTES.ADMIN_ROOT,
        element: <Navigate to={APP_ROUTES.ADMIN_DASHBOARD} replace />,
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: APP_ROUTES.ADMIN_DASHBOARD,
            element: <DashboardPage />,
          },
          {
            path: APP_ROUTES.ADMIN_FRAUD_ALERTS,
            element: <AdminFraudAlertsPage />,
          },
          {
            path: APP_ROUTES.ADMIN_CAMPAIGNS,
            element: (
              <React.Suspense fallback={<div className="mx-auto flex min-h-64 max-w-7xl items-center justify-center px-6 text-sm text-ink-muted">กำลังโหลดเครื่องมือจัดการ...</div>}>
                <AdminCampaignsPage />
              </React.Suspense>
            ),
          },
        ],
      },

      // Legacy dashboard URL
      {
        path: APP_ROUTES.DASHBOARD,
        element: <Navigate to={APP_ROUTES.ADMIN_DASHBOARD} replace />,
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
