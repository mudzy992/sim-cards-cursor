import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Result
      status="403"
      title="403"
      subTitle={t('errors.forbidden.subtitle')}
      extra={<Button onClick={() => navigate('/dashboard')}>{t('errors.forbidden.backToDashboard')}</Button>}
    />
  );
}
