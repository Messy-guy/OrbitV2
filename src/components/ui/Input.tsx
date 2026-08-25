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
              'w-full surface-well rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder:text-text-dim transition-all duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] font-mono',
              'focus:outline-none focus:border-border-active focus:bg-well focus:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]',
              icon && 'pl-9',
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
