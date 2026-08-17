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
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={twMerge(
            clsx(
              'w-full surface-well rounded-btn px-3 py-1.5 text-xs text-text-primary placeholder:text-text-dim transition-colors font-mono',
              'focus:outline-none focus:border-border-highlight focus:bg-well',
              icon && 'pl-8',
              error && 'border-status-error focus:border-status-error',
              className
            )
          )}
          {...props}
        />
        {error && <span className="text-[10.5px] text-status-error mt-1 block font-mono font-medium">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
