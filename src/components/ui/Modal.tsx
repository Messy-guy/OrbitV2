import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const maxW = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Subtle Translucent Frosted Glass Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className={twMerge(
              clsx(
                'relative w-full surface-elevated rounded-panel shadow-elevated overflow-hidden z-10 flex flex-col',
                maxW[maxWidth],
                className
              )
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-panel-elevated">
              <div>
                <h3 className="text-[13px] font-bold text-text-primary tracking-wider font-mono uppercase">{title}</h3>
                {subtitle && <p className="text-[11px] text-text-muted mt-0.5 font-sans">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-white p-1 rounded-btn hover:bg-panel-hover transition-colors border border-transparent hover:border-border"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[75vh]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
