import type { ReactNode } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { ArrowLeftIcon } from './icons';

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
    <div className="flex flex-col gap-3 border-b border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {backTo ? (
          <div className="mb-1.5">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftIcon />}
              onClick={() => navigate(backTo)}
              className="-ml-2 text-fg-secondary hover:text-fg-primary"
            >
              {backLabel ?? t('common.actions.back')}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-xl font-semibold tracking-tight text-fg-primary sm:text-2xl">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="m-0 max-w-3xl text-sm text-fg-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
