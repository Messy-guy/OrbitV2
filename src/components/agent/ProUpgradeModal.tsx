import React from 'react';
import { Sparkles, ArrowRight, Zap, Check, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/ui.store';
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
      title="Concurrent Agent Limit Reached"
      subtitle={`Free Plan includes ${maxSlots} active agents. Upgrade to Orbit Pro for unlimited swarms.`}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-1">
        
        {/* Status Indicator Box */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Lock size={14} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-text-primary text-xs">Active Slots: {currentCount} / {maxSlots}</span>
              <span className="text-[11px] text-text-muted">You have reached the free tier concurrent process limit</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
            MAX ACTIVE
          </span>
        </div>

        {/* Pro Plan Feature Card */}
        <div className="p-5 rounded-2xl bg-panel-elevated border border-border flex flex-col gap-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Sparkles size={13} />
              </div>
              <span className="font-mono font-bold text-xs tracking-wider text-text-primary uppercase">
                ORBIT PRO
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              $19 / month
            </span>
          </div>

          <div className="space-y-2 text-[11.5px] text-text-muted font-sans pt-1">
            <div className="flex items-center gap-2">
              <Check size={13} className="text-emerald-500 shrink-0" />
              <span className="text-text-primary font-medium">Unlimited Concurrent Agent Swarms (Run 10+ agents)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={13} className="text-emerald-500 shrink-0" />
              <span>Universal High-Density Context Handoff (128k Tokens)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={13} className="text-emerald-500 shrink-0" />
              <span>Cross-Device Cloud Session Sync (Desktop + Mobile)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={13} className="text-emerald-500 shrink-0" />
              <span>72-Hour Airplane Mode with Native Keyring Licenses</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-mono text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Manage Existing Agents
          </button>

          <button
            onClick={() => {
              onClose();
              setAuthModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <span>View Subscription</span>
            <ArrowRight size={12} />
          </button>
        </div>

      </div>
    </Modal>
  );
};
