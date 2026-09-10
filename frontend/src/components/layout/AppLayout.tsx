import { Alert, Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { Breadcrumb } from './Breadcrumb';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth.store';
import { useState } from 'react';
import { useAppFeatures } from '@/hooks/useAppFeatures';
import { useTranslation } from '@/i18n';

const { Content } = Layout;

export function AppLayout() {
  useNotificationSocket();

  const user = useAuthStore((s) => s.user);
  const featuresQuery = useAppFeatures();
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { t } = useTranslation();

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <Layout className="bg-slate-50">
        <Header onMobileMenuClick={() => setMobileNavOpen(true)} />
        <Content className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <Breadcrumb />
            {user?.role === 'SYSTEM_ADMIN' && featuresQuery.data?.missingKeys?.length ? (
              <Alert
                type="warning"
                className="mb-4"
                message={t('layout.appLayout.notFullyConfigured')}
                description={
                  <div>
                    <div>{t('layout.appLayout.missingKeysIntro')}</div>
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
            <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-card sm:p-6">
              <Outlet />
            </div>
          </div>
        </Content>
        <Footer />
      </Layout>
    </Layout>
  );
}
