import type { ReactNode } from 'react';
import { Empty } from 'antd';
import { useTranslation } from '@/i18n';

export interface EmptyNoticeProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyNotice({
  title,
  description,
  action,
  className = '',
}: EmptyNoticeProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-default bg-surface-sunken px-6 py-10 text-center ${className}`.trim()}
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div className="space-y-1">
            <div className="text-sm font-medium text-fg-primary">
              {title ?? t('common.states.noData')}
            </div>
            {description ? <div className="text-xs text-fg-secondary">{description}</div> : null}
          </div>
        }
      >
        {action}
      </Empty>
    </div>
  );
}
