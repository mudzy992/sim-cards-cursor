import { Navigate, createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { RoleGuard } from '@/components/common/RoleGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ForbiddenPage from '@/pages/errors/ForbiddenPage';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import ShipmentCreatePage from '@/pages/shipments/ShipmentCreatePage';
import ShipmentDetailsPage from '@/pages/shipments/ShipmentDetailsPage';
import ShipmentsListPage from '@/pages/shipments/ShipmentsListPage';
import SimCardDetailsPage from '@/pages/sim-cards/SimCardDetailsPage';
import UsersListPage from '@/pages/users/UsersListPage';
import MetersListPage from '@/pages/meters/MetersListPage';
import InstallationRecordsListPage from '@/pages/installation-records/InstallationRecordsListPage';
import InstallationRecordCreatePage from '@/pages/installation-records/InstallationRecordCreatePage';
import InstallationRecordDetailPage from '@/pages/installation-records/InstallationRecordDetailPage';
import ActivityLogPage from '@/pages/activity-log/ActivityLogPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import EmailSettingsPage from '@/pages/settings/EmailSettingsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import AppReleasesPage from '@/pages/app-releases/AppReleasesPage';
import PushCampaignsPage from '@/pages/push-campaigns/PushCampaignsPage';
import BranchModeratorsPage from '@/pages/branch-moderators/BranchModeratorsPage'
import BranchEmailRecipientsPage from '@/pages/branch-email-recipients/BranchEmailRecipientsPage'
import MeterTypeFieldsPage from '@/pages/meter-type-fields/MeterTypeFieldsPage'
import MeterTypeUpsertPage from '@/pages/meter-types/MeterTypeUpsertPage'

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
            element: <DashboardPage />,
          },
          {
            path: '/users',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <UsersListPage />
              </RoleGuard>
            ),
          },
          {
            path: '/shipments',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <ShipmentsListPage />
              </RoleGuard>
            ),
          },
          {
            path: '/shipments/new',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <ShipmentCreatePage />
              </RoleGuard>
            ),
          },
          {
            path: '/shipments/:id',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <ShipmentDetailsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/meters',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <MetersListPage />
              </RoleGuard>
            ),
          },
          {
            path: '/meter-types/new',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                <MeterTypeUpsertPage />
              </RoleGuard>
            ),
          },
          {
            path: '/meter-types/:id',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <MeterTypeUpsertPage />
              </RoleGuard>
            ),
          },
          {
            path: '/sim-cards',
            element: <Navigate to="/shipments" replace />,
          },
          {
            path: '/sim-cards/:id',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <SimCardDetailsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/installation-records',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                <InstallationRecordsListPage />
              </RoleGuard>
            ),
          },
          {
            path: '/installation-records/new',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                <InstallationRecordCreatePage />
              </RoleGuard>
            ),
          },
          {
            path: '/installation-records/:id',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                <InstallationRecordDetailPage />
              </RoleGuard>
            ),
          },
          {
            path: '/push-campaigns',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <PushCampaignsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/activity-log',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <ActivityLogPage />
              </RoleGuard>
            ),
          },
          {
            path: '/settings',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                <SettingsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/settings/email',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                <EmailSettingsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/app-releases',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                <AppReleasesPage />
              </RoleGuard>
            ),
          },
          {
            path: '/analytics',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN', 'USER']}>
                <AnalyticsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/branch-moderators',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <BranchModeratorsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/branch-email-recipients',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN', 'DIST_ADMIN']}>
                <BranchEmailRecipientsPage />
              </RoleGuard>
            ),
          },
          {
            path: '/meter-type-fields',
            element: (
              <RoleGuard allow={['SYSTEM_ADMIN']}>
                <MeterTypeFieldsPage />
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
