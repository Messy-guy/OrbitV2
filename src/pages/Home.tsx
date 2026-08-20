import React, { useEffect } from 'react';
import { Orbit, FolderPlus } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { useUIStore } from '../stores/ui.store';
import { WorkspaceCard } from '../components/workspace/WorkspaceCard';
import { tauriService } from '../services';

export const Home: React.FC = () => {
  const { workspaces, loadWorkspaces, setActiveWorkspace, createWorkspace } = useWorkspaceStore();
  const { setCreateWorkspaceOpen } = useUIStore();

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handlePickAndCreateProject = async () => {
    try {
      const selectedPath = await tauriService.openFolderDialog();
      if (selectedPath) {
        const parts = selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
        const folderName = parts[parts.length - 1] || 'New Project';
        await createWorkspace(folderName, selectedPath);
        return;
      }
    } catch (e) {
      console.warn('Native folder picker failed or was cancelled:', e);
    }
    setCreateWorkspaceOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-canvas p-6 md:p-8 select-none font-sans">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-border">
          <div className="flex items-center gap-1.5 mb-1 text-text-muted font-mono text-[10.5px] uppercase tracking-widest font-bold">
            <Orbit size={13} />
            <span>Multi-Agent Desktop Workspace</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight font-mono uppercase">
            Projects & Workspaces
          </h1>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Select a project directory or open a folder to start multi-agent collaboration.
          </p>
        </div>

        {/* Workspaces Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {workspaces.map(ws => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onSelect={(id) => setActiveWorkspace(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
