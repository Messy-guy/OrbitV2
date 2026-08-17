import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="w-full relative">
        {icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={twMerge(
            clsx(
              'w-full bg-background-secondary border border-border rounded-btn px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted transition-colors duration-120',
              'focus:outline-none focus:border-border-active focus:ring-1 focus:ring-accent/40',
              icon && 'pl-8',
              error && 'border-status-error focus:border-status-error focus:ring-status-error/30',
              className
            )
          )}
          {...props}
        />
        {error && <span className="text-[11px] text-status-error mt-1 block font-mono">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
