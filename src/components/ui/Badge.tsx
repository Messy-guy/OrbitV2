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
  const baseStyles = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8.5px] font-mono tracking-wider uppercase font-bold select-none transition-colors';

  const variants = {
    default: 'bg-panel-elevated text-text-primary border border-border/80 shadow-xs',
    secondary: 'bg-well text-text-muted border border-border-subtle',
    success: 'bg-status-success/10 text-status-success border border-status-success/25',
    warning: 'bg-status-warning/10 text-status-warning border border-status-warning/25',
    error: 'bg-status-error/10 text-status-error border border-status-error/25',
    info: 'bg-panel-highlight text-text-secondary border border-border',
    accent: 'bg-text-primary text-canvas font-bold border border-text-primary shadow-xs',
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
    accent: 'bg-canvas',
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
