import React from 'react';
import { Plus, Bot } from 'lucide-react';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/ui.store';

interface EmptyWorkspaceProps {
  workspaceName: string;
}

export const EmptyWorkspace: React.FC<EmptyWorkspaceProps> = ({ workspaceName }) => {
  const { setAddAgentOpen } = useUIStore();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none font-mono">
      <div className="w-14 h-14 rounded-panel surface-panel flex items-center justify-center text-text-primary mb-4 shadow-panel border border-border">
        <Bot size={24} />
      </div>

      <h2 className="text-base font-bold text-text-primary tracking-wider uppercase">
        {workspaceName}
      </h2>
      <p className="text-xs text-text-muted mt-1 max-w-sm font-sans">
        Workspace initialized. Add coding agents to start multi-agent execution on this project.
      </p>

      <div className="mt-5 flex flex-col items-center gap-2.5">
        <Button
          variant="primary"
          size="md"
          onClick={() => setAddAgentOpen(true)}
          className="gap-2 tracking-wider font-bold"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>+ Add Agent</span>
        </Button>
        <span className="text-[11px] text-text-dim font-mono">
          Supports Antigravity, Codex, Claude Code, OpenCode & Custom Agents
        </span>
      </div>
    </div>
  );
};
