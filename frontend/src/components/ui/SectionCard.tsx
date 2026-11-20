import type { ReactNode } from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';

export interface SectionCardProps extends Omit<CardProps, 'title' | 'extra' | 'actions'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = '',
  ...rest
}: SectionCardProps) {
  const headerNode =
    title || description ? (
      <div className="min-w-0 py-0.5">
        {title ? (
          <h2 className="m-0 text-base font-semibold text-fg-primary">{title}</h2>
        ) : null}
        {description ? (
          <p className="m-0 mt-0.5 text-xs font-normal text-fg-muted">{description}</p>
        ) : null}
      </div>
    ) : undefined;

  return (
    <Card
      title={headerNode}
      extra={actions}
      className={`border-subtle bg-surface ${className}`.trim()}
      {...rest}
    >
      {children}
    </Card>
  );
}
