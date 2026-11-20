import type { ReactNode } from 'react';
import type { StatusTone } from './status-tone';

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: ReactNode;
  icon?: ReactNode;
  mono?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border',
  accent: 'bg-accent-soft text-accent-fg border-default',
  info: 'bg-status-info-bg text-status-info-fg border-status-info-border',
  success: 'bg-status-success-bg text-status-success-fg border-status-success-border',
  warning: 'bg-status-warning-bg text-status-warning-fg border-status-warning-border',
  danger: 'bg-status-danger-bg text-status-danger-fg border-status-danger-border',
};

export function StatusBadge({
  tone = 'neutral',
  label,
  icon,
  mono = false,
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-5 ${
        mono ? 'font-mono' : ''
      } ${TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex items-center text-[11px]">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
