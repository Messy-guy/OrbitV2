import React from 'react';
import { AgentRoleType } from '../../types/orbit';
import { Compass, Zap, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface WorkAreaRoleBadgeProps {
  role?: AgentRoleType;
  className?: string;
}

export const WorkAreaRoleBadge: React.FC<WorkAreaRoleBadgeProps> = ({
  role = 'raw',
  className = '',
}) => {
  if (!role || role === 'raw') return null;

  const getBadgeConfig = () => {
    switch (role) {
      case 'architect':
        return {
          label: 'Plan',
          icon: <Compass size={10} className="text-amber-400" />,
          badgeClass: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
        };
      case 'implementer':
        return {
          label: 'Code',
          icon: <Zap size={10} className="text-emerald-400" />,
          badgeClass: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
        };
      case 'reviewer':
        return {
          label: 'Audit',
          icon: <ShieldCheck size={10} className="text-sky-400" />,
          badgeClass: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[9px] font-bold uppercase tracking-wider select-none shrink-0",
        config.badgeClass,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
