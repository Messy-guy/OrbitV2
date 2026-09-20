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
  const [selectedSource, setSelectedSource] = useState<'all' | 'anthropic' | 'skills_sh' | 'official' | 'github' | 'favorites'>('all');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('all');
  const [isFetching, setIsFetching] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

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

  const sources = [
    { id: 'all', label: '🌐 All Registries' },
    { id: 'anthropic', label: '🟣 Anthropic Official' },
    { id: 'skills_sh', label: '▲ skills.sh' },
    { id: 'official', label: '⭐ Verified' },
    { id: 'github', label: '🐙 GitHub' },
    { id: 'favorites', label: `★ Favorites (${favoriteSkills.length})` },
  ] as const;

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'framework', label: 'Frameworks' },
    { id: 'testing', label: 'Testing & TDD' },
    { id: 'security', label: 'Security' },
    { id: 'backend', label: 'Backend & DB' },
    { id: 'design', label: 'UI & Design' },
    { id: 'workflow', label: 'Workflows & Docs' },
  ] as const;

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
      // Source filter
      if (selectedSource === 'favorites') {
        if (!isFavorite(s.id)) return false;
      } else if (selectedSource === 'anthropic') {
        if (s.source !== 'anthropic') return false;
      } else if (selectedSource === 'skills_sh') {
        if (s.source !== 'skills_sh' && s.source !== 'vercel') return false;
      } else if (selectedSource === 'official') {
        if (!s.isPopular && s.source !== 'official' && s.source !== 'anthropic') return false;
      } else if (selectedSource === 'github') {
        if (s.source !== 'github') return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && selectedCategory !== 'popular' && selectedCategory !== 'favorites') {
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
  }, [allAvailableSkills, selectedSource, selectedCategory, searchQuery, isFavorite]);

  const handleOnlineSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingOnline(true);
    try {
      const srcFilter = selectedSource === 'favorites' ? 'all' : selectedSource;
      const results = await skillAggregatorService.searchOnlineSkills(searchQuery, srcFilter);
      setOnlineSkills((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const item of results) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
        return Array.from(map.values());
      });
    } catch (e) {
      console.warn('Online search error:', e);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const getSourceBadge = (skill: SkillItem) => {
    if (skill.source === 'anthropic') {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-400 shrink-0">
          🟣 Anthropic
        </span>
      );
    }
    if (skill.source === 'skills_sh' || skill.source === 'vercel') {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shrink-0">
          ▲ skills.sh
        </span>
      );
    }
    if (skill.isPopular || skill.source === 'official') {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 shrink-0">
          ⭐ Verified
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-well border border-border text-text-muted shrink-0">
        🐙 {skill.author || 'GitHub'}
      </span>
    );
  };

  if (!isOpen || !targetAgent) return null;

  const agentAssignments = (agentId && assignmentsByAgent[agentId]) || {};
  const providerCaps = ProviderSkillAdapterService.getCapabilities(targetAgent.provider);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Equip Skills to ${targetAgent.name}`}
      subtitle={`Provider: ${targetAgent.provider.toUpperCase()} (${providerCaps.integrationMode.toUpperCase()} integration) · ${allAvailableSkills.length} available skills`}
      maxWidth="3xl"
      className="max-h-[85vh] p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[540px] font-sans">
        {/* Search & Category Filter Bar */}
        <div className="p-3 border-b border-border bg-well/40 flex flex-col gap-2 shrink-0">
          <div className="relative flex items-center surface-well rounded-xl px-3 py-1.5 border border-border focus-within:border-border-hover">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search Anthropic, skills.sh, GitHub & verified skills (e.g. mcp, react, testing)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOnlineSearch();
              }}
              autoFocus
              className="w-full bg-transparent pl-2.5 pr-20 text-xs text-text-primary placeholder:text-text-dim focus:outline-none font-mono"
            />
            {searchQuery && (
              <div className="absolute right-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOnlineSearch}
                  disabled={isSearchingOnline}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-panel-elevated hover:bg-well border border-border text-text-secondary hover:text-text-primary rounded cursor-pointer transition-colors"
                >
                  {isSearchingOnline ? 'Searching...' : 'Search Online'}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-text-muted hover:text-text-primary cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Registry Source Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
            {sources.map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => setSelectedSource(src.id)}
                className={clsx(
                  'px-2.5 py-0.5 rounded-md text-[10.5px] font-mono transition-all shrink-0 cursor-pointer',
                  selectedSource === src.id
                    ? 'bg-text-primary text-background font-bold shadow-xs'
                    : 'text-text-muted hover:text-text-primary hover:bg-well border border-border/70'
                )}
              >
                {src.label}
              </button>
            ))}
          </div>

          {/* Category Selector */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'px-2 py-0.5 rounded text-[10.5px] font-mono transition-all shrink-0 cursor-pointer',
                  selectedCategory === cat.id
                    ? 'bg-panel-elevated text-text-primary font-bold border border-border'
                    : 'text-text-muted hover:text-text-primary hover:bg-well'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skill Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-panel">
          {isFetching && onlineSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted font-mono text-xs">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span>Loading skill registry (Anthropic, skills.sh, & open catalogs)...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-dim font-mono text-xs">
              <Sparkles size={20} className="opacity-40" />
              <span>
                {searchQuery.trim()
                  ? `No skills match "${searchQuery.trim()}" in ${selectedSource === 'all' ? 'any registry' : selectedSource}.`
                  : selectedSource === 'favorites'
                    ? 'No favorites yet — star a skill to pin it here.'
                    : 'No skills in this category.'}
              </span>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={handleOnlineSearch}
                  disabled={isSearchingOnline}
                  className="px-3 py-1 text-xs font-mono bg-text-primary text-background rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {isSearchingOnline ? 'Searching GitHub & Registries...' : 'Search Online Repositories'}
                </button>
              )}
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
                    'p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 group select-none',
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

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-text-primary truncate">
                          {skill.shortLabel || skill.name}
                        </span>
                        {getSourceBadge(skill)}
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
