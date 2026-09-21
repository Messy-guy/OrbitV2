import React, { useState } from 'react';
import { ArchitectureStep } from '../types';

export const WORKFLOW_STEPS: ArchitectureStep[] = [
  {
    step: '01',
    title: 'Architect Plans & Explores',
    role: 'Role: Architect (Antigravity)',
    tagColor: '#34d399',
    description: 'The architect agent explores the codebase in plan-only mode, formulates the technical implementation document, and records architectural decisions.',
    terminalSnippet: `$ orbit agent spawn --role architect --engine agy\n[OrbitDaemon] Initializing architect workspace session (session-88f2)\n[Architect] Analyzing codebase dependencies and AST...\n[Architect] Plan formulated. Created checkpoint (ckpt-01: 'auth-migration')`
  },
  {
    step: '02',
    title: 'Orbit Packages State & Redacts Secrets',
    role: 'Orbit Universal Runtime',
    tagColor: '#60a5fa',
    description: 'Orbit deterministically captures modified files, dirty git diffs, session goals, and redacts common API keys and tokens before handoff.',
    terminalSnippet: `$ orbit context package --checkpoint ckpt-01 --redact-secrets\n[ContextEngine] Redacting sensitive environment tokens (found 2 keys)\n[ContextEngine] Git status: 4 modified, 1 untracked\n[ContextEngine] Generated ContextPackage v1 (estimated 1,240 tokens)`
  },
  {
    step: '03',
    title: 'Implementer Agent Executes TDD',
    role: 'Role: Implementer (Claude Code / OpenCode)',
    tagColor: '#a78bfa',
    description: 'The implementer agent loads the package in code mode. No time wasted explaining the task or prior history. Tests are written and executed autonomously.',
    terminalSnippet: `$ orbit handoff --source session-88f2 --target claude-code --mode tdd\n[ClaudeCode] Ingested ContextPackage v1.\n[ClaudeCode] Writing failing test in auth.spec.ts...\n[ClaudeCode] Test PASSED (14 passing, 0 failing). Running git commit.`
  },
  {
    step: '04',
    title: 'Mobile Push & Live Action Approval',
    role: 'Orbit Mobile Relay',
    tagColor: '#fb7185',
    description: 'As long-running builds finish, notifications push directly to your phone. Review live diffs and approve production deployments on the go.',
    terminalSnippet: `[DesktopRelay] Broadcasting checkpoint state to paired devices (1 phone)\n[OrbitMobile] Notification: "ClaudeCode requested deployment approval"\n[OrbitMobile] User Leo tapped APPROVE from iOS companion.\n[OrbitDaemon] Action Authorized. Deploying release v0.1.72.`
  }
];

export const WorkflowSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const currentStep = WORKFLOW_STEPS[activeStep];

  return (
    <section id="architecture" className="relative w-full max-w-7xl mx-auto px-6 py-20 z-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono mb-4 uppercase tracking-widest">
          Deterministic Context Flow
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          How Orbit Coordinates Heterogeneous Agents
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-light">
          Watch how Orbit turns disjointed CLI utilities into an orchestrated, auditable software delivery pipeline without losing context.
        </p>
      </div>

      {/* Step Selector & Terminal Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Step Buttons */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3">
          {WORKFLOW_STEPS.map((item, idx) => {
            const isActive = idx === activeStep;
            return (
              <div
                key={item.step}
                onClick={() => setActiveStep(idx)}
                className={`cursor-pointer rounded-xl p-4 transition-all border text-left ${
                  isActive
                    ? 'bg-white/[0.08] border-white/25 shadow-lg'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span 
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                    style={{ 
                      color: item.tagColor, 
                      backgroundColor: `${item.tagColor}15`,
                      border: `1px solid ${item.tagColor}30`
                    }}
                  >
                    {item.step}
                  </span>
                  <span className="text-sm font-semibold text-white tracking-tight">{item.title}</span>
                </div>
                <p className="text-xs text-zinc-400 pl-8 leading-relaxed font-light">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Live Terminal Representation */}
        <div className="lg:col-span-7 bg-black/80 border border-white/10 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-xl shadow-2xl overflow-hidden relative font-mono text-xs">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 text-zinc-400 text-[11px]">orbit-session — stage {currentStep.step}</span>
            </div>
            <span 
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{
                color: currentStep.tagColor,
                borderColor: `${currentStep.tagColor}30`,
                backgroundColor: `${currentStep.tagColor}10`
              }}
            >
              {currentStep.role}
            </span>
          </div>

          {/* Terminal Body */}
          <div className="flex-1 text-zinc-300 leading-relaxed whitespace-pre-line overflow-x-auto py-2">
            {currentStep.terminalSnippet}
          </div>

          {/* Terminal Footer Indicator */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>DAEMON CONNECTED</span>
            </div>
            <span>STEP {activeStep + 1} OF {WORKFLOW_STEPS.length}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
