import { Alert, Layout } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { Breadcrumb } from './Breadcrumb';
import { Footer } from './Footer';
import { Header } from './Header';
import { PageErrorBoundary } from './PageErrorBoundary';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';
import { useState } from 'react';
import { useAppFeatures } from '@/hooks/useAppFeatures';
import { useTranslation } from '@/i18n';
import { ROUTES } from '@/config/routes';

const { Content } = Layout;

export function AppLayout() {
  useNotificationSocket();

  const user = useAuthStore((s) => s.user);
  const preference = useThemeStore((s) => s.preference);
  const featuresQuery = useAppFeatures();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Layout className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground focus:shadow-card"
      >
        {t('layout.a11y.skipToMain')}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {t('layout.a11y.themeChanged', { mode: t(`layout.theme.${preference}`) })}
      </div>
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <Layout className="bg-canvas">
        <Header onMobileMenuClick={() => setMobileNavOpen(true)} />
        <Content
          id="main-content"
          tabIndex={-1}
          className="px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-6"
        >
          <div className="mx-auto w-full max-w-[1440px]">
            <Breadcrumb />
            {user?.role === 'SYSTEM_ADMIN' && featuresQuery.data?.missingKeys?.length ? (
              <Alert
                type="warning"
                className="mb-5"
                message={t('layout.appLayout.notFullyConfigured')}
                description={
                  <div>
                    <div>{t('layout.appLayout.missingKeysIntro')}</div>
                    <ul className="ml-5 list-disc">
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
            <PageErrorBoundary
              resetKey={location.pathname}
              onGoHome={() => navigate(ROUTES.root)}
            >
              <Outlet />
            </PageErrorBoundary>
          </div>
        </Content>
        <Footer />
      </Layout>
    </Layout>
  );
}
