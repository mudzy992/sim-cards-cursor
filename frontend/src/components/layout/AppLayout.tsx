import { Alert, Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { Breadcrumb } from './Breadcrumb';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth.store';
import { useEffect, useMemo, useState } from 'react';
import { Tour } from 'antd';
import type { TourProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTourStore } from '@/store/tour.store';
import { useAppFeatures } from '@/hooks/useAppFeatures';

const { Content } = Layout;

export function AppLayout() {
  useNotificationSocket();

  const user = useAuthStore((s) => s.user);
  const featuresQuery = useAppFeatures();
  const location = useLocation();
  const navigate = useNavigate();
  const { tour, currentVersion, settingsLoaded, loadForUser, markWebTourCompleted } =
    useTourStore();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    void loadForUser(user);
  }, [user, loadForUser]);

  const userRole = user?.role;

  const shouldShowAdminTour =
    userRole === 'SYSTEM_ADMIN' &&
    settingsLoaded &&
    (!tour?.web?.systemAdmin?.completedAt ||
      tour.web.lastVersionSeen !== currentVersion);

  const shouldShowModeratorTour =
    userRole === 'MODERATOR' &&
    settingsLoaded &&
    (!tour?.web?.moderator?.completedAt ||
      tour.web.lastVersionSeen !== currentVersion);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (open) return;
    if (!shouldShowAdminTour && !shouldShowModeratorTour) return;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sim-tracker-global-tour-active', '1');
    }

    if (location.pathname !== '/dashboard') {
      navigate('/dashboard', { replace: true });
    }
    setOpen(true);
  }, [
    settingsLoaded,
    open,
    shouldShowAdminTour,
    shouldShowModeratorTour,
    location.pathname,
    navigate,
  ]);

  const getRouteForStep = (role: 'SYSTEM_ADMIN' | 'MODERATOR', stepIndex: number): string | null => {
    if (role === 'SYSTEM_ADMIN') {
      // 0: dashboard, 1: users, 2: shipments, 3: recipients, 4: meters, 5: records, 6: notifications, 7: activity-log, 8: settings
      const routes = [
        '/dashboard',
        '/users',
        '/shipments',
        '/recipients',
        '/meters',
        '/installation-records',
        '/dashboard', // notifications – može ostati na dashboardu
        '/activity-log',
        '/settings',
      ] as const;
      return routes[stepIndex] ?? null;
    }

    if (role === 'MODERATOR') {
      // 0: dashboard, 1: users, 2: shipments, 3: records approval, 4: recipients, 5: notifications
      const routes = [
        '/dashboard',
        '/users',
        '/shipments',
        '/installation-records',
        '/recipients',
        '/dashboard',
      ] as const;
      return routes[stepIndex] ?? null;
    }

    return null;
  };

  const steps: TourProps['steps'] = useMemo(() => {
    if (userRole === 'SYSTEM_ADMIN') {
      const adminSteps: TourProps['steps'] = [
        {
          title: 'Dashboard',
          description:
            'Pregled ključnih statistika, nedavnih zapisnika i trendova po danima.',
          target: () => document.querySelector('[data-tour-id="admin-dashboard"]') as HTMLElement,
        },
        {
          title: 'Korisnici, distribucije i podružnice',
          description:
            'Stranica za upravljanje korisnicima i organizacionom hijerarhijom (distribucije i podružnice).',
          target: () => document.querySelector('[data-tour-id="admin-users"]') as HTMLElement,
        },
        {
          title: 'Isporuke i SIM kartice',
          description:
            'Pregled i upravljanje isporukama i SIM karticama, uključujući import iz Excela.',
          target: () => document.querySelector('[data-tour-id="admin-shipments-sim"]') as HTMLElement,
        },
        {
          title: 'Grupe primalaca i approval grupe',
          description:
            'Konfiguracija email i in-app primaoca, approval grupa i mapiranja na podružnice.',
          target: () => document.querySelector('[data-tour-id="admin-recipients"]') as HTMLElement,
        },
        {
          title: 'Brojila i zapisnici',
          description:
            'Katalog brojila i povezani zapisnici ugradnje, s detaljima i lokacijama.',
          target: () => document.querySelector('[data-tour-id="admin-meters"]') as HTMLElement,
        },
        {
          title: 'Zapisnici ugradnje',
          description:
            'Lista svih zapisnika sa statusima lifecycle-a i vezanim SIM/brojilom.',
          target: () => document.querySelector('[data-tour-id="admin-records"]') as HTMLElement,
        },
        {
          title: 'Notifikacije',
          description:
            'Bell ikona s real-time notifikacijama o odobrenjima, greškama i drugim događajima.',
          target: () => document.querySelector('[data-tour-id="admin-notifications"]') as HTMLElement,
        },
        {
          title: 'Dnevnik aktivnosti',
          description:
            'Audit log za sve ključne promjene u sistemu (ko, šta, kada).',
          target: () => document.querySelector('[data-tour-id="admin-activity-log"]') as HTMLElement,
        },
        {
          title: 'Postavke aplikacije',
          description:
            'Centralno mjesto za napredne sistemske postavke i feature flag-ove.',
          target: () => document.querySelector('[data-tour-id="admin-settings"]') as HTMLElement,
        },
      ];

      return adminSteps;
    }

    if (userRole === 'MODERATOR') {
      const moderatorSteps: TourProps['steps'] = [
        {
          title: 'Dashboard',
          description:
            'Pregled ključnih statistika za vašu distribuciju i podružnice.',
          target: () =>
            document.querySelector('[data-tour-id="admin-dashboard"]') as HTMLElement,
        },
        {
          title: 'Korisnici u distribuciji',
          description:
            'Pregled operatera u distribuciji i dodjela organizacionog scope-a.',
          target: () =>
            document.querySelector('[data-tour-id="admin-users"]') as HTMLElement,
        },
        {
          title: 'SIM kartice vaše distribucije',
          description:
            'Pregled dostupnih SIM kartica i povezanih isporuka u vašem scope-u.',
          target: () =>
            document.querySelector('[data-tour-id="admin-shipments-sim"]') as HTMLElement,
        },
        {
          title: 'Zapisnici i odobravanje',
          description:
            'Lista zapisnika uz mogućnost odobravanja, odbijanja i aktivacije.',
          target: () =>
            document.querySelector('[data-tour-id="admin-records"]') as HTMLElement,
        },
        {
          title: 'Approval grupe',
          description:
            'Upravljanje approval grupama unutar vaše distribucije.',
          target: () =>
            document.querySelector('[data-tour-id="admin-recipients"]') as HTMLElement,
        },
        {
          title: 'Notifikacije za odobrenja',
          description:
            'Pregled notifikacija vezanih za tok odobrenja zapisnika.',
          target: () =>
            document.querySelector('[data-tour-id="moderator-notifications"]') as HTMLElement,
        },
      ];

      return moderatorSteps;
    }

  return [];
  }, [userRole]);

  const handleClose = async () => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('sim-tracker-global-tour-active');
    }
    if (userRole === 'SYSTEM_ADMIN' || userRole === 'MODERATOR') {
      await markWebTourCompleted(userRole);
    }
  };

  return (
    <>
      <Layout className="min-h-screen bg-slate-50">
        <Sidebar />
        <Layout>
          <Header />
          <Content className="px-6 py-5">
            <Breadcrumb />
            {user?.role === 'SYSTEM_ADMIN' && featuresQuery.data?.missingKeys?.length ? (
              <Alert
                type="warning"
                className="mb-4"
                message="Sistem nije potpuno podešen"
                description={
                  <div>
                    <div>Nedostaju ili nisu podešene ključne postavke:</div>
                    <ul className="list-disc ml-5">
                      {featuresQuery.data.missingKeys.map((k) => (
                        <li key={k}>
                          <code>{k}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                }
                showIcon
              />
            ) : null}
            <div className="rounded-md bg-white p-4 shadow-sm">
              <Outlet />
            </div>
          </Content>
          <Footer />
        </Layout>
      </Layout>
      {steps.length > 0 && (
        <Tour
          open={open}
          onClose={handleClose}
          steps={steps}
          current={currentStep}
          onChange={(next) => {
            setCurrentStep(next);
            if (userRole === 'SYSTEM_ADMIN' || userRole === 'MODERATOR') {
              const route = getRouteForStep(userRole, next);
              if (route && location.pathname !== route) {
                navigate(route);
              }
            }
          }}
          mask
          arrow
        />
      )}
    </>
  );
}
