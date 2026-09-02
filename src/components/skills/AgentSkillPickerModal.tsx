import React, { useState, useEffect, useMemo } from 'react';
import { Search, Star, Check, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useSkillStore } from '../../stores/skill.store';
import { useAgentStore } from '../../stores/agent.store';
import { skillAggregatorService } from '../../services/skillAggregator.service';
import { ProviderSkillAdapterService } from '../../services/providerSkillAdapter.service';
import { SkillCategory, SkillItem } from '../../types/skills';
import { clsx } from 'clsx';

interface AgentSkillPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string | null;
}

export const AgentSkillPickerModal: React.FC<AgentSkillPickerModalProps> = ({
  isOpen,
  onClose,
  agentId,
}) => {
  const {
    favoriteSkills,
    installedSkills,
    toggleFavorite,
    isFavorite,
    equipSkillToAgent,
    unequipSkillFromAgent,
    assignmentsByAgent,
  } = useSkillStore();

  const agents = useAgentStore((s) => s.agents);
  const targetAgent = agents.find((a) => a.id === agentId);

  const [onlineSkills, setOnlineSkills] = useState<SkillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('all');
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsFetching(true);
      skillAggregatorService
        .fetchLiveOnlineSkills()
        .then((res) => setOnlineSkills(res))
        .catch(() => {})
        .finally(() => setIsFetching(false));
    }
  }, [isOpen]);

  const allAvailableSkills = useMemo(() => {
    const map = new Map<string, SkillItem>();
    for (const fav of favoriteSkills) map.set(fav.id, fav);
    for (const inst of installedSkills) map.set(inst.id, inst);
    for (const item of onlineSkills) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [favoriteSkills, installedSkills, onlineSkills]);

  const filteredSkills = useMemo(() => {
    return allAvailableSkills.filter((s) => {
      if (selectedCategory === 'popular') {
        if (!s.isPopular) return false;
      } else if (selectedCategory === 'favorites') {
        if (!isFavorite(s.id)) return false;
      } else if (selectedCategory !== 'all') {
        if (s.category !== selectedCategory) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        (s.author && s.author.toLowerCase().includes(q)) ||
        (s.shortLabel && s.shortLabel.toLowerCase().includes(q))
      );
    });
  }, [allAvailableSkills, selectedCategory, searchQuery, isFavorite]);

  if (!isOpen || !targetAgent) return null;

  const agentAssignments = (agentId && assignmentsByAgent[agentId]) || {};
  const providerCaps = ProviderSkillAdapterService.getCapabilities(targetAgent.provider);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Equip Skills to ${targetAgent.name}`}
      subtitle={`Provider: ${targetAgent.provider.toUpperCase()} (${providerCaps.integrationMode.toUpperCase()} integration)`}
      maxWidth="3xl"
      className="max-h-[85vh] p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[520px] font-sans">
        {/* Search & Category Filter Bar */}
        <div className="p-3.5 border-b border-border bg-well/40 flex flex-col gap-2.5 shrink-0">
          <div className="relative flex items-center surface-well rounded-xl px-3 py-2 border border-border focus-within:border-border-hover">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search 1,200+ skills by keyword, framework, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-transparent pl-2.5 text-xs text-text-primary placeholder:text-text-dim focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {(
              [
                { id: 'all', label: `All (${allAvailableSkills.length})` },
                { id: 'favorites', label: `★ Favorites (${favoriteSkills.length})` },
                { id: 'popular', label: 'Verified' },
                { id: 'framework', label: 'Frameworks' },
                { id: 'testing', label: 'Testing' },
                { id: 'security', label: 'Security' },
                { id: 'backend', label: 'Backend' },
                { id: 'design', label: 'UI & Design' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all shrink-0 cursor-pointer',
                  selectedCategory === cat.id
                    ? 'bg-panel-elevated text-text-primary font-bold border border-border shadow-xs'
                    : 'text-text-muted hover:text-text-primary hover:bg-well'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skill Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 custom-scrollbar bg-panel">
          {isFetching && onlineSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted font-mono text-xs">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span>Loading skill registry...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-text-dim font-mono text-xs">
              <Sparkles size={20} className="opacity-40" />
              <span>No matching skills found.</span>
            </div>
          ) : (
            filteredSkills.map((skill) => {
              const assignment = agentAssignments[skill.id];
              const isEquipped = assignment?.status === 'equipped';
              const isMounting = assignment?.status === 'mounting';
              const isFailed = assignment?.status === 'failed';
              const isFav = isFavorite(skill.id);

              return (
                <div
                  key={skill.id}
                  className={clsx(
                    'p-3 rounded-xl border transition-all flex items-center justify-between gap-3 group select-none',
                    isEquipped
                      ? 'bg-well/70 border-emerald-500/30'
                      : 'bg-panel-elevated hover:bg-well border-border/70 hover:border-border'
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(skill);
                      }}
                      className="mt-0.5 p-1 text-text-dim hover:text-amber-400 transition-colors cursor-pointer"
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        size={13}
                        className={clsx(
                          isFav ? 'text-amber-400 fill-amber-400' : 'text-text-dim hover:text-amber-400'
                        )}
                      />
                    </button>

                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-text-primary truncate">
                          {skill.shortLabel || skill.name}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-well border border-border text-text-muted">
                          {skill.sourceLabel || skill.author || 'Open'}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted line-clamp-1 leading-snug">
                        {skill.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isMounting && (
                      <span className="flex items-center gap-1 font-mono text-[10.5px] text-amber-400 font-bold px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20 animate-pulse">
                        <Loader2 size={11} className="animate-spin" />
                        <span>Mounting...</span>
                      </span>
                    )}

                    {isFailed && (
                      <span
                        className="flex items-center gap-1 font-mono text-[10.5px] text-red-400 font-bold px-2 py-1 rounded-lg bg-red-400/10 border border-red-400/20"
                        title={assignment?.error || 'Mount failed'}
                      >
                        <AlertCircle size={11} />
                        <span>Failed</span>
                      </span>
                    )}

                    {isEquipped ? (
                      <button
                        onClick={() => unequipSkillFromAgent(targetAgent.id, skill.id)}
                        className="flex items-center gap-1 font-mono text-[11px] text-emerald-400 hover:text-red-400 font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-red-500/10 border border-emerald-500/20 hover:border-red-500/20 transition-all cursor-pointer group/btn"
                        title="Click to unequip skill"
                      >
                        <Check size={11} className="group-hover/btn:hidden" />
                        <span className="group-hover/btn:hidden">Equipped</span>
                        <span className="hidden group-hover/btn:inline">Unequip</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => equipSkillToAgent(targetAgent.id, skill)}
                        className="font-mono text-[11px] font-bold px-3 py-1 rounded-lg bg-well hover:bg-panel-elevated border border-border hover:border-border-hover text-text-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        + Equip
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Summary */}
        <div className="p-3 border-t border-border bg-well/40 flex items-center justify-between text-[11px] font-mono text-text-muted shrink-0">
          <span>
            {Object.values(agentAssignments).filter((a) => a.status === 'equipped').length} Skills Equipped to{' '}
            {targetAgent.name}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-well hover:bg-panel-elevated border border-border text-text-primary cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};
