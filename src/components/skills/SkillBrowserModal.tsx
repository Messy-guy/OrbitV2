import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus, Check, RefreshCw, ExternalLink, Star } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useSkillStore } from '../../stores/skill.store';
import { skillAggregatorService } from '../../services/skillAggregator.service';
import { SkillCategory, SkillItem } from '../../types/skills';
import { tauriService } from '../../services';
import { clsx } from 'clsx';

export const SkillBrowserModal: React.FC = () => {
  const { 
    isBrowserModalOpen, 
    setBrowserModalOpen, 
    installSkill, 
    installedSkills,
    isSkillInstalled, 
    favoriteSkills, 
    toggleFavorite, 
    isFavorite 
  } = useSkillStore();

  const [onlineSkills, setOnlineSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<'all' | 'anthropic' | 'skills_sh' | 'official' | 'github' | 'favorites' | 'local'>('all');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('all');
  const [githubUrl, setGithubUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<SkillItem | null>(null);
  const [importError, setImportError] = useState('');

  const loadSkills = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const skills = await skillAggregatorService.fetchLiveOnlineSkills(force);
      setOnlineSkills(skills);
    } catch (err) {
      console.warn('Skill fetch notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isBrowserModalOpen) {
      loadSkills();
    }
  }, [isBrowserModalOpen]);

  const sources = [
    { id: 'all', label: '🌐 All Registries' },
    { id: 'anthropic', label: '🟣 Anthropic Official' },
    { id: 'skills_sh', label: '▲ skills.sh' },
    { id: 'official', label: '⭐ Verified' },
    { id: 'github', label: '🐙 GitHub' },
    { id: 'favorites', label: `★ Favorites (${favoriteSkills.length})` },
    { id: 'local', label: `📁 Workspace (${installedSkills.filter(s => s.source === 'local').length})` },
  ] as const;

  const categories: { id: SkillCategory; label: string }[] = [
    { id: 'all', label: 'All Categories' },
    { id: 'framework', label: 'Frameworks' },
    { id: 'testing', label: 'Testing & TDD' },
    { id: 'security', label: 'Security' },
    { id: 'design', label: 'UI & Design' },
    { id: 'backend', label: 'Backend & DB' },
    { id: 'workflow', label: 'Workflows & Docs' },
  ];

  // Merge live items with local installed & favorites so they always show up even offline
  const allAvailableSkills = useMemo(() => {
    const map = new Map<string, SkillItem>();
    for (const inst of installedSkills) map.set(inst.id, inst);
    for (const fav of favoriteSkills) map.set(fav.id, fav);
    for (const item of onlineSkills) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [installedSkills, onlineSkills, favoriteSkills]);

  const filteredSkills = useMemo(() => {
    return allAvailableSkills.filter((s) => {
      // Source filtering
      if (selectedSource === 'favorites') {
        if (!isFavorite(s.id)) return false;
      } else if (selectedSource === 'local') {
        if (s.source !== 'local') return false;
      } else if (selectedSource === 'anthropic') {
        if (s.source !== 'anthropic') return false;
      } else if (selectedSource === 'skills_sh') {
        if (s.source !== 'skills_sh' && s.source !== 'vercel') return false;
      } else if (selectedSource === 'official') {
        if (!s.isPopular && s.source !== 'official' && s.source !== 'anthropic') return false;
      } else if (selectedSource === 'github') {
        if (s.source !== 'github') return false;
      }

      // Category filtering
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
      const srcFilter = (selectedSource === 'favorites' || selectedSource === 'local') ? 'all' : selectedSource;
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

  const handleImportGitHub = async () => {
    if (!githubUrl.trim()) return;
    setIsImporting(true);
    setImportError('');
    try {
      const imported = await skillAggregatorService.importSkillFromGitHub(githubUrl);
      setImportPreview(imported);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setImportError(message);
      console.warn('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    await installSkill(importPreview);
    setImportPreview(null);
    setGithubUrl('');
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
    if (skill.source === 'local') {
      return (
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shrink-0">
          📁 Local
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-well border border-border text-text-muted shrink-0">
        🐙 {skill.author || 'GitHub'}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isBrowserModalOpen}
      onClose={() => setBrowserModalOpen(false)}
      title="Skill Hub"
      subtitle={`${onlineSkills.length || '1,200+'} live skills across Anthropic, skills.sh, & open registries`}
      maxWidth="3xl"
    >
      <div className="flex flex-col gap-2.5 max-h-[75vh] -mt-1 font-sans">
        
        {/* Search & GitHub URL Input Strip */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search Anthropic, skills.sh, GitHub & verified skills (e.g. mcp, playwright, react, vitest)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOnlineSearch();
              }}
              className="w-full pl-8 pr-20 py-1.5 bg-well border border-border focus:border-border-hover rounded-md text-xs font-mono text-text-primary focus:outline-none transition-all placeholder:text-text-muted"
              autoFocus
            />
            {searchQuery ? (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOnlineSearch}
                  disabled={isSearchingOnline}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-panel-elevated hover:bg-well border border-border text-text-secondary hover:text-text-primary rounded cursor-pointer transition-colors"
                >
                  {isSearchingOnline ? 'Searching...' : 'Search Online'}
                </button>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <X size={11} />
                </button>
              </div>
            ) : null}
          </div>

          {/* Clean GitHub Importer */}
          <div className="flex items-center gap-1 bg-well border border-border rounded-md px-2 py-1">
            <input
              type="text"
              placeholder="github.com/org/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="bg-transparent border-none text-[11px] font-mono text-text-primary focus:outline-none w-28 placeholder:text-text-muted"
            />
            <button
              onClick={handleImportGitHub}
              disabled={!githubUrl.trim() || isImporting}
              className="px-1.5 py-0.5 bg-text-primary text-background font-mono text-[10px] font-semibold rounded hover:opacity-90 disabled:opacity-30 transition-all cursor-pointer"
            >
              {isImporting ? '...' : 'Import'}
            </button>
          </div>

          <button
            onClick={() => loadSkills(true)}
            disabled={isLoading}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-well rounded-md border border-border transition-colors cursor-pointer shrink-0"
            title="Refresh all registries"
          >
            <RefreshCw size={12} className={clsx(isLoading && "animate-spin")} />
          </button>
        </div>
        {importError && <div className="text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1">{importError}</div>}
        {importPreview && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><div className="text-xs font-mono text-text-primary truncate">Review imported skill: {importPreview.name}</div><div className="text-[10px] text-text-muted">Commit {importPreview.commitSha?.slice(0, 12)} · {importPreview.files?.length || 0} files · {importPreview.trust}</div></div>
              <div className="flex gap-1 shrink-0"><button onClick={() => setImportPreview(null)} className="px-2 py-1 text-[10px] font-mono text-text-muted border border-border rounded">Cancel</button><button onClick={confirmImport} className="px-2 py-1 text-[10px] font-mono bg-text-primary text-background rounded">Install</button></div>
            </div>
            {importPreview.dependencies?.length ? <div className="text-[10px] text-amber-300">External requirements: {importPreview.dependencies.map(d => d.name).join(', ')}. Review before running the skill.</div> : null}
          </div>
        )}

        {/* Registry Sources Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-1">
          {sources.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => setSelectedSource(src.id)}
              className={clsx(
                "px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all shrink-0 cursor-pointer",
                selectedSource === src.id
                  ? "bg-text-primary text-background font-bold shadow-xs"
                  : "text-text-muted hover:text-text-primary hover:bg-well border border-border/70"
              )}
            >
              {src.label}
            </button>
          ))}
        </div>

        {/* Category Sub-Filters */}
        <div className="flex items-center gap-1 border-b border-border pb-2 overflow-x-auto custom-scroll text-[10.5px]">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={clsx(
                "px-2 py-0.5 rounded text-[10.5px] font-mono transition-all shrink-0 cursor-pointer",
                selectedCategory === cat.id
                  ? "bg-panel-elevated text-text-primary font-semibold border border-border-hover"
                  : "text-text-muted hover:text-text-primary hover:bg-well"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Clean, Non-Clustered Skill List */}
        <div className="flex flex-col divide-y divide-border/60 overflow-y-auto pr-1 max-h-[440px] custom-scroll">
          {isLoading && allAvailableSkills.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-text-muted font-mono text-xs">
              <RefreshCw size={14} className="animate-spin" />
              <span>Fetching live skill registries (Anthropic, skills.sh, & open catalogs)...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-text-muted font-mono text-xs">
              <span>
                {selectedSource === 'favorites'
                  ? 'No starred favorite skills yet. Click the star ★ icon on any skill to pin it here and in your sidebar!'
                  : searchQuery.trim()
                    ? `No skills found matching "${searchQuery.trim()}" in ${selectedSource === 'all' ? 'any registry' : selectedSource}.`
                    : 'No skills available in this selection.'}
              </span>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={handleOnlineSearch}
                  disabled={isSearchingOnline}
                  className="mt-1 px-3 py-1 text-xs font-mono bg-text-primary text-background rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {isSearchingOnline ? 'Searching GitHub & Registries...' : 'Search Online Repositories'}
                </button>
              )}
            </div>
          ) : (
            filteredSkills.map((skill) => {
              const isInstalled = isSkillInstalled(skill.id);
              const isFav = isFavorite(skill.id);

              return (
                <div
                  key={skill.id}
                  className="py-2.5 px-2 hover:bg-well/50 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Star Favorite Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(skill);
                      }}
                      className={clsx(
                        "p-1 rounded transition-colors cursor-pointer shrink-0",
                        isFav 
                          ? "text-amber-400 hover:text-amber-300" 
                          : "text-text-dim hover:text-text-muted opacity-40 group-hover:opacity-100"
                      )}
                      title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Star size={13} fill={isFav ? "currentColor" : "none"} strokeWidth={1.8} />
                    </button>

                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-text-primary truncate">
                          {skill.shortLabel || skill.name}
                        </span>

                        {getSourceBadge(skill)}
                      </div>

                      <p className="text-[11px] font-sans text-text-muted line-clamp-1 leading-snug">
                        {skill.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {skill.rawUrl && (
                      <button
                        onClick={() => tauriService.openExternalUrl(skill.rawUrl!)}
                        className="text-text-dim hover:text-text-muted p-1 transition-colors cursor-pointer"
                        title="View repository"
                      >
                        <ExternalLink size={11} />
                      </button>
                    )}

                    {isInstalled ? (
                      <span className="flex items-center gap-1 text-[10.5px] font-mono text-emerald-500 font-medium px-2 py-0.5 rounded bg-emerald-500/10">
                        <Check size={10} strokeWidth={3} />
                        <span>Added</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => installSkill(skill)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-panel-elevated hover:bg-panel border border-border hover:border-border-hover text-text-primary rounded text-[11px] font-mono font-medium transition-all cursor-pointer active:scale-95"
                      >
                        <Plus size={10} />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
