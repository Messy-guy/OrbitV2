import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Plus, ShieldCheck, User, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'sky' | 'amber' | 'purple' | 'zinc';
  icon?: React.ReactNode;
  isAction?: boolean;
  canDelete?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onDeleteOption?: (value: string) => void;
  placeholder?: string;
  placement?: 'bottom' | 'top' | 'auto';
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  onDeleteOption,
  placeholder = 'Select option...',
  placement = 'auto',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom'>('bottom');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Compute smart placement (top vs bottom) based on viewport clearance
  const updatePlacement = useCallback(() => {
    if (!dropdownRef.current) return;
    if (placement === 'top') {
      setResolvedPlacement('top');
      return;
    }
    if (placement === 'bottom') {
      setResolvedPlacement('bottom');
      return;
    }
    const rect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      setResolvedPlacement('top');
    } else {
      setResolvedPlacement('bottom');
    }
  }, [placement]);

  const toggleOpen = () => {
    if (!isOpen) {
      updatePlacement();
      const currentIdx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    }
    setIsOpen(!isOpen);
  };

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

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleOpen();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      }
    }
  };

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
      className={clsx('relative w-full select-none font-mono text-xs', className)}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={clsx(
          'w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all duration-150',
          'bg-well/70 hover:bg-well text-text-primary border border-border hover:border-border-hover shadow-xs',
          isOpen && 'border-accent/60 ring-2 ring-accent/20 bg-well'
        )}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
          {selectedOption?.icon || <User size={14} className="text-text-muted shrink-0" />}
          <div className="flex items-center gap-2 truncate">
            <span className="truncate font-semibold text-text-primary">
              {selectedOption?.label || placeholder}
            </span>
            {selectedOption?.badge && (
              <span className={clsx(
                'text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 leading-none',
                selectedOption.badgeColor === 'emerald' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                selectedOption.badgeColor === 'sky' && 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
                selectedOption.badgeColor === 'amber' && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
                (!selectedOption.badgeColor || selectedOption.badgeColor === 'zinc') && 'bg-white/10 text-text-muted border border-border'
              )}>
                {selectedOption.badge}
              </span>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          className="text-text-muted shrink-0 ml-1.5"
        >
          <ChevronDown size={13} />
        </motion.div>
      </button>

      {/* Popover Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: resolvedPlacement === 'bottom' ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: resolvedPlacement === 'bottom' ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'absolute left-0 right-0 z-50 p-1.5 rounded-xl bg-panel-elevated border border-border-hover shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-2xl max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1',
              resolvedPlacement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
            )}
          >
            {options.map((option, idx) => {
              const isSelected = option.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={option.value}
                  className={clsx(
                    'w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between text-xs transition-colors cursor-pointer group',
                    option.isAction
                      ? 'text-accent hover:bg-accent/10 font-bold border-t border-border mt-0.5 pt-2'
                      : isSelected
                      ? 'bg-accent/15 text-text-primary font-semibold border border-accent/30'
                      : isHighlighted
                      ? 'bg-well text-text-primary'
                      : 'text-text-secondary hover:bg-well/80 hover:text-text-primary'
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                    {option.icon ? (
                      option.icon
                    ) : option.isAction ? (
                      <Plus size={14} className="text-accent shrink-0" />
                    ) : (
                      <ShieldCheck
                        size={14}
                        className={clsx(
                          'shrink-0',
                          isSelected ? 'text-accent' : 'text-text-dim group-hover:text-text-muted'
                        )}
                      />
                    )}
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate leading-tight font-medium">{option.label}</span>
                        {option.badge && (
                          <span
                            className={clsx(
                              'text-[8.5px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0',
                              option.badgeColor === 'emerald' && 'bg-emerald-500/15 text-emerald-400',
                              option.badgeColor === 'sky' && 'bg-sky-500/15 text-sky-400',
                              option.badgeColor === 'amber' && 'bg-amber-500/15 text-amber-400',
                              (!option.badgeColor || option.badgeColor === 'zinc') && 'bg-well text-text-muted'
                            )}
                          >
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {option.sublabel && (
                        <span className="text-[10px] text-text-dim truncate mt-0.5 font-normal">
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && !option.isAction && (
                      <Check size={13} className="text-accent shrink-0 ml-1" />
                    )}
                    {option.canDelete && onDeleteOption && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOption(option.value);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/15 text-text-dim hover:text-rose-400 transition-all cursor-pointer"
                        title={`Delete profile ${option.label}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
