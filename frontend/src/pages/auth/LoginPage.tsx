import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { LoginInput } from '@/types/auth.types';
import { useQuery } from '@tanstack/react-query';
import { appReleasesApi } from '@/api/app-releases.api';
import { API_BASE_URL } from '@/api/axios.instance';
import { useTranslation } from '@/i18n';

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
        fromPath === '/dashboard' ||
        fromPath?.startsWith('/installation-records');
      const safePath =
        loggedInUser.role === 'USER'
          ? allowedForUser
            ? fromPath
            : '/dashboard'
          : fromPath ?? '/dashboard';
      navigate(safePath ?? '/dashboard', { replace: true });
    } catch {
      setErrorMessage(t('auth.login.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      {/* Ambient glow + grid — subtle Vercel/Next.js-style auth backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-[110px]"
        style={{ background: 'radial-gradient(closest-side, #6366f1, transparent)' }}
      />

      <Card className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-surface shadow-card">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-base font-bold text-white">
          S
        </div>
        <Typography.Title level={3} className="!mb-1 !mt-3">
          {t('auth.login.title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-6">
          {t('auth.login.subtitle')}
        </Typography.Paragraph>

        {errorMessage ? (
          <Alert type="error" message={errorMessage} className="mb-4" showIcon />
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
          <div className="mt-6 border-t border-slate-200 pt-4">
            <Typography.Text type="secondary" className="block mb-1">
              {t('auth.login.latestMobileVersion')}
            </Typography.Text>
            <Typography.Text strong>
              {latestReleaseQuery.data.versionName} (
              {t('auth.login.versionCode', { code: latestReleaseQuery.data.versionCode })})
            </Typography.Text>
            <div>
              <a
                href={`${API_BASE_URL}${latestReleaseQuery.data.downloadUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 hover:text-emerald-800"
              >
                {t('auth.login.downloadApk')}
              </a>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
