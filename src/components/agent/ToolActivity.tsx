import React from 'react';
import { Loader2 } from 'lucide-react';
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
    <div className="my-2 p-2 rounded-btn surface-well-subtle border border-border-subtle text-[11px] font-mono flex flex-col gap-1.5 select-text">
      {toolInvocations?.map(tool => (
        <div key={tool.id} className="flex items-center gap-2 text-text-secondary leading-tight">
          {tool.status === 'completed' ? (
            <span className="text-status-success font-bold shrink-0">✓</span>
          ) : tool.status === 'in_progress' ? (
            <Loader2 size={11} className="text-text-primary animate-spin shrink-0" />
          ) : (
            <span className="text-status-error font-bold shrink-0">✗</span>
          )}

          <span className="text-text-dim text-[10px] uppercase font-bold tracking-wider">
            {tool.toolName}
          </span>

          {tool.file && (
            <span className={clsx(
              'text-[11px] truncate font-mono',
              tool.status === 'completed' ? 'text-text-primary font-medium' : 'text-text-secondary'
            )}>
              {tool.file}
            </span>
          )}

          {tool.output && (
            <span className="text-[10px] text-text-muted truncate ml-auto font-normal font-mono">
              {tool.output}
            </span>
          )}
        </div>
      ))}

      {isWorking && (
        <div className="flex items-center gap-2 text-text-primary text-[11px] font-mono font-bold">
          <Loader2 size={11} className="animate-spin text-text-primary" />
          <span className="uppercase tracking-wider">Executing command...</span>
        </div>
      )}
    </div>
  );
};
