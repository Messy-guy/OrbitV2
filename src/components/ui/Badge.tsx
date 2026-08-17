import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'outline' | 'secondary';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  dot = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge text-[11px] font-mono tracking-tight font-medium';

  const variants = {
    default: 'bg-panel-elevated text-text-secondary border border-border',
    secondary: 'bg-background-tertiary text-text-muted border border-border-subtle',
    success: 'bg-status-success/10 text-status-success border border-status-success/20',
    warning: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
    error: 'bg-status-error/10 text-status-error border border-status-error/20',
    info: 'bg-status-info/10 text-status-info border border-status-info/20',
    accent: 'bg-accent/10 text-accent border border-accent/25',
    outline: 'border border-border text-text-muted bg-transparent',
  };

  const dotColors = {
    default: 'bg-text-muted',
    secondary: 'bg-text-dim',
    success: 'bg-status-success',
    warning: 'bg-status-warning',
    error: 'bg-status-error',
    info: 'bg-status-info',
    accent: 'bg-accent',
    outline: 'bg-border',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], className))} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};
