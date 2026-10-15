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
      title="Orbit Pro Feature"
      subtitle="Mobile Pairing, Remote Approvals, and Push Notifications are part of Orbit Pro."
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-1 select-none">
        
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

          <div className="space-y-2.5 text-[11px] text-text-secondary font-sans">
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span className="text-text-primary font-medium">Mobile Cockpit Pairing & Remote Telemetry</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span className="text-text-primary font-medium">Instant Push Notifications for Approvals & Questions</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span className="text-text-primary font-medium">Emergency Stop & Mobile Remote Actions</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span>Multi-Account Cloud Workspace Sync</span>
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
