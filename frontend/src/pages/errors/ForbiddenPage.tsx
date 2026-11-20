import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { ROUTES } from '@/config/routes';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Result
        status="403"
        title="403"
        subTitle={t('errors.forbidden.subtitle')}
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.dashboard)}>
            {t('errors.forbidden.backToDashboard')}
          </Button>
        }
      />
    </main>
  );
}
