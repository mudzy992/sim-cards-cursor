import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Result
      status="404"
      title="404"
      subTitle={t('errors.notFound.subtitle')}
      extra={<Button onClick={() => navigate('/dashboard')}>{t('errors.notFound.backHome')}</Button>}
    />
  );
}
