import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspace.store';
import { useAgentStore } from '../stores/agent.store';
import { useContextStore } from '../stores/context.store';
import { useActivityStore } from '../stores/activity.store';
import { useUIStore } from '../stores/ui.store';
import { Sidebar } from '../components/layout/Sidebar';
import { BottomDock } from '../components/layout/BottomDock';
import { AgentCanvas } from '../components/agent/AgentCanvas';
import { EmptyWorkspace } from '../components/workspace/EmptyWorkspace';
import { ContextPanel } from '../components/context/ContextPanel';
import { ActivityPanel } from '../components/activity/ActivityPanel';
import { FilesPanel } from '../components/files/FilesPanel';
import { GitPanel } from '../components/git/GitPanel';
import { SessionsPanel } from '../components/sessions/SessionsPanel';
import { AddAgentModal } from '../components/agent/AddAgentModal';
import { ShareContextModal } from '../components/handoff/ShareContextModal';
import { CreateCheckpointModal } from '../components/context/CreateCheckpointModal';
import { ContextDraftModal } from '../components/context/ContextDraftModal';
import { HandoffAnimationOverlay } from '../components/handoff/HandoffAnimationOverlay';
import { FileEditorModal } from '../components/editor/FileEditorModal';
import { DiffViewerModal } from '../components/git/DiffViewerModal';

import { useSkillStore } from '../stores/skill.store';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export const WorkspaceView: React.FC = () => {
  const { activeWorkspaceId, getActiveWorkspace } = useWorkspaceStore();
  const { agents, loadAgentsForWorkspace } = useAgentStore();
  const { loadContextForWorkspace } = useContextStore();
  const { loadWorkspaceData } = useActivityStore();
  const { activeBottomPanel } = useUIStore();

  const activeWorkspace = getActiveWorkspace();

  useEffect(() => {
    if (activeWorkspaceId && activeWorkspace) {
      loadAgentsForWorkspace(activeWorkspaceId, activeWorkspace.projectPath);
      loadContextForWorkspace(activeWorkspaceId, activeWorkspace.projectPath);
      loadWorkspaceData(activeWorkspaceId);
      if (activeWorkspace.projectPath) {
        useSkillStore.getState().loadLocalProjectSkills(activeWorkspace.projectPath);
      }
    }
  }, [activeWorkspaceId, activeWorkspace?.projectPath, loadAgentsForWorkspace, loadContextForWorkspace, loadWorkspaceData]);

  // Real-time Git state tracking: window focus, tab visibility, and quiet 12s idle poll
  useEffect(() => {
    const projectPath = activeWorkspace?.projectPath;
    if (!projectPath) return;

    let isRefreshing = false;
    const refreshGit = () => {
      if (isRefreshing || (typeof document !== 'undefined' && document.hidden)) return;
      isRefreshing = true;
      useContextStore
        .getState()
        .loadGitState(projectPath)
        .catch(() => {})
        .finally(() => {
          isRefreshing = false;
        });
    };

    const handleFocus = () => refreshGit();
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshGit();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const timer = setInterval(refreshGit, 12000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(timer);
    };
  }, [activeWorkspace?.projectPath]);

  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background select-none">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-xs font-mono">Loading workspace environment...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary name="WorkspaceView">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          {/* Agent Canvas Workspace */}
          <main className="flex-1 overflow-hidden relative">
            <ErrorBoundary name="AgentCanvas">
              <AgentCanvas />
            </ErrorBoundary>
          </main>

        {/* Active Bottom Panel Drawer */}
        {activeBottomPanel === 'context' && <ContextPanel />}
        {activeBottomPanel === 'activity' && <ActivityPanel />}
        {activeBottomPanel === 'files' && <FilesPanel />}
        {activeBottomPanel === 'git' && <GitPanel />}
        {activeBottomPanel === 'sessions' && <SessionsPanel />}
      </div>

      {/* Modals & Overlays */}
      <AddAgentModal />
      <ShareContextModal />
      <CreateCheckpointModal />
      <ContextDraftModal />
      <HandoffAnimationOverlay />
      <FileEditorModal />
      <DiffViewerModal />
    </div>
    </ErrorBoundary>
  );
};

