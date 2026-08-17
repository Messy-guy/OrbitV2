import React from 'react';
import { Check, Loader2, AlertCircle, Terminal } from 'lucide-react';
import { ToolInvocation } from '../../types/orbit';
import { clsx } from 'clsx';

interface ToolActivityProps {
  toolInvocations?: ToolInvocation[];
  isWorking?: boolean;
}

export const ToolActivity: React.FC<ToolActivityProps> = ({ toolInvocations, isWorking }) => {
  if ((!toolInvocations || toolInvocations.length === 0) && !isWorking) {
    return null;
  }

  return (
    <div className="my-1.5 p-2 rounded bg-background border border-border-subtle text-[11px] font-mono flex flex-col gap-1 select-text">
      {toolInvocations?.map(tool => (
        <div key={tool.id} className="flex items-center gap-1.5 text-text-secondary leading-tight">
          {tool.status === 'completed' ? (
            <span className="text-status-success font-bold shrink-0">✓</span>
          ) : tool.status === 'in_progress' ? (
            <Loader2 size={11} className="text-accent animate-spin shrink-0" />
          ) : (
            <span className="text-status-error font-bold shrink-0">✗</span>
          )}

          <span className="text-text-muted text-[10px] uppercase font-semibold">
            {tool.toolName}
          </span>

          {tool.file && (
            <span className={clsx(
              'text-[11px] truncate',
              tool.status === 'completed' ? 'text-text-primary' : 'text-text-secondary'
            )}>
              {tool.file}
            </span>
          )}

          {tool.output && (
            <span className="text-[10px] text-text-muted truncate ml-auto font-normal">
              {tool.output}
            </span>
          )}
        </div>
      ))}

      {isWorking && (
        <div className="flex items-center gap-1.5 text-accent text-[11px]">
          <Loader2 size={11} className="animate-spin" />
          <span>Executing...</span>
        </div>
      )}
    </div>
  );
};
