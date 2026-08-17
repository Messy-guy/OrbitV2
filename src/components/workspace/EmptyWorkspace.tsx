import React from 'react';
import { Plus, Bot, Sparkles, Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/ui.store';

interface EmptyWorkspaceProps {
  workspaceName: string;
}

export const EmptyWorkspace: React.FC<EmptyWorkspaceProps> = ({ workspaceName }) => {
  const { setAddAgentOpen } = useUIStore();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-panel-elevated border border-border flex items-center justify-center text-accent mb-5 shadow-panel">
        <Bot size={28} />
      </div>

      <h2 className="text-xl font-bold text-text-primary tracking-tight uppercase">
        {workspaceName}
      </h2>
      <p className="text-sm text-text-secondary mt-1 max-w-sm">
        Your workspace is ready. Add coding agents to start collaborating on this project.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Button
          variant="accent"
          size="lg"
          onClick={() => setAddAgentOpen(true)}
          className="gap-2 shadow-accent-glow"
        >
          <Plus size={16} />
          <span>Add Agent</span>
        </Button>
        <span className="text-xs text-text-muted">
          Add Antigravity, Codex, Claude, OpenCode, or another coding agent.
        </span>
      </div>
    </div>
  );
};
