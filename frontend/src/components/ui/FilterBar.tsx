import type { ReactNode } from 'react';
import { ClearOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useTranslation } from '@/i18n';

export interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function FilterBar({
  children,
  onReset,
  hasActiveFilters = false,
  actions,
  className = '',
}: FilterBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle bg-surface p-3 ${className}`.trim()}
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">{children}</div>
      {(onReset && hasActiveFilters) || actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onReset && hasActiveFilters ? (
            <Button icon={<ClearOutlined />} onClick={onReset}>
              {t('common.actions.clearFilters')}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
