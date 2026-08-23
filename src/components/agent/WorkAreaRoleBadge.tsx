import React from 'react';
import { AgentRoleType } from '../../types/orbit';
import { Compass, Zap, ShieldCheck, Terminal } from 'lucide-react';

interface WorkAreaRoleBadgeProps {
  role?: AgentRoleType;
  className?: string;
}

export const WorkAreaRoleBadge: React.FC<WorkAreaRoleBadgeProps> = ({
  role = 'raw',
  className = '',
}) => {
  const getBadgeConfig = () => {
    switch (role) {
      case 'architect':
        return {
          label: 'Plan / Architecture',
          icon: <Compass size={11} className="text-sky-400" />,
          bgColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
        };
      case 'implementer':
        return {
          label: 'TDD Builder',
          icon: <Zap size={11} className="text-amber-400" />,
          bgColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        };
      case 'reviewer':
        return {
          label: 'Code Auditor',
          icon: <ShieldCheck size={11} className="text-emerald-400" />,
          bgColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          label: 'Shell Terminal',
          icon: <Terminal size={11} className="text-zinc-400" />,
          bgColor: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-mono text-[10px] font-semibold select-none shadow-xs backdrop-blur-xs ${config.bgColor} ${className}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
