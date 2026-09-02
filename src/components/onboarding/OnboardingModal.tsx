import React, { useState, useEffect } from 'react';
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
  Bot
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useUIStore } from '../../stores/ui.store';

const ONBOARDING_STORAGE_KEY = 'orbit_onboarding_completed_v1';

interface StepData {
  eyebrow: string;
  headline: string;
  body: string;
  visual: React.ReactNode;
}

export const OnboardingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { setCreateWorkspaceOpen } = useUIStore();

  useEffect(() => {
    try {
      const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!completed) {
        setIsOpen(true);
      }
    } catch {
      // Fallback
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {}
    setIsOpen(false);
  };

  const handleFinishAndCreateProject = () => {
    handleDismiss();
    setCreateWorkspaceOpen(true);
  };

  const steps: StepData[] = [
    {
      eyebrow: 'Workspace Architecture',
      headline: 'Start with a project',
      body: 'Your code, context, decisions, and progress stay together in one workspace.',
      visual: (
        <div className="w-full h-48 rounded-xl surface-well p-4 flex flex-col justify-between font-mono text-xs border border-border shadow-inner">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-text-muted">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-accent" />
              <span className="text-text-primary font-medium tracking-tight text-sm">~/projects/core-engine</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-panel border border-border text-text-secondary">main</span>
              <span className="text-accent flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                clean
              </span>
            </div>
          </div>
          <div className="space-y-2 py-2 font-sans">
            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-panel/50 border border-border/40 text-text-secondary">
              <span className="flex items-center gap-2 font-mono"><FileCode2 className="w-3.5 h-3.5 text-text-muted" /> src/runtime/engine.rs</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">Modified</span>
            </div>
            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-panel/50 border border-border/40 text-text-secondary">
              <span className="flex items-center gap-2 font-mono"><FileCode2 className="w-3.5 h-3.5 text-text-muted" /> src/services/auth.ts</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">Tracked</span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> Scope: Strictly Isolated</span>
            <span className="text-text-secondary font-mono font-medium">2 Active Sessions</span>
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Universal CLI Engine Integration',
      headline: 'Bring your agents together',
      body: 'Launch and orchestrate any CLI assistant — Antigravity, Claude, Codex, OpenCode, and 14+ other engines in one cockpit.',
      visual: (
        <div className="w-full h-48 rounded-xl surface-well p-3.5 flex flex-col justify-between text-xs border border-border">
          <div className="grid grid-cols-3 gap-2.5 h-full">
            <div className="p-3 rounded-xl surface-selectable border border-border hover:border-accent/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-bold">Engine</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
              </div>
              <div>
                <p className="font-bold text-text-primary text-xs">Antigravity CLI</p>
                <p className="text-[10px] text-text-muted mt-0.5">High-speed reasoning</p>
              </div>
            </div>
            <div className="p-3 rounded-xl surface-selectable border border-border hover:border-accent/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">Engine</span>
                <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]"></span>
              </div>
              <div>
                <p className="font-bold text-text-primary text-xs">Claude Code</p>
                <p className="text-[10px] text-text-muted mt-0.5">Architecture & review</p>
              </div>
            </div>
            <div className="p-3 rounded-xl surface-selectable border border-border hover:border-accent/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">Engine</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></span>
              </div>
              <div>
                <p className="font-bold text-text-primary text-xs">Codex & More</p>
                <p className="text-[10px] text-text-muted mt-0.5">18 provider adapters</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Deterministic Continuity',
      headline: 'Keep the thread',
      body: "Orbit carries project context between sessions, agents, and handoffs so work doesn't start over.",
      visual: (
        <div className="w-full h-48 rounded-xl surface-well p-4 flex flex-col justify-between font-mono text-xs border border-border">
          <div className="flex items-center justify-between text-xs text-text-muted border-b border-border/60 pb-2.5">
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-accent" /> Handoff Envelope</span>
            <span className="text-text-primary font-semibold">Antigravity ➔ Claude</span>
          </div>
          <div className="space-y-2 text-xs text-text-secondary font-sans py-1">
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Confirmed decisions synthesized</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Active file touchpoints indexed</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Mandatory ingestion protocol attached</p>
          </div>
          <div className="pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-text-muted font-mono">
            <span>Status: Verified</span>
            <span className="text-accent font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Ready for Ingestion
            </span>
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Remote Orchestration',
      headline: 'Stay connected',
      body: 'Keep Orbit running on your desktop and use your phone when you need to step in.',
      visual: (
        <div className="w-full h-48 rounded-xl surface-well p-4 flex items-center justify-around text-xs border border-border">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-panel border border-border-hover flex items-center justify-center text-accent shadow-sm">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-xs">Desktop Runtime</p>
              <p className="text-[11px] text-text-muted">Authoritative Brain</p>
            </div>
          </div>
          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] font-mono text-accent uppercase tracking-wider mb-2 font-bold">Encrypted Relay</span>
            <div className="w-24 h-[1px] bg-border-hover relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping absolute"></span>
              <span className="w-2 h-2 rounded-full bg-accent absolute"></span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-panel border border-border-hover flex items-center justify-center text-accent shadow-sm">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-xs">Orbit Mobile</p>
              <p className="text-[11px] text-text-muted">Remote Control</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  if (!isOpen) return null;

  const current = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const stepNumber = `0${currentStep + 1} / 0${steps.length}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      title="Welcome to Orbit"
      subtitle={stepNumber}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 font-sans select-none pt-1">
        {/* Visual Presentation Canvas */}
        <div className="w-full">
          {current.visual}
        </div>

        {/* Narrative Step Content */}
        <div className="pt-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-accent font-bold">
            {current.eyebrow}
          </span>
          <h2 className="text-lg font-bold text-text-primary tracking-tight mt-0.5 mb-1.5 font-sans">
            {current.headline}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed font-sans">
            {current.body}
          </p>
        </div>

        {/* Action Controls & Navigation Footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-border/70 mt-1">
          <button
            onClick={handleDismiss}
            className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-panel-hover"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-2.5">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                className="btn-base px-3.5 py-2 rounded-xl text-xs flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {isLast ? (
              <button
                onClick={handleFinishAndCreateProject}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 shadow-md shadow-accent/25 transition-all cursor-pointer"
              >
                Enter Orbit <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
                className="btn-base flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
