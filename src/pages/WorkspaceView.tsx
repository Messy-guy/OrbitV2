import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { useAgentStore } from '../stores/agent.store';
import { useContextStore } from '../stores/context.store';
import { useActivityStore } from '../stores/activity.store';
import { useUIStore } from '../stores/ui.store';
import { Sidebar } from '../components/layout/Sidebar';
import { BottomDock } from '../components/layout/BottomDock';
import { AgentGrid } from '../components/agent/AgentGrid';
import { EmptyWorkspace } from '../components/workspace/EmptyWorkspace';
import { ContextPanel } from '../components/context/ContextPanel';
import { ActivityPanel } from '../components/activity/ActivityPanel';
import { FilesPanel } from '../components/files/FilesPanel';
import { GitPanel } from '../components/git/GitPanel';
import { SessionsPanel } from '../components/sessions/SessionsPanel';
import { AddAgentModal } from '../components/agent/AddAgentModal';
import { ShareContextModal } from '../components/handoff/ShareContextModal';
import { CreateCheckpointModal } from '../components/context/CreateCheckpointModal';
import { HandoffAnimationOverlay } from '../components/handoff/HandoffAnimationOverlay';

export const WorkspaceView: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const { agents, loadAgentsForWorkspace } = useAgentStore();
  const { loadContextForWorkspace } = useContextStore();
  const { loadWorkspaceData } = useActivityStore();
  const { activeBottomPanel } = useUIStore();

  const activeWorkspace = getActiveWorkspace();

  useEffect(() => {
    if (activeWorkspaceId) {
      loadAgentsForWorkspace(activeWorkspaceId);
      loadContextForWorkspace(activeWorkspaceId);
      loadWorkspaceData(activeWorkspaceId);
    }
  }, [activeWorkspaceId, loadAgentsForWorkspace, loadContextForWorkspace, loadWorkspaceData]);

  if (!activeWorkspace) return null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Agent Grid or Empty State */}
        <main className="flex-1 overflow-hidden relative">
          {agents.length === 0 ? (
            <EmptyWorkspace workspaceName={activeWorkspace.name} />
          ) : (
            <AgentGrid />
          )}
        </main>

        {/* Active Bottom Panel Drawer */}
        {activeBottomPanel === 'context' && <ContextPanel />}
        {activeBottomPanel === 'activity' && <ActivityPanel />}
        {activeBottomPanel === 'files' && <FilesPanel />}
        {activeBottomPanel === 'git' && <GitPanel />}
        {activeBottomPanel === 'sessions' && <SessionsPanel />}

        {/* Bottom Navigation Dock */}
        <BottomDock />
      </div>

      {/* Modals & Overlays */}
      <AddAgentModal />
      <ShareContextModal />
      <CreateCheckpointModal />
      <HandoffAnimationOverlay />
    </div>
  );
};
