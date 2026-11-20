import { Alert, Button, Card, Form, Input, Space } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { LoginInput } from '@/types/auth.types';
import { useQuery } from '@tanstack/react-query';
import { appReleasesApi } from '@/api/app-releases.api';
import { API_BASE_URL } from '@/api/axios.instance';
import { useTranslation } from '@/i18n';
import { ROUTES } from '@/config/routes';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useTranslation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latestReleaseQuery = useQuery({
    queryKey: ['app-releases', 'latest-android'],
    queryFn: () => appReleasesApi.latestAndroid(),
    staleTime: 5 * 60 * 1000,
  });

  const handleSubmit = async (values: LoginInput) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await login(values);
      const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname;
      const allowedForUser =
        fromPath === ROUTES.dashboard ||
        fromPath?.startsWith(ROUTES.installationRecords);
      const safePath =
        loggedInUser.role === 'USER'
          ? allowedForUser
            ? fromPath
            : ROUTES.dashboard
          : fromPath ?? ROUTES.dashboard;
      navigate(safePath ?? ROUTES.dashboard, { replace: true });
    } catch {
      setErrorMessage(t('auth.login.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-8">
      <div className="auth-grid-backdrop pointer-events-none absolute inset-0" />
      <div className="auth-ambient-glow pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-[90px]" />

      <div className="absolute right-4 top-4 z-10">
        <Space size="small">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </Space>
      </div>

      <Card className="relative w-full max-w-md rounded-2xl border border-subtle bg-surface shadow-card">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-default bg-accent text-base font-bold text-on-accent">
          S
        </div>
        <h1 className="mb-1 mt-3 text-2xl font-semibold tracking-tight text-fg-primary">
          {t('auth.login.title')}
        </h1>
        <p className="mb-6 text-sm text-fg-secondary">{t('auth.login.subtitle')}</p>

        {errorMessage ? (
          <Alert type="error" message={errorMessage} className="mb-4" showIcon role="alert" />
        ) : null}

        <Form<LoginInput> layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          <Form.Item
            label={t('auth.login.emailOrUsernameLabel')}
            name="emailOrUsername"
            rules={[{ required: true, message: t('auth.login.emailOrUsernameRequired') }]}
          >
            <Input
              size="large"
              placeholder={t('auth.login.emailOrUsernamePlaceholder')}
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            label={t('auth.login.passwordLabel')}
            name="password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Button htmlType="submit" type="primary" size="large" loading={isSubmitting} block>
            {t('auth.login.submitButton')}
          </Button>
        </Form>

        {latestReleaseQuery.isSuccess && latestReleaseQuery.data ? (
          <div className="mt-6 border-t border-subtle pt-4">
            <div className="mb-1 text-xs text-fg-muted">
              {t('auth.login.latestMobileVersion')}
            </div>
            <div className="text-sm font-semibold text-fg-primary">
              {latestReleaseQuery.data.versionName} (
              {t('auth.login.versionCode', { code: latestReleaseQuery.data.versionCode })})
            </div>
            <div className="mt-1">
              <a
                href={`${API_BASE_URL}${latestReleaseQuery.data.downloadUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent-fg hover:underline"
              >
                {t('auth.login.downloadApk')}
              </a>
            </div>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
