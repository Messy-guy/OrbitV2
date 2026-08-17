import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowDown } from 'lucide-react';
import { useContextStore } from '../../stores/context.store';
import { Button } from '../ui/Button';

export const HandoffAnimationOverlay: React.FC = () => {
  const { activeHandoffAnimation, dismissHandoffAnimation } = useContextStore();

  useEffect(() => {
    if (activeHandoffAnimation) {
      const timer = setTimeout(() => {
        dismissHandoffAnimation();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [activeHandoffAnimation, dismissHandoffAnimation]);

  if (!activeHandoffAnimation) return null;

  const { sourceAgentName, targetAgentName, tokenCount, decisionCount, issueCount, fileCount } = activeHandoffAnimation;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismissHandoffAnimation}
          className="absolute inset-0 bg-black/75 backdrop-blur-[3px]"
        />

        {/* Center Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
          className="relative z-10 w-full max-w-sm surface-elevated rounded-panel p-5 shadow-elevated flex flex-col items-center text-center font-mono border-border-hover"
        >
          {/* Node Stream Diagram */}
          <div className="flex flex-col items-center gap-1.5 mb-4 w-full">
            {/* Source Agent */}
            <div className="px-3.5 py-1.5 rounded-btn surface-well flex items-center justify-center gap-2 text-xs font-bold text-text-muted uppercase w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-text-dim" />
              <span>{sourceAgentName}</span>
            </div>

            {/* Connecting Stream */}
            <div className="flex flex-col items-center py-1.5">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 16 }}
                transition={{ duration: 0.2 }}
                className="w-0.5 bg-border-highlight relative"
              />
              <span className="text-[9px] uppercase tracking-widest text-text-muted font-bold my-0.5">
                HANDOFF
              </span>
              <ArrowDown size={12} className="text-text-primary" />
            </div>

            {/* Target Agent */}
            <div className="px-3.5 py-1.5 rounded-btn btn-primary text-canvas-chrome flex items-center justify-center gap-2 text-xs font-bold uppercase w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
              <span className="text-canvas-chrome">{targetAgentName}</span>
            </div>
          </div>

          {/* Success Title */}
          <div className="flex items-center gap-1.5 text-status-success font-bold text-xs mb-1">
            <Check size={14} strokeWidth={3} />
            <span className="uppercase tracking-wider">Context Injected</span>
          </div>

          <p className="text-[10px] text-text-muted mb-3 font-mono">
            {sourceAgentName} ──&gt; {targetAgentName}
          </p>

          {/* Transfer stats */}
          <div className="w-full grid grid-cols-2 gap-1.5 text-[10.5px] mb-4 text-text-muted">
            <div className="p-2 rounded-btn surface-well flex items-center justify-between">
              <span>Decisions:</span>
              <strong className="text-text-primary font-bold">{decisionCount}</strong>
            </div>
            <div className="p-2 rounded-btn surface-well flex items-center justify-between">
              <span>Issues:</span>
              <strong className="text-status-warning font-bold">{issueCount}</strong>
            </div>
            <div className="p-2 rounded-btn surface-well flex items-center justify-between">
              <span>Files:</span>
              <strong className="text-text-primary font-bold">{fileCount}</strong>
            </div>
            <div className="p-2 rounded-btn surface-well flex items-center justify-between">
              <span>Tokens:</span>
              <strong className="text-text-primary font-bold">~{(tokenCount / 1000).toFixed(1)}k</strong>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={dismissHandoffAnimation}
            className="w-full font-mono text-xs"
          >
            Dismiss
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
