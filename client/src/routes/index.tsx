import React from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { APP_ROUTES } from '../constants/routes';
import { RootLayout } from '../layouts/RootLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

import { HomePage } from '../pages/home/HomePage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { MerchantRegisterPage } from '../pages/auth/MerchantRegisterPage';
import { DashboardPage } from '../pages/admin/dashboard/DashboardPage';
import { NotFoundPage } from '../pages/notFound/NotFoundPage';
import { MerchantHomePage } from '../pages/merchant/home/MerchantHomePage';
import { MerchantApplicationStatusPage } from '../pages/merchant/home/MerchantApplicationStatusPage';
import { CitizenHomePage } from '../pages/citizen/CitizenHomePage';
import { MerchantProfilePage } from '../pages/merchant/profile/MerchantProfilePage';

// Citizen Flow Pages
import { CitizenWalletPage } from '../pages/citizen/wallet/CitizenWalletPage';
import { CitizenScanCopayPage } from '../pages/citizen/scan-copay/CitizenScanCopayPage';
import { CitizenPaymentSlipPage } from '../pages/citizen/scan-copay/CitizenPaymentSlipPage';
import { CitizenTransactionsPage } from '../pages/citizen/transactions/CitizenTransactionsPage';
import { CitizenAchievementsPage } from '../pages/citizen/achievements/CitizenAchievementsPage';
import { CitizenMissionsPage } from '../pages/citizen/missions/CitizenMissionsPage';
import { CitizenReviewPage } from '../pages/citizen/reviews/CitizenReviewPage';
import { CitizenNearMePage } from '../pages/citizen/recommendations/CitizenNearMePage';
import { CitizenMerchantDetailPage } from '../pages/citizen/merchants/CitizenMerchantDetailPage';
import { CitizenPreferencesPage } from '../pages/citizen/preferences/CitizenPreferencesPage';
import { CitizenReferralPage } from '../pages/citizen/referrals/CitizenReferralPage';
import { CitizenProfilePage } from '../pages/citizen/profile/CitizenProfilePage';
import { CitizenRewardsPage } from '../pages/citizen/rewards/CitizenRewardsPage';

// Merchant Flow Pages
import { MerchantPosQrPage } from '../pages/merchant/pos-qr/MerchantPosQrPage';
import { MerchantSalesHistoryPage } from '../pages/merchant/sales/MerchantSalesHistoryPage';
import { MerchantReviewsPage } from '../pages/merchant/reviews/MerchantReviewsPage';

// Admin Flow Pages
import { AdminFraudAlertsPage } from '../pages/admin/fraud-alerts/AdminFraudAlertsPage';
import { AdminMerchantApplicationsPage } from '../pages/admin/merchant-applications/AdminMerchantApplicationsPage';
import { AdminMerchantLocationRequestsPage } from '../pages/admin/merchant-location-requests/AdminMerchantLocationRequestsPage';
import { AdminMerchantsPage } from '../pages/admin/merchants/AdminMerchantsPage';
import { AdminSocialImpactPage } from '../pages/admin/social-impact/AdminSocialImpactPage';
const AdminCampaignsPage = React.lazy(() => import('../pages/admin/campaigns/AdminCampaignsPage').then((module) => ({ default: module.AdminCampaignsPage })));

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
      // Citizen Flow
      {
        element: <ProtectedRoute allowedRoles={['USER']} />,
        children: [
          { path: APP_ROUTES.CITIZEN_HOME, element: <CitizenHomePage /> },
          { path: APP_ROUTES.CITIZEN_WALLET, element: <CitizenWalletPage /> },
          { path: APP_ROUTES.CITIZEN_REWARDS, element: <CitizenRewardsPage /> },
          { path: APP_ROUTES.CITIZEN_SCAN_COPAY, element: <CitizenScanCopayPage /> },
          { path: APP_ROUTES.CITIZEN_SLIP, element: <CitizenPaymentSlipPage /> },
          { path: APP_ROUTES.CITIZEN_TRANSACTIONS, element: <CitizenTransactionsPage /> },
          { path: APP_ROUTES.CITIZEN_MISSIONS, element: <CitizenMissionsPage /> },
          { path: APP_ROUTES.CITIZEN_ACHIEVEMENTS, element: <CitizenAchievementsPage /> },
          { path: APP_ROUTES.CITIZEN_REFERRALS, element: <CitizenReferralPage /> },
          { path: APP_ROUTES.CITIZEN_REVIEW, element: <CitizenReviewPage /> },
          { path: APP_ROUTES.CITIZEN_NEAR_ME, element: <CitizenNearMePage /> },
          { path: APP_ROUTES.CITIZEN_MERCHANT_DETAIL, element: <CitizenMerchantDetailPage /> },
          { path: APP_ROUTES.CITIZEN_PREFERENCES, element: <CitizenPreferencesPage /> },
          { path: APP_ROUTES.PROFILE, element: <CitizenProfilePage /> },
        ],
      },

      // Merchant Flow
      {
        element: <ProtectedRoute allowedRoles={['MERCHANT_APPLICATION_STATUS']} />,
        children: [
          { path: APP_ROUTES.MERCHANT_APPLICATION_STATUS, element: <MerchantApplicationStatusPage /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['MERCHANT']} />,
        children: [
          { path: APP_ROUTES.MERCHANT_HOME, element: <MerchantHomePage /> },
          { path: APP_ROUTES.MERCHANT_PROFILE, element: <MerchantProfilePage /> },
          { path: APP_ROUTES.MERCHANT_POS_QR, element: <MerchantPosQrPage /> },
          { path: APP_ROUTES.MERCHANT_SALES, element: <MerchantSalesHistoryPage /> },
          { path: APP_ROUTES.MERCHANT_REVIEWS, element: <MerchantReviewsPage /> },
        ],
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
          { path: APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS, element: <AdminMerchantApplicationsPage /> },
          { path: APP_ROUTES.ADMIN_MERCHANT_LOCATION_REQUESTS, element: <AdminMerchantLocationRequestsPage /> },
          { path: APP_ROUTES.ADMIN_MERCHANTS, element: <AdminMerchantsPage /> },
          { path: `${APP_ROUTES.ADMIN_MERCHANTS}/:merchantId/edit`, element: <MerchantProfilePage /> },
          { path: APP_ROUTES.ADMIN_SOCIAL_IMPACT, element: <AdminSocialImpactPage /> },
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
      { path: '*', element: <NotFoundPage /> },
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
            element: <Navigate to={APP_ROUTES.LOGIN} replace />,
          },
          {
            path: APP_ROUTES.MERCHANT_REGISTER,
            element: <MerchantRegisterPage />,
          },
          {
            path: APP_ROUTES.STAFF_LOGIN,
            element: <Navigate to={APP_ROUTES.LOGIN} replace />,
          },
          {
            path: APP_ROUTES.REGISTER,
            element: <RegisterPage />,
          },
        ],
      },
    ],
  },

]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
