import type { ReactNode } from 'react';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  backTo,
  backLabel,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {backTo ? (
          <div className="mb-2">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(backTo)}
              className="-ml-2 text-fg-secondary hover:text-fg-primary"
            >
              {backLabel ?? t('common.actions.back')}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-fg-primary">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="m-0 text-sm text-fg-secondary">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
