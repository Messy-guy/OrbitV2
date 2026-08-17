import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'outline' | 'secondary' | 'well';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  dot = false,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge text-[10px] font-mono tracking-tight font-medium select-none';

  const variants = {
    default: 'bg-panel-elevated text-text-primary border border-border shadow-subtle',
    secondary: 'bg-well text-text-muted border border-border-subtle',
    success: 'bg-status-success/15 text-status-success border border-status-success/30',
    warning: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
    error: 'bg-status-error/15 text-status-error border border-status-error/30',
    info: 'bg-panel-highlight text-text-secondary border border-border',
    accent: 'bg-white text-canvas-chrome font-bold border border-white shadow-subtle',
    outline: 'border border-border text-text-muted bg-transparent',
    well: 'surface-well text-text-secondary',
  };

  const dotColors = {
    default: 'bg-text-muted',
    secondary: 'bg-text-dim',
    success: 'bg-status-success',
    warning: 'bg-status-warning',
    error: 'bg-status-error',
    info: 'bg-text-secondary',
    accent: 'bg-canvas-chrome',
    outline: 'bg-border-highlight',
    well: 'bg-text-dim',
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], className))} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};
