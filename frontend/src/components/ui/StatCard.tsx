import type { ReactNode } from 'react';
import { Card } from 'antd';
import type { StatusTone } from './status-tone';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatusTone;
  loading?: boolean;
  className?: string;
}

const TONE_ACCENT_CLASSES: Record<StatusTone, string> = {
  neutral: 'text-fg-primary',
  accent: 'text-accent-fg',
  info: 'text-status-info-fg',
  success: 'text-status-success-fg',
  warning: 'text-status-warning-fg',
  danger: 'text-status-danger-fg',
};

const TONE_ICON_BG_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface-sunken text-fg-secondary border-subtle',
  accent: 'bg-accent-soft text-accent-fg border-default',
  info: 'bg-status-info-bg text-status-info-fg border-status-info-border',
  success: 'bg-status-success-bg text-status-success-fg border-status-success-border',
  warning: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
  danger: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border',
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  loading = false,
  className = '',
}: StatCardProps) {
  return (
    <Card loading={loading} className={`border-subtle bg-surface ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</div>
          <div
            className={`text-2xl font-semibold tabular-nums tracking-tight ${TONE_ACCENT_CLASSES[tone]}`}
          >
            {value}
          </div>
          {hint ? <div className="text-xs text-fg-secondary">{hint}</div> : null}
        </div>
        {icon ? (
          <div
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg ${TONE_ICON_BG_CLASSES[tone]}`}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
