import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { Spin } from 'antd';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { RoleGuard } from '@/components/common/RoleGuard';
import { MetersAccessGuard } from '@/components/common/MetersAccessGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import ForbiddenPage from '@/pages/errors/ForbiddenPage';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ShipmentDetailsPage = lazy(() => import('@/pages/shipments/ShipmentDetailsPage'));
const ShipmentsListPage = lazy(() => import('@/pages/shipments/ShipmentsListPage'));
const ShipmentPrintPage = lazy(() => import('@/pages/shipments/ShipmentPrintPage'));
const ShipmentWizardPage = lazy(() => import('@/pages/shipments/ShipmentWizardPage'));
const ShipmentEditPage = lazy(() => import('@/pages/shipments/ShipmentEditPage'));
const SimCardsIndexPage = lazy(() => import('@/pages/sim-cards/SimCardsIndexPage'));
const SimCardDetailsPage = lazy(() => import('@/pages/sim-cards/SimCardDetailsPage'));
const UsersListPage = lazy(() => import('@/pages/users/UsersListPage'));
const MetersListPage = lazy(() => import('@/pages/meters/MetersListPage'));
const MeterDetailPage = lazy(() => import('@/pages/meters/MeterDetailPage'));
const InstallationRecordsListPage = lazy(
  () => import('@/pages/installation-records/InstallationRecordsListPage'),
);
const InstallationRecordCreatePage = lazy(
  () => import('@/pages/installation-records/InstallationRecordCreatePage'),
);
const InstallationRecordDetailPage = lazy(
  () => import('@/pages/installation-records/InstallationRecordDetailPage'),
);
const ActivityLogPage = lazy(() => import('@/pages/activity-log/ActivityLogPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const EmailSettingsPage = lazy(() => import('@/pages/settings/EmailSettingsPage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
const AppReleasesPage = lazy(() => import('@/pages/app-releases/AppReleasesPage'));
const PushCampaignsPage = lazy(() => import('@/pages/push-campaigns/PushCampaignsPage'));
const BranchModeratorsPage = lazy(() => import('@/pages/branch-moderators/BranchModeratorsPage'));
const BranchEmailRecipientsPage = lazy(
  () => import('@/pages/branch-email-recipients/BranchEmailRecipientsPage'),
);
const MeterTypeFieldsPage = lazy(() => import('@/pages/meter-type-fields/MeterTypeFieldsPage'));
const MeterTypeUpsertPage = lazy(() => import('@/pages/meter-types/MeterTypeUpsertPage'));

function withSuspense(element: JSX.Element) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forbidden',
    element: <ForbiddenPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: '/dashboard',
            element: withSuspense(<DashboardPage />),
          },
          {
            path: '/users',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<UsersListPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/shipments',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<ShipmentsListPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/shipments/new',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<ShipmentWizardPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/shipments/:id/edit',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<ShipmentEditPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/shipments/:id',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<ShipmentDetailsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/shipments/:id/print',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<ShipmentPrintPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/meters',
            element: (
              <MetersAccessGuard>
                {withSuspense(<MetersListPage />)}
              </MetersAccessGuard>
            ),
          },
          {
            path: '/meters/:id',
            element: (
              <MetersAccessGuard>
                {withSuspense(<MeterDetailPage />)}
              </MetersAccessGuard>
            ),
          },
          {
            path: '/meter-types/new',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                {withSuspense(<MeterTypeUpsertPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/meter-types/:id',
            element: (
              <MetersAccessGuard>
                {withSuspense(<MeterTypeUpsertPage />)}
              </MetersAccessGuard>
            ),
          },
          {
            path: '/sim-cards',
            element: withSuspense(<SimCardsIndexPage />),
          },
          {
            path: '/sim-cards/:id',
            element: (
              <MetersAccessGuard>
                {withSuspense(<SimCardDetailsPage />)}
              </MetersAccessGuard>
            ),
          },
          {
            path: '/installation-records',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                {withSuspense(<InstallationRecordsListPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/installation-records/new',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                {withSuspense(<InstallationRecordCreatePage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/installation-records/:id',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                {withSuspense(<InstallationRecordDetailPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/push-campaigns',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<PushCampaignsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/activity-log',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<ActivityLogPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/settings',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                {withSuspense(<SettingsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/settings/email',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                {withSuspense(<EmailSettingsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/app-releases',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                {withSuspense(<AppReleasesPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/analytics',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                {withSuspense(<AnalyticsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/branch-moderators',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<BranchModeratorsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/branch-email-recipients',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                {withSuspense(<BranchEmailRecipientsPage />)}
              </RoleGuard>
            ),
          },
          {
            path: '/meter-type-fields',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                {withSuspense(<MeterTypeFieldsPage />)}
              </RoleGuard>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
