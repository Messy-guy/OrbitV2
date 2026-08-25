import React, { useEffect } from 'react';
import { useWorkspaceStore } from './stores/workspace.store';
import { AppHeader } from './components/layout/AppHeader';
import { Home } from './pages/Home';
import { WorkspaceView } from './pages/WorkspaceView';
import { CreateWorkspaceModal } from './components/workspace/CreateWorkspaceModal';
import { AddAgentModal } from './components/agent/AddAgentModal';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { DiffViewerModal } from './components/git/DiffViewerModal';
import { AuthModal } from './components/auth/AuthModal';
import { PairMobileModal } from './components/auth/PairMobileModal';
import { ProUpgradeModal } from './components/agent/ProUpgradeModal';
import { SkillBrowserModal } from './components/skills/SkillBrowserModal';
import { UpdateNotifier } from './components/layout/UpdateNotifier';
import { useSettingsStore, applyThemeTokens } from './stores/settings.store';
import { useUIStore } from './stores/ui.store';
import { useAgentStore } from './stores/agent.store';
import { useAuthStore } from './stores/auth.store';
import { LoginScreen } from './pages/LoginScreen';
import { desktopRelayService } from './services/desktopRelay.service';

export const App: React.FC = () => {
  const { activeWorkspaceId, loadWorkspaces } = useWorkspaceStore();
  const { theme, accent } = useSettingsStore();
  const { isAuthenticated, user } = useAuthStore();
  const { isProUpgradeModalOpen, setProUpgradeModalOpen } = useUIStore();
  const { agents } = useAgentStore();

  const isPro = user?.plan === 'PRO';
  const maxAllowedSlots = isPro ? 999 : 2;
  const currentRunningAgents = agents.filter(a => a.status === 'working' || a.status === 'ready').length;

  useEffect(() => {
    loadWorkspaces();
    applyThemeTokens(theme, accent);
  }, [loadWorkspaces, theme, accent]);

  useEffect(() => {
    // Automatically connect desktop to relay whenever the app is active
    desktopRelayService.connect();
    return () => {
      desktopRelayService.disconnect();
    };
  }, []);

  // Mandatory Authentication Gatekeeper
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-text-primary overflow-hidden select-none">
      {/* App Header */}
      <AppHeader />

      {/* Main Screen */}
      <div className="flex-1 flex overflow-hidden">
        {activeWorkspaceId ? <WorkspaceView /> : <Home />}
      </div>

      {/* Global Modals & Update Notifier */}
      <AddAgentModal />
      <CreateWorkspaceModal />
      <ShortcutsModal />
      <SettingsModal />
      <DiffViewerModal />
      <AuthModal />
      <PairMobileModal />
      <SkillBrowserModal />
      <ProUpgradeModal
        isOpen={isProUpgradeModalOpen}
        onClose={() => setProUpgradeModalOpen(false)}
        currentCount={currentRunningAgents}
        maxSlots={maxAllowedSlots}
      />
      <UpdateNotifier />
    </div>
  );
};

export default App;
