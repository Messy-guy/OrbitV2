import React, { useEffect, useState } from 'react';
import { Github, FolderGit2, Search, Download, ExternalLink, Loader2, Check, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { AuthService, GitHubRepo } from '../../services/auth.service';
import { tauriService } from '../../services/tauri.service';

interface ImportGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportGitHubModal: React.FC<ImportGitHubModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, setAuthModalOpen } = useAuthStore();
  const { createWorkspace } = useWorkspaceStore();

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      loadRepos();
    }
  }, [isOpen, isAuthenticated, user]);

  const loadRepos = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await AuthService.fetchUserRepositories(user.id);
      setRepos(data);
    } catch (e) {
      console.warn('Failed to load GitHub repos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneAndOpen = async (repo: GitHubRepo) => {
    try {
      setCloningRepoId(repo.id);
      // Pick local folder destination or default to ~/Desktop/personal_projects/repo.name
      const destParent = await tauriService.openFolderDialog();
      if (!destParent) {
        setCloningRepoId(null);
        return;
      }

      const fullPath = `${destParent}/${repo.name}`;
      // Initialize workspace
      await createWorkspace(repo.name, fullPath);
      onClose();
    } catch (e) {
      console.error('Clone failed:', e);
    } finally {
      setCloningRepoId(null);
    }
  };

  if (!isOpen) return null;

  const filtered = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import from GitHub"
      subtitle="Clone and open your remote repositories in Orbit Studio"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 font-sans text-xs pt-1">
        {!isAuthenticated || !user ? (
          <div className="p-6 rounded-2xl bg-well border border-border flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-panel border border-border flex items-center justify-center text-text-primary">
              <Github size={20} />
            </div>
            <div>
              <span className="font-bold text-text-primary text-sm block">GitHub Authentication Required</span>
              <span className="text-text-muted text-[11.5px] block mt-1">Sign in with your GitHub account to access personal and organization repositories.</span>
            </div>
            <button
              onClick={() => {
                onClose();
                setAuthModalOpen(true);
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
            >
              Sign In with GitHub
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Filter repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-well border border-border text-text-primary font-mono text-xs placeholder:text-text-dim focus:outline-none focus:border-border-hover transition-colors"
              />
            </div>

            {/* Repositories List */}
            <div className="max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 p-1 -mx-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted">
                  <Loader2 size={18} className="animate-spin text-emerald-500" />
                  <span className="font-mono text-xs">Fetching repositories from GitHub API...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-text-muted font-mono text-xs">
                  No repositories matching "{search}"
                </div>
              ) : (
                filtered.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-3 rounded-xl bg-panel-elevated hover:bg-panel border border-border flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-lg bg-well border border-border flex items-center justify-center shrink-0 text-text-muted">
                        {repo.private ? <Lock size={11} className="text-amber-500" /> : <FolderGit2 size={11} />}
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

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCloneAndOpen(repo)}
                        disabled={cloningRepoId === repo.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {cloningRepoId === repo.id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Cloning...</span>
                          </>
                        ) : (
                          <>
                            <Download size={12} />
                            <span>Import</span>
                          </>
                        )}
                      </button>
                    </div>
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
