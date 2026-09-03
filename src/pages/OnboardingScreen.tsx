import React, { useState } from 'react';
import { 
  FolderGit2, 
  Terminal, 
  Layers, 
  ArrowRight, 
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  FileCode2,
  Activity,
  Cpu,
  ShieldCheck,
  Zap,
  Sparkles,
  Puzzle,
  Bot,
  FolderOpen,
  Plus
} from 'lucide-react';
import { useUIStore } from '../stores/ui.store';
import { useWorkspaceStore } from '../stores/workspace.store';
import { tauriService } from '../services';

const ONBOARDING_STORAGE_KEY = 'orbit_onboarding_completed_v1';

interface StepData {
  eyebrow: string;
  headline: string;
  body: string;
  visual: React.ReactNode;
}

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { setCreateWorkspaceOpen } = useUIStore();
  const { createWorkspace } = useWorkspaceStore();

  const handleDismiss = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {}
    onComplete();
  };

  const handleFinishAndCreateProject = () => {
    handleDismiss();
    setCreateWorkspaceOpen(true);
  };

  const handleFinishAndImportProject = async () => {
    handleDismiss();
    try {
      const selectedPath = await tauriService.openFolderDialog();
      if (selectedPath) {
        const parts = selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
        const folderName = parts[parts.length - 1] || 'Imported Workspace';
        await createWorkspace(folderName, selectedPath);
      }
    } catch (e) {
      console.warn('Import folder cancelled or failed:', e);
    }
  };

  const steps: StepData[] = [
    {
      eyebrow: 'Workspace Architecture',
      headline: 'Start with a project',
      body: 'Your code, context, decisions, and progress stay together in one workspace.',
      visual: (
        <div className="w-full h-56 rounded-2xl surface-well p-5 flex flex-col justify-between font-mono text-xs border border-border shadow-inner">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 text-text-muted">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-accent" />
              <span className="text-text-primary font-medium tracking-tight text-sm">~/projects/core-engine</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface text-text-secondary border border-border/40 font-sans">
              Active Project
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 my-auto">
            <div className="p-3.5 rounded-xl surface-card border border-border flex flex-col gap-1.5 shadow-sm">
              <span className="text-text-muted text-[10px] tracking-wider uppercase font-sans font-semibold">Context Graph</span>
              <span className="text-text-primary text-xs font-semibold flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-accent" /> 148 files indexed
              </span>
            </div>
            <div className="p-3.5 rounded-xl surface-card border border-border flex flex-col gap-1.5 shadow-sm">
              <span className="text-text-muted text-[10px] tracking-wider uppercase font-sans font-semibold">Live State</span>
              <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Synchronized
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 border-t border-border/40">
            <span>Branch: <span className="text-text-primary font-medium">main</span></span>
            <span className="text-emerald-400 flex items-center gap-1 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ready
            </span>
          </div>
        </div>
      )
    },
    {
      eyebrow: 'Agent Swarm Coordination',
      headline: 'Run multiple agents together',
      body: 'Launch specialized CLI agents side by side. Each agent runs in its own thread.',
      visual: (
        <div className="w-full h-56 rounded-2xl surface-well p-4 flex flex-col gap-2.5 justify-center border border-border">
          <div className="p-3 rounded-xl surface-card border border-border flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-mono font-bold text-xs">
                A1
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">Architect Agent</span>
                <span className="text-[11px] text-text-muted">Refactoring state management</span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
              busy
            </span>
          </div>

          <div className="p-3 rounded-xl surface-card border border-border flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                A2
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">Test Runner</span>
                <span className="text-[11px] text-text-muted">Running e2e verification</span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              idle
            </span>
          </div>
        </div>
      )
    },
    {
      eyebrow: 'Extensible Agent Capabilities',
      headline: 'Equip powerful agent skills',
      body: 'Supercharge agents with customized capabilities, memory, and automated workflows.',
      visual: (
        <div className="w-full h-56 rounded-2xl surface-well p-4 flex flex-col justify-between border border-border font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-text-primary">Skills Matrix</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
              Active Sync
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 my-auto">
            <div className="p-2.5 rounded-xl surface-card border border-border flex items-center gap-2.5 shadow-sm">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">Subagent Swarm</span>
                <span className="text-[10px] text-text-muted">Hierarchical tasks</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl surface-card border border-border flex items-center gap-2.5 shadow-sm">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">Semantic Memory</span>
                <span className="text-[10px] text-text-muted">Context vector recall</span>
              </div>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-accent/5 border border-accent/15 flex items-center justify-between text-[11px]">
            <span className="text-text-secondary">Skills automatically adapt per CLI agent</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
          </div>
        </div>
      )
    },
    {
      eyebrow: 'Mobile Cockpit & Remote Control',
      headline: 'Control from your phone',
      body: 'Monitor agents, approve commands, and stay in the loop from Orbit Mobile on iOS and Android.',
      visual: (
        <div className="w-full h-56 rounded-2xl surface-well p-5 flex flex-col items-center justify-center gap-3 border border-border text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-lg shadow-accent/10">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-text-primary">Live Mobile Telemetry</span>
            <span className="text-[11px] text-text-muted mt-1 max-w-[260px]">
              Hardware-secured session relay over end-to-end encrypted tunnels.
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-text-secondary">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> KeyStore TLS</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-accent" /> 0ms Relay</span>
          </div>
        </div>
      )
    }
  ];

  const current = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-canvas text-text-primary p-6 select-none font-sans relative overflow-hidden">
      
      {/* Background ambient glow */}
      <div className="absolute w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

      {/* Main Presentation Container */}
      <div className="w-full max-w-[560px] flex flex-col gap-6 z-10">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/orbit-logo.png" alt="Orbit Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            <div className="flex flex-col">
              <span className="font-mono font-bold text-xs tracking-[0.2em] text-text-primary uppercase">
                ORBIT
              </span>
              <span className="text-[11px] text-text-muted">
                Studio Onboarding
              </span>
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? 'w-7 bg-accent'
                    : idx < currentStep
                    ? 'w-2.5 bg-accent/40'
                    : 'w-2.5 bg-border'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content Card */}
        <div className="surface-card border border-border rounded-3xl p-7 flex flex-col gap-6 shadow-2xl backdrop-blur-md">
          
          {/* Visual Showcase */}
          <div className="w-full">
            {current.visual}
          </div>

          {/* Text Details */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-accent font-semibold">
              {current.eyebrow}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              {current.headline}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              {current.body}
            </p>
          </div>

          {/* Actions & Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div>
              {!isFirst ? (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-3.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 rounded-xl hover:bg-surface"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : (
                <button
                  onClick={handleDismiss}
                  className="px-3.5 py-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
                >
                  Skip Tour
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {!isLast ? (
                <button
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-accent text-accent-fg hover:opacity-90 transition-all flex items-center gap-2 shadow-sm shadow-accent/20 active:scale-95 cursor-pointer"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFinishAndImportProject}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-panel hover:bg-panel-hover border border-border text-text-primary transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-text-muted" /> Import Folder
                  </button>

                  <button
                    onClick={handleFinishAndCreateProject}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-accent text-accent-fg hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm shadow-accent/20 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Project
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
