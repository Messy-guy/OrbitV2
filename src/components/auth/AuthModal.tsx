import React, { useState } from 'react';
import { Github, Globe, Shield, Sparkles, X, Check, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../stores/auth.store';
import { AuthService } from '../../services/auth.service';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen, user, isAuthenticated, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    try {
      await AuthService.loginWithGitHub();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await AuthService.loginWithGoogle();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={() => setAuthModalOpen(false)}
      title={isAuthenticated ? "Account & Subscription" : "Sign in to Orbit Studio"}
      subtitle={isAuthenticated ? "Manage cloud sync, licenses, and GitHub integrations" : "Connect your account to sync projects, agents, and GitHub repositories"}
      maxWidth="md"
    >
      <div className="flex flex-col gap-5 pt-1 font-sans text-xs">
        {isAuthenticated && user ? (
          /* Logged In View */
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-panel-elevated border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name || 'User'} className="w-10 h-10 rounded-full border border-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-well border border-border flex items-center justify-center font-mono font-bold text-sm text-text-primary">
                    {user.email[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary text-sm">{user.name || 'Orbit Developer'}</span>
                  <span className="text-text-muted text-[11px] font-mono">{user.email}</span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {user.plan} PLAN
              </span>
            </div>

            {/* Account Details & Plan Info */}
            <div className="p-4 rounded-2xl bg-well border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-text-muted text-[11px] uppercase font-bold">Concurrent Agents</span>
                <span className="font-mono font-bold text-text-primary text-xs">
                  {user.plan === 'PRO' ? 'Unlimited' : '2 Active Agents (Free)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-text-muted text-[11px] uppercase font-bold">GitHub Sync</span>
                <span className="font-mono text-emerald-500 font-bold text-xs flex items-center gap-1">
                  {user.githubId ? '● Connected' : 'Not Linked'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-text-muted text-[11px] uppercase font-bold">Status</span>
                <span className="font-mono text-emerald-500 font-bold text-xs flex items-center gap-1">
                  ● Active
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={logout}
                className="px-3.5 py-2 rounded-xl text-xs font-mono text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-text-primary text-background font-mono font-bold text-xs hover:opacity-90 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Sign In Options View */
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* GitHub Button */}
              <button
                onClick={handleGitHubLogin}
                disabled={isLoading}
                className="p-4 rounded-2xl bg-panel-elevated hover:bg-panel border border-border hover:border-border-hover flex flex-col items-start gap-2.5 transition-all text-left group cursor-pointer shadow-sm disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-well border border-border flex items-center justify-center text-text-primary group-hover:scale-105 transition-transform">
                  <Github size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary text-xs flex items-center gap-1">
                    Continue with GitHub <ArrowRight size={11} className="text-text-muted group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <span className="text-[11px] text-text-muted mt-0.5">
                    Import repos and sync context
                  </span>
                </div>
              </button>

              {/* Google Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="p-4 rounded-2xl bg-panel-elevated hover:bg-panel border border-border hover:border-border-hover flex flex-col items-start gap-2.5 transition-all text-left group cursor-pointer shadow-sm disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-xl bg-well border border-border flex items-center justify-center text-text-primary group-hover:scale-105 transition-transform">
                  <Globe size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-text-primary text-xs flex items-center gap-1">
                    Continue with Google <ArrowRight size={11} className="text-text-muted group-hover:translate-x-0.5 transition-transform" />
                  </span>
                  <span className="text-[11px] text-text-muted mt-0.5">
                    Universal single sign-on
                  </span>
                </div>
              </button>
            </div>

            {/* Features Checklist */}
            <div className="p-4 rounded-2xl bg-well border border-border space-y-2 text-[11.5px] text-text-muted font-sans">
              <div className="flex items-center gap-2">
                <Check size={13} className="text-emerald-500 shrink-0" />
                <span>1-Click GitHub Repository Cloner & Workspace Importer</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={13} className="text-emerald-500 shrink-0" />
                <span>Server-Authoritative Ed25519 Cryptographic Agent Leases</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={13} className="text-emerald-500 shrink-0" />
                <span>72-Hour Offline Airplane Mode with Native OS Keyring Storage</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setAuthModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-text-muted hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
