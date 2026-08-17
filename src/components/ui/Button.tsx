import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-btn transition-colors duration-120 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent select-none disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-text-primary text-background font-semibold hover:bg-white active:bg-neutral-200 shadow-subtle',
    secondary: 'bg-panel-elevated text-text-primary border border-border hover:bg-panel-hover hover:border-border-hover shadow-subtle',
    outline: 'bg-transparent text-text-secondary border border-border hover:text-text-primary hover:bg-panel-elevated hover:border-border-hover',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-panel-elevated',
    danger: 'bg-status-error/10 text-status-error border border-status-error/25 hover:bg-status-error/20',
    accent: 'bg-accent text-white hover:bg-accent-hover active:bg-blue-600 font-medium shadow-subtle',
  };

  const sizes = {
    xs: 'text-[11px] px-2 py-0.5 gap-1 h-6',
    sm: 'text-xs px-2.5 py-1 gap-1.5 h-7',
    md: 'text-[13px] px-3 py-1.5 gap-2 h-8',
    lg: 'text-sm px-4 py-2 gap-2 h-9',
    icon: 'h-7 w-7 p-0',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : null}
      {children}
    </button>
  );
};
