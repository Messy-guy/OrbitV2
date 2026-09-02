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
  Sparkles
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
        <div className="w-full h-44 rounded-xl surface-well p-4 flex flex-col justify-between font-mono text-xs border border-border">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-text-muted">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-3.5 h-3.5 text-accent" />
              <span className="text-text-primary font-medium tracking-tight">~/projects/core-engine</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-md bg-panel border border-border text-text-secondary">main</span>
              <span className="text-accent flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                clean
              </span>
            </div>
          </div>
          <div className="space-y-2 py-1.5 font-sans">
            <div className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-panel/40 border border-border/40 text-text-secondary">
              <span className="flex items-center gap-2 font-mono"><FileCode2 className="w-3 h-3 text-text-muted" /> src/runtime/engine.rs</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Modified</span>
            </div>
            <div className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-panel/40 border border-border/40 text-text-secondary">
              <span className="flex items-center gap-2 font-mono"><FileCode2 className="w-3 h-3 text-text-muted" /> src/services/auth.ts</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Tracked</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-text-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-accent" /> Scope: Strictly Isolated</span>
            <span className="text-text-secondary font-mono">2 Active Sessions</span>
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'Multi-Agent Roles',
      headline: 'Choose how the work gets done',
      body: 'Assign agents to roles that fit the task — architecture, implementation, review, or audit.',
      visual: (
        <div className="w-full h-44 rounded-xl surface-well p-3 flex flex-col justify-between text-xs border border-border">
          <div className="grid grid-cols-2 gap-3 h-full">
            <div className="p-3 rounded-xl surface-selectable border border-border hover:border-accent/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Role: Architect</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
              </div>
              <div>
                <p className="font-bold text-text-primary text-xs">System Design</p>
                <p className="text-[10px] text-text-muted mt-0.5">Constraints & RFC generation</p>
              </div>
            </div>
            <div className="p-3 rounded-xl surface-selectable border border-border hover:border-accent/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Role: Implementer</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></span>
              </div>
              <div>
                <p className="font-bold text-text-primary text-xs">Code Construction</p>
                <p className="text-[10px] text-text-muted mt-0.5">Test-driven execution</p>
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
        <div className="w-full h-44 rounded-xl surface-well p-3.5 flex flex-col justify-between font-mono text-xs border border-border">
          <div className="flex items-center justify-between text-[11px] text-text-muted border-b border-border/60 pb-2">
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-accent" /> Handoff Protocol</span>
            <span className="text-text-primary font-semibold">Architect ➔ Implementer</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-text-secondary font-sans">
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Confirmed decisions synthesized</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Active file touchpoints indexed</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Mandatory ingestion protocol attached</p>
          </div>
          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-text-muted font-mono">
            <span>Status: Verified</span>
            <span className="text-accent font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3" /> Ready
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
        <div className="w-full h-44 rounded-xl surface-well p-4 flex items-center justify-around text-xs border border-border">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-panel border border-border-hover flex items-center justify-center text-accent shadow-sm">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-[11px]">Desktop Runtime</p>
              <p className="text-[10px] text-text-muted">Authoritative Brain</p>
            </div>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-[9px] font-mono text-accent uppercase tracking-wider mb-1.5 font-bold">Encrypted Relay</span>
            <div className="w-20 h-[1px] bg-border-hover relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping absolute"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-accent absolute"></span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-panel border border-border-hover flex items-center justify-center text-accent shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-[11px]">Orbit Mobile</p>
              <p className="text-[10px] text-text-muted">Remote Control</p>
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
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 font-sans select-none pt-1">
        {/* Visual Presentation Canvas */}
        <div className="w-full">
          {current.visual}
        </div>

        {/* Narrative Step Content */}
        <div className="pt-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-bold">
            {current.eyebrow}
          </span>
          <h2 className="text-base font-bold text-text-primary tracking-tight mt-0.5 mb-1.5 font-sans">
            {current.headline}
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed font-sans">
            {current.body}
          </p>
        </div>

        {/* Action Controls & Navigation Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/70 mt-1">
          <button
            onClick={handleDismiss}
            className="text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer py-1.5 px-2 rounded-lg hover:bg-panel-hover"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                className="btn-base px-3 py-1.5 rounded-xl text-xs flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {isLast ? (
              <button
                onClick={handleFinishAndCreateProject}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 shadow-md shadow-accent/25 transition-all cursor-pointer"
              >
                Enter Orbit <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
                className="btn-base flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
