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
    isSkillInstalled, 
    favoriteSkills, 
    toggleFavorite, 
    isFavorite 
  } = useSkillStore();

  const [onlineSkills, setOnlineSkills] = useState<SkillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('all');
  const [githubUrl, setGithubUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

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

  const categories: { id: SkillCategory; label: string }[] = [
    { id: 'all', label: `All (${onlineSkills.length})` },
    { id: 'favorites', label: `★ Favorites (${favoriteSkills.length})` },
    { id: 'popular', label: 'Verified' },
    { id: 'framework', label: 'Frameworks' },
    { id: 'testing', label: 'Testing' },
    { id: 'security', label: 'Security' },
    { id: 'design', label: 'UI & Parallax' },
    { id: 'backend', label: 'Backend & DB' },
  ];

  // Merge live items with local favorites so favorited skills always show up even offline
  const allAvailableSkills = useMemo(() => {
    const map = new Map<string, SkillItem>();
    for (const fav of favoriteSkills) map.set(fav.id, fav);
    for (const item of onlineSkills) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [onlineSkills, favoriteSkills]);

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

  const handleImportGitHub = async () => {
    if (!githubUrl.trim()) return;
    setIsImporting(true);
    try {
      const imported = await skillAggregatorService.importSkillFromGitHub(githubUrl);
      await installSkill(imported);
      setGithubUrl('');
    } catch (err) {
      console.warn('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isBrowserModalOpen}
      onClose={() => setBrowserModalOpen(false)}
      title="Skill Hub"
      subtitle={`${onlineSkills.length || '1,200+'} live skills from open registries`}
      maxWidth="2xl"
    >
      <div className="flex flex-col gap-3 max-h-[72vh] -mt-1 font-sans">
        
        {/* Search & GitHub URL Input Strip */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search skills (e.g. gsap, parallax, supabase, stripe, vitest)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-well border border-border focus:border-border-hover rounded-md text-xs font-mono text-text-primary focus:outline-none transition-all placeholder:text-text-muted"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Clean GitHub Importer */}
          <div className="flex items-center gap-1 bg-well border border-border rounded-md px-2 py-1">
            <input
              type="text"
              placeholder="github.com/org/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="bg-transparent border-none text-[11px] font-mono text-text-primary focus:outline-none w-32 placeholder:text-text-muted"
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
            title="Refresh live registry"
          >
            <RefreshCw size={12} className={clsx(isLoading && "animate-spin")} />
          </button>
        </div>

        {/* Minimal Category Tab Strip */}
        <div className="flex items-center gap-1 border-b border-border pb-2 overflow-x-auto custom-scroll">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={clsx(
                "px-2 py-1 rounded text-[11px] font-mono transition-all shrink-0 cursor-pointer",
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
        <div className="flex flex-col divide-y divide-border/60 overflow-y-auto pr-1 max-h-[460px] custom-scroll">
          {isLoading && allAvailableSkills.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-text-muted font-mono text-xs">
              <RefreshCw size={14} className="animate-spin" />
              <span>Fetching live skill registries...</span>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="py-12 text-center text-text-muted font-mono text-xs">
              {selectedCategory === 'favorites' 
                ? 'No starred favorite skills yet. Click the star ★ icon on any skill to pin it here and in your sidebar!'
                : `No skills found matching "${searchQuery}".`}
            </div>
          ) : (
            filteredSkills.map((skill) => {
              const isInstalled = isSkillInstalled(skill.id);
              const isFav = isFavorite(skill.id);

              return (
                <div
                  key={skill.id}
                  className="py-2 px-2 hover:bg-well/50 transition-colors flex items-center justify-between gap-3 group"
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

                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-medium text-text-primary truncate">
                          {skill.name}
                        </span>

                        {skill.isPopular && (
                          <span className="text-[9px] font-mono text-text-dim px-1 py-0.2 rounded bg-well border border-border shrink-0">
                            Verified
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] font-sans text-text-muted line-clamp-1">
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
