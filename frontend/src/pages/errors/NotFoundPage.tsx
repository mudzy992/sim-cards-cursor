import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { ROUTES } from '@/config/routes';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Result
        status="404"
        title="404"
        subTitle={t('errors.notFound.subtitle')}
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.dashboard)}>
            {t('errors.notFound.backHome')}
          </Button>
        }
      />
    </main>
  );
}
