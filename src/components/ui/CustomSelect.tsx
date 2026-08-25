import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, ShieldCheck, User } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  isAction?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  placement?: 'bottom' | 'top';
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  placement = 'bottom',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={dropdownRef} className={clsx('relative w-full select-none font-mono', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full px-3.5 py-2 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all duration-140',
          'glass-dropdown text-xs text-text-primary border border-white/10 hover:border-white/20',
          isOpen && 'border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.15)] ring-1 ring-white/10'
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0 pr-2">
          {selectedOption?.icon || <User size={13} className="text-text-muted shrink-0" />}
          <div className="flex flex-col truncate">
            <span className="truncate text-xs font-semibold text-text-primary">
              {selectedOption?.label || placeholder}
            </span>
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="text-text-muted shrink-0 ml-1.5"
        >
          <ChevronDown size={13} />
        </motion.div>
      </button>

      {/* Popover Dropdown Menu (Opens to bottom by default) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: placement === 'bottom' ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'bottom' ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              "absolute left-0 right-0 z-50 p-1.5 rounded-xl glass-elevated border border-white/15 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.85)] max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-1",
              placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
            )}
          >
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg text-left flex items-center justify-between text-xs transition-all duration-120 cursor-pointer group',
                    option.isAction
                      ? 'text-amber-400 hover:bg-amber-500/10 font-bold border-t border-white/5 mt-0.5 pt-2.5'
                      : isSelected
                      ? 'bg-white/10 text-white font-semibold shadow-xs'
                      : 'text-text-secondary hover:bg-white/5 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                    {option.icon ? (
                      option.icon
                    ) : option.isAction ? (
                      <Plus size={13} className="text-amber-400 shrink-0" />
                    ) : (
                      <ShieldCheck size={13} className={clsx('shrink-0', isSelected ? 'text-emerald-400' : 'text-text-dim group-hover:text-text-muted')} />
                    )}
                    <div className="flex flex-col truncate">
                      <span className="truncate leading-tight">{option.label}</span>
                      {option.sublabel && (
                        <span className="text-[10px] text-text-dim truncate mt-0.5 font-normal">
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && !option.isAction && (
                    <Check size={13} className="text-emerald-400 shrink-0 ml-1.5" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
