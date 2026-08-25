import React, { useState, useRef, useEffect } from 'react';
import { AgentRoleType } from '../../types/orbit';
import { AGENT_ROLE_CONFIGS } from '../../constants/roles';
import { Terminal, Compass, Zap, ShieldCheck, Palette, Wrench, ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface AgentRoleCapsuleProps {
  currentRole?: AgentRoleType;
  onSelectRole: (role: AgentRoleType) => void;
  compact?: boolean;
}

export const AgentRoleCapsule: React.FC<AgentRoleCapsuleProps> = ({
  currentRole = 'raw',
  onSelectRole,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeConfig = AGENT_ROLE_CONFIGS[currentRole] || AGENT_ROLE_CONFIGS.raw;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const renderRoleIcon = (iconName: string, size = 12) => {
    const iconProps = { size, className: "text-zinc-400 group-hover:text-white transition-colors" };
    switch (iconName) {
      case 'Compass':
        return <Compass {...iconProps} />;
      case 'Zap':
        return <Zap {...iconProps} />;
      case 'ShieldCheck':
        return <ShieldCheck {...iconProps} />;
      case 'Palette':
        return <Palette {...iconProps} />;
      case 'Wrench':
        return <Wrench {...iconProps} />;
      default:
        return <Terminal {...iconProps} />;
    }
  };

  const getRoleShortcut = (role: AgentRoleType) => {
    switch (role) {
      case 'architect': return 'Alt+1';
      case 'implementer': return 'Alt+2';
      case 'reviewer': return 'Alt+3';
      case 'raw': return 'Alt+4';
      default: return '';
    }
  };

  return (
    <div className="relative inline-flex items-center no-drag" ref={dropdownRef}>
      {/* Sleek Minimal Trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={clsx(
          "h-5 px-2 rounded-md border flex items-center gap-1.5 transition-all select-none cursor-pointer active:scale-95",
          isOpen
            ? "bg-panel-elevated border-border-hover text-text-primary shadow-sm"
            : "bg-well hover:bg-panel border-border text-text-secondary hover:text-text-primary"
        )}
        title={`Active Mode: ${activeConfig.name} (Click to switch)`}
      >
        <span className="font-mono font-bold text-[10px] tracking-wider uppercase">
          {compact ? activeConfig.shortLabel : activeConfig.name}
        </span>
        <ChevronDown size={10} className={clsx("text-text-muted transition-transform duration-150", isOpen && "rotate-180 text-text-primary")} />
      </button>

      {/* Ultra-Refined Raycast / JetBrains Command Menu */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-1.5 w-52 py-1 rounded-xl bg-panel-elevated border border-border shadow-2xl z-[9999] animate-in fade-in zoom-in-95 duration-100 flex flex-col divide-y divide-border/40"
        >
          <div className="px-2.5 py-1 flex items-center justify-between">
            <span className="text-[9.5px] font-mono uppercase font-semibold text-text-muted tracking-wider">
              Terminal Mode
            </span>
            <span className="text-[9px] font-mono text-text-dim">Hotkeys</span>
          </div>

          <div className="p-1 flex flex-col gap-0.5">
            {(Object.keys(AGENT_ROLE_CONFIGS) as AgentRoleType[]).map((roleKey) => {
              const config = AGENT_ROLE_CONFIGS[roleKey];
              const isSelected = roleKey === currentRole;
              const shortcut = getRoleShortcut(roleKey);

              return (
                <button
                  key={roleKey}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRole(roleKey);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    "w-full text-left px-2 py-1.5 rounded-lg transition-all flex items-center justify-between group cursor-pointer",
                    isSelected
                      ? "bg-well text-text-primary font-medium border border-border/80"
                      : "hover:bg-panel text-text-muted hover:text-text-primary"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 flex items-center justify-center">
                      {renderRoleIcon(config.icon, 12)}
                    </div>
                    <span className="font-mono text-[11px] font-semibold tracking-tight">
                      {config.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {shortcut && (
                      <kbd className="px-1 py-0.2 rounded bg-well border border-border text-[9px] font-mono text-text-dim group-hover:text-text-muted">
                        {shortcut}
                      </kbd>
                    )}
                    {isSelected && <Check size={11} className="text-emerald-400 ml-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
