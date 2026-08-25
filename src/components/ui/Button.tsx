import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'well';
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
  const baseStyles = 'inline-flex items-center justify-center font-mono font-medium rounded-btn select-none disabled:opacity-30 disabled:pointer-events-none tracking-tight transition-all duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20';

  const variants = {
    primary: 'btn-primary font-bold shadow-subtle',
    secondary: 'btn-base text-text-primary hover:text-white',
    accent: 'btn-primary font-bold shadow-subtle',
    outline: 'bg-transparent text-text-secondary border border-border/80 hover:text-white hover:bg-panel-hover hover:border-border-hover shadow-2xs',
    ghost: 'text-text-muted hover:text-white hover:bg-panel-hover active:bg-panel',
    danger: 'bg-status-error/15 text-status-error border border-status-error/30 hover:bg-status-error/25 hover:border-status-error/50',
    well: 'surface-well text-text-muted hover:text-white hover:border-border-hover',
  };

  const sizes = {
    xs: 'text-[10.5px] px-2 py-0.5 gap-1 h-6 rounded-md',
    sm: 'text-[11px] px-2.5 py-1 gap-1.5 h-7 rounded-lg',
    md: 'text-[12px] px-3.5 py-1.5 gap-2 h-8 rounded-xl',
    lg: 'text-[13px] px-4 py-2 gap-2 h-9 rounded-xl font-semibold',
    icon: 'h-7 w-7 p-0 rounded-lg',
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
