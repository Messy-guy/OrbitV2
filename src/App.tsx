import React, { useEffect } from 'react';
import { useWorkspaceStore } from './stores/workspace.store';
import { AppHeader } from './components/layout/AppHeader';
import { Home } from './pages/Home';
import { WorkspaceView } from './pages/WorkspaceView';
import { CreateWorkspaceModal } from './components/workspace/CreateWorkspaceModal';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { DiffViewerModal } from './components/git/DiffViewerModal';
import { UpdateNotifier } from './components/layout/UpdateNotifier';
import { useSettingsStore, applyThemeTokens } from './stores/settings.store';

export const App: React.FC = () => {
  const { activeWorkspaceId, loadWorkspaces } = useWorkspaceStore();
  const { theme, accent } = useSettingsStore();

  useEffect(() => {
    loadWorkspaces();
    applyThemeTokens(theme, accent);
  }, [loadWorkspaces, theme, accent]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-text-primary overflow-hidden select-none">
      {/* App Header */}
      <AppHeader />

      {/* Main Screen */}
      <div className="flex-1 flex overflow-hidden">
        {activeWorkspaceId ? <WorkspaceView /> : <Home />}
      </div>

      {/* Global Modals & Update Notifier */}
      <CreateWorkspaceModal />
      <ShortcutsModal />
      <SettingsModal />
      <DiffViewerModal />
      <UpdateNotifier />
    </div>
  );
};

export default App;
