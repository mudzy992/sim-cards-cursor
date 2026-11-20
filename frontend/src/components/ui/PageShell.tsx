import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return <div className={`space-y-6 ${className}`.trim()}>{children}</div>;
}
