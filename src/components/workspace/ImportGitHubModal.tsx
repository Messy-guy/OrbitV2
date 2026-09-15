import React, { useEffect, useState, useRef } from 'react';
import {
  Github,
  FolderGit2,
  Search,
  Download,
  ExternalLink,
  Loader2,
  Check,
  Lock,
  Star,
  Globe,
  FolderOpen,
  Link,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { GitHubService, GitHubRepoItem } from '../../services/github.service';
import { tauriService } from '../../services/tauri.service';
import { clsx } from 'clsx';

interface ImportGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabMode = 'search' | 'url' | 'my-repos';

export const ImportGitHubModal: React.FC<ImportGitHubModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, setAuthModalOpen } = useAuthStore();
  const { createWorkspace } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<TabMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepoItem[]>([]);
  const [userRepos, setUserRepos] = useState<GitHubRepoItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingUserRepos, setIsLoadingUserRepos] = useState(false);

  // Direct URL tab states
  const [directUrl, setDirectUrl] = useState('');
  const [customDestination, setCustomDestination] = useState('');

  // Cloning states
  const [cloningRepoName, setCloningRepoName] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load user repositories on mount/open
  useEffect(() => {
    if (isOpen) {
      loadUserRepos();
      setCloneError(null);
      setCloneSuccess(null);
    }
  }, [isOpen]);

  const loadUserRepos = async () => {
    setIsLoadingUserRepos(true);
    try {
      const repos = await GitHubService.fetchUserRepositories();
      setUserRepos(repos);
    } catch (e) {
      console.warn('Failed to load user repos:', e);
    } finally {
      setIsLoadingUserRepos(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await GitHubService.searchRepositories(trimmed);
        setSearchResults(results);
      } catch (e) {
        console.warn('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, isOpen]);

  const handlePickDestination = async () => {
    try {
      const picked = await tauriService.openFolderDialog();
      if (picked) {
        setCustomDestination(picked);
      }
    } catch (e) {
      console.warn('Folder picker failed:', e);
    }
  };

  const handleCloneRepo = async (repoName: string, cloneUrl: string) => {
    setCloneError(null);
    setCloneSuccess(null);
    setCloningRepoName(repoName);

    try {
      let destParent = customDestination;
      if (!destParent) {
        // Prompt for destination folder
        const picked = await tauriService.openFolderDialog();
        if (!picked) {
          setCloningRepoName(null);
          return;
        }
        destParent = picked;
      }

      const fullPath = `${destParent}/${repoName}`.replace(/\\/g, '/');

      // 1. Run real git clone
      await tauriService.gitCloneRepo(cloneUrl, fullPath);

      // 2. Create and switch to workspace
      await createWorkspace(repoName, fullPath);

      setCloneSuccess(`Cloned ${repoName} successfully!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setCloneError(typeof err === 'string' ? err : err?.message || String(err));
    } finally {
      setCloningRepoName(null);
    }
  };

  const handleDirectUrlClone = async () => {
    if (!directUrl.trim()) return;
    let url = directUrl.trim();

    // If user entered "owner/repo", expand to GitHub https URL
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(url)) {
      url = `https://github.com/${url}.git`;
    }

    // Extract repo name from URL
    const urlParts = url.replace(/\.git$/, '').split('/');
    const repoName = urlParts[urlParts.length - 1] || 'imported-project';

    await handleCloneRepo(repoName, url);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import from GitHub"
      subtitle="Clone and open any public or private repository in Orbit Studio"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3 font-sans text-xs pt-1">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-well border border-border rounded-xl">
          <button
            onClick={() => setActiveTab('search')}
            className={clsx(
              'flex-1 py-1.5 px-3 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer',
              activeTab === 'search'
                ? 'bg-panel text-text-primary shadow-sm border border-border/80'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Search size={12} />
            <span>Search GitHub</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={clsx(
              'flex-1 py-1.5 px-3 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer',
              activeTab === 'url'
                ? 'bg-panel text-text-primary shadow-sm border border-border/80'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Link size={12} />
            <span>Clone by URL</span>
          </button>

          <button
            onClick={() => setActiveTab('my-repos')}
            className={clsx(
              'flex-1 py-1.5 px-3 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer',
              activeTab === 'my-repos'
                ? 'bg-panel text-text-primary shadow-sm border border-border/80'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <FolderGit2 size={12} />
            <span>My Repositories ({userRepos.length})</span>
          </button>
        </div>

        {/* Global Clone Error / Success Banners */}
        {cloneError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 font-mono">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Clone Failed</span>
              <span className="text-[11px] leading-relaxed break-all opacity-90">{cloneError}</span>
            </div>
          </div>
        )}

        {cloneSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-mono">
            <Check size={14} />
            <span className="font-bold">{cloneSuccess}</span>
          </div>
        )}

        {/* ================= TAB 1: LIVE GITHUB SEARCH ================= */}
        {activeTab === 'search' && (
          <div className="flex flex-col gap-3">
            {/* Search Input Bar */}
            <div className="relative">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search any repository (e.g. facebook/react, torvalds/linux, tailwind)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors"
              />
              {isSearching && (
                <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />
              )}
            </div>

            {/* Results Viewport */}
            <div className="max-h-80 min-h-[160px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 p-1 -mx-1">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
                  <Loader2 size={18} className="animate-spin text-amber-500" />
                  <span className="font-mono text-xs">Searching GitHub repositories...</span>
                </div>
              ) : !searchQuery.trim() ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2 text-text-muted font-mono">
                  <Globe size={24} className="text-text-dim mb-1" />
                  <span className="font-bold text-text-primary text-xs">Search Any Public or Private Repository</span>
                  <span className="text-[11px] text-text-dim max-w-sm">
                    Type an organization name, repository name, or topic to search millions of repositories across GitHub.
                  </span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-1.5 text-text-muted font-mono text-xs">
                  <span>No repositories found matching "{searchQuery}"</span>
                  <button
                    onClick={() => {
                      setDirectUrl(searchQuery);
                      setActiveTab('url');
                    }}
                    className="mt-1 text-amber-400 hover:underline cursor-pointer"
                  >
                    Try cloning "{searchQuery}" directly by URL ➜
                  </button>
                </div>
              ) : (
                searchResults.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-3 rounded-xl bg-panel-elevated hover:bg-panel border border-border flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-well border border-border flex items-center justify-center shrink-0 text-text-muted">
                        {repo.private ? <Lock size={12} className="text-amber-500" /> : <FolderGit2 size={12} />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-text-primary text-xs truncate">
                            {repo.fullName}
                          </span>
                          {repo.stargazersCount !== undefined && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-mono">
                              <Star size={10} className="fill-amber-400" />
                              <span>{repo.stargazersCount.toLocaleString()}</span>
                            </span>
                          )}
                          {repo.language && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-well border border-border text-text-dim font-mono">
                              {repo.language}
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <span className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
                            {repo.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCloneRepo(repo.name, repo.cloneUrl)}
                      disabled={cloningRepoName === repo.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
                    >
                      {cloningRepoName === repo.name ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Cloning...</span>
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          <span>Clone & Open</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: CLONE BY DIRECT URL ================= */}
        {activeTab === 'url' && (
          <div className="flex flex-col gap-3 p-1">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono font-bold text-text-primary text-xs">
                Repository URL or identifier
              </label>
              <input
                type="text"
                placeholder="https://github.com/owner/repository.git or owner/repo"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors"
              />
              <span className="text-[11px] text-text-dim font-sans">
                Supports HTTPS, SSH (git@github.com:...), or shorthand repo names (e.g. facebook/react).
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono font-bold text-text-primary text-xs">
                Destination Directory (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Defaults to folder picker on clone..."
                  value={customDestination}
                  onChange={(e) => setCustomDestination(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors"
                />
                <button
                  type="button"
                  onClick={handlePickDestination}
                  className="px-3 py-2 rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FolderOpen size={13} />
                  <span>Browse…</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleDirectUrlClone}
              disabled={!directUrl.trim() || !!cloningRepoName}
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cloningRepoName ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Cloning repository from GitHub...</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Clone & Open Workspace</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ================= TAB 3: MY REPOSITORIES ================= */}
        {activeTab === 'my-repos' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-text-muted font-mono">
                Detected from local GitHub CLI (<kbd className="text-text-primary">gh</kbd>) and signed-in account
              </span>
              <button
                onClick={loadUserRepos}
                className="p-1 text-text-muted hover:text-text-primary hover:bg-well rounded transition-colors cursor-pointer"
                title="Refresh repositories"
              >
                <RefreshCw size={12} className={clsx(isLoadingUserRepos && 'animate-spin')} />
              </button>
            </div>

            <div className="max-h-80 min-h-[160px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 p-1 -mx-1">
              {isLoadingUserRepos ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
                  <Loader2 size={18} className="animate-spin text-amber-500" />
                  <span className="font-mono text-xs">Loading your repositories...</span>
                </div>
              ) : userRepos.length === 0 ? (
                <div className="p-6 rounded-2xl bg-well border border-border flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-panel border border-border flex items-center justify-center text-text-primary">
                    <Github size={20} />
                  </div>
                  <div>
                    <span className="font-bold text-text-primary text-sm block">No Local or Cloud Repositories Found</span>
                    <span className="text-text-muted text-[11.5px] block mt-1">
                      Sign in with GitHub or use <kbd className="text-text-primary">gh auth login</kbd> in your terminal to list your private repositories automatically.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => {
                        onClose();
                        setAuthModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
                    >
                      Sign In with GitHub
                    </button>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="px-4 py-2 rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary font-mono font-bold text-xs transition-all cursor-pointer"
                    >
                      Search Public Repos
                    </button>
                  </div>
                </div>
              ) : (
                userRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-3 rounded-xl bg-panel-elevated hover:bg-panel border border-border flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-well border border-border flex items-center justify-center shrink-0 text-text-muted">
                        {repo.private ? <Lock size={12} className="text-amber-500" /> : <FolderGit2 size={12} />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono font-bold text-text-primary text-xs truncate">
                          {repo.fullName}
                        </span>
                        {repo.description && (
                          <span className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
                            {repo.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCloneRepo(repo.name, repo.cloneUrl)}
                      disabled={cloningRepoName === repo.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
                    >
                      {cloningRepoName === repo.name ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Cloning...</span>
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          <span>Clone & Open</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
