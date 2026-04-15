import { Alert, Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { Breadcrumb } from './Breadcrumb';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth.store';
import { useEffect } from 'react';
import { useAppFeatures } from '@/hooks/useAppFeatures';

const { Content } = Layout;

export function AppLayout() {
  useNotificationSocket();

  const user = useAuthStore((s) => s.user);
  const featuresQuery = useAppFeatures();

  return (
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
  );
}
