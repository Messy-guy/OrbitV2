import React, { useEffect } from 'react';
import { useUIStore } from '../../stores/ui.store';
import { useAgentStore } from '../../stores/agent.store';
import { Modal } from '../ui/Modal';

interface ShortcutItem {
  keys: string[];
  action: string;
}

export const ShortcutsModal: React.FC = () => {
  const { 
    isShortcutsOpen, 
    setShortcutsOpen, 
    setShareContextOpen, 
    setCreateCheckpointOpen, 
    setAddAgentOpen,
    setMaximizedAgentId,
    maximizedAgentId,
    setActiveBottomPanel,
    activeBottomPanel
  } = useUIStore();

  const { agents } = useAgentStore();

  // Universal Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? or Shift+/ or Ctrl+/ to toggle shortcuts cheatsheet
      if ((e.key === '?' && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          e.preventDefault();
          setShortcutsOpen(!isShortcutsOpen);
          return;
        }
      }

      if (isShortcutsOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShortcutsOpen(false);
        }
        return;
      }

      // Global Action Shortcuts
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        // Ctrl+H -> Context Handoff
        if (e.key.toLowerCase() === 'h' && !e.shiftKey) {
          e.preventDefault();
          setShareContextOpen(true);
          return;
        }

        // Ctrl+, -> Settings
        if (e.key === ',' && !e.shiftKey) {
          e.preventDefault();
          useUIStore.getState().setSettingsOpen(true);
          return;
        }

        // Ctrl+Shift+C -> Create Checkpoint
        if (e.key.toLowerCase() === 'c' && e.shiftKey) {
          e.preventDefault();
          setCreateCheckpointOpen(true);
          return;
        }

        // Ctrl+Shift+A -> Spawn Agent
        if (e.key.toLowerCase() === 'a' && e.shiftKey) {
          e.preventDefault();
          setAddAgentOpen(true);
          return;
        }

        // Ctrl+Shift+F -> Fullscreen Terminal toggle
        if (e.key.toLowerCase() === 'f' && e.shiftKey) {
          e.preventDefault();
          if (maximizedAgentId) {
            setMaximizedAgentId(null);
          } else if (agents.length > 0) {
            setMaximizedAgentId(agents[0].id);
          }
          return;
        }

        // Ctrl+G -> Git Panel
        if (e.key.toLowerCase() === 'g' && !e.shiftKey) {
          e.preventDefault();
          setActiveBottomPanel(activeBottomPanel === 'git' ? null : 'git');
          return;
        }

        // Ctrl+J -> Context Panel
        if (e.key.toLowerCase() === 'j' && !e.shiftKey) {
          e.preventDefault();
          setActiveBottomPanel(activeBottomPanel === 'context' ? null : 'context');
          return;
        }

        // Ctrl+1..9 -> Focus Agent N
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= agents.length) {
          e.preventDefault();
          const target = agents[num - 1];
          if (target) {
            setMaximizedAgentId(target.id);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShortcutsOpen, agents, maximizedAgentId, activeBottomPanel]);

  const shortcuts: ShortcutItem[] = [
    { keys: ['Ctrl', 'H'], action: 'Context Handoff (Relay memory)' },
    { keys: ['Ctrl', '1…9'], action: 'Focus Agent 1 through 9' },
    { keys: ['Ctrl', '⇧', 'F'], action: 'Toggle Fullscreen Terminal' },
    { keys: ['Ctrl', '⇧', 'A'], action: 'Spawn New Agent Instance' },
    { keys: ['Ctrl', '⇧', 'C'], action: 'Snapshot Checkpoint' },
    { keys: ['Ctrl', 'G'], action: 'Toggle Git & File Diffs Dock' },
    { keys: ['Ctrl', 'J'], action: 'Toggle Context Synthesizer' },
    { keys: ['?'], action: 'Toggle this Shortcuts Guide' },
    { keys: ['Esc'], action: 'Close Modal or Restore View' },
  ];

  if (!isShortcutsOpen) return null;

  return (
    <Modal
      isOpen={isShortcutsOpen}
      onClose={() => setShortcutsOpen(false)}
      title="Shortcuts Guide"
      subtitle="Quick keyboard navigation & commands"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-2 font-mono text-xs pt-1">
        <div className="flex flex-col divide-y divide-white/[0.06] rounded-xl bg-[#08090c] border border-white/[0.08] p-1.5">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 text-[11.5px] hover:bg-white/[0.03] rounded-lg transition-colors"
            >
              <span className="text-[#EDEDED] font-sans text-xs">{s.action}</span>
              <div className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-1.5 py-0.5 rounded bg-[#16171e] border border-white/[0.1] text-[#D0D3DE] font-mono text-[10px] font-semibold"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-[#525666]">
          <span>Press <kbd className="text-[#8E92A4]">?</kbd> to toggle anytime</span>
          <span>Press <kbd className="text-[#8E92A4]">Esc</kbd> to exit</span>
        </div>
      </div>
    </Modal>
  );
};
