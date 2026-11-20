import type { ReactNode } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button } from 'antd';
import { useTranslation } from '@/i18n';

export interface ErrorNoticeProps {
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export function ErrorNotice({
  title,
  message,
  onRetry,
  className = '',
}: ErrorNoticeProps) {
  const { t } = useTranslation();

  return (
    <Alert
      type="error"
      showIcon
      role="alert"
      className={className}
      message={title ?? t('common.states.error')}
      description={message}
      action={
        onRetry ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
            {t('common.actions.retry')}
          </Button>
        ) : undefined
      }
    />
  );
}
