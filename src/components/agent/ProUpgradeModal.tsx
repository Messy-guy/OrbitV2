import React from 'react';
import { ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCount: number;
  maxSlots: number;
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentCount,
  maxSlots,
}) => {
  const { setAuthModalOpen } = useAuthStore();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Active Slot Limit Reached"
      subtitle={`Free Plan includes ${maxSlots} concurrent agents. Upgrade to Orbit Pro for unlimited swarms.`}
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-1 select-none">
        
        {/* Sleek Minimalist Quota Bar */}
        <div className="p-3 rounded-xl bg-well border border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-mono text-text-primary text-xs font-semibold">Active Agent Slots</span>
          </div>
          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-panel border border-border text-text-secondary">
            {currentCount} / {maxSlots} Max
          </span>
        </div>

        {/* Pro Plan Feature Card */}
        <div className="p-4 rounded-xl bg-panel-elevated border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-text-primary uppercase tracking-wider">
              <Sparkles size={13} className="text-emerald-500" />
              <span>ORBIT PRO</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-500 font-bold">
              $19 / mo
            </span>
          </div>

          <div className="space-y-2 text-[11px] text-text-secondary font-sans">
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span className="text-text-primary font-medium">Unlimited Concurrent Agent Swarms</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span>Multi-Account Profile Isolation (Work vs. Personal)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span>High-Density Context Memory (128k Tokens)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span>Cross-Device Cloud Session Sync (Desktop + Mobile)</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onClose();
              setAuthModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <span>Upgrade to Pro</span>
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        </div>

      </div>
    </Modal>
  );
};
