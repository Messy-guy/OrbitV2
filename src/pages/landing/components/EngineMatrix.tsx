import React, { useState } from 'react';
import { EngineItem } from '../types';

export const ENGINES_DATA: EngineItem[] = [
  {
    id: 'antigravity',
    name: 'Antigravity (AGY)',
    provider: 'Google DeepMind',
    tag: 'TDD & Agentic Core',
    badge: 'Native PTY Worker',
    color: '#34d399',
    description: 'Deep paired programming assistant with autonomous slash commands, skill integration, subagent spawning, and reactive TDD cycles.',
    features: ['Direct alacritty_terminal snapshot', 'Native subagent channels', 'TDD Red-Green-Refactor loop', 'Custom skill runtime'],
    operationalModes: ['Plan', 'Code', 'Audit'],
    commandPreview: 'orbit run --engine agy --role implementer --mode tdd'
  },
  {
    id: 'claude',
    name: 'Claude Code',
    provider: 'Anthropic',
    tag: 'Autonomous Terminal',
    badge: 'Seamless Relay',
    color: '#f97316',
    description: 'Terminal-first coding agent capable of multi-file editing, git management, and complex repository refactors directly in your shell.',
    features: ['Streamed diff inspection', 'Tool approval notifications', 'Token usage tracking', 'Handoff checkpointing'],
    operationalModes: ['Plan', 'Code'],
    commandPreview: 'orbit run --engine claude --budget 50k --auto-approve'
  },
  {
    id: 'codex',
    name: 'Codex / OpenCode',
    provider: 'Open Ecosystem',
    tag: 'Universal LLM Shell',
    badge: 'Zero Overhead',
    color: '#60a5fa',
    description: 'Plug in any OpenAI-compatible, Ollama, or local model endpoint without changing your terminal bindings or keyboard habits.',
    features: ['Local-only air-gapped inference', 'Universal prompt templates', 'Direct bash piping', 'Full ANSI color fidelity'],
    operationalModes: ['Code', 'Audit'],
    commandPreview: 'orbit run --engine opencode --local --model qwen2.5-coder'
  },
  {
    id: 'custom_shell',
    name: 'Native Shell & Custom PTY',
    provider: 'POSIX / Linux / macOS',
    tag: 'Raw System Control',
    badge: 'Deterministic',
    color: '#a78bfa',
    description: 'Run pure zsh, bash, or fish sessions with full Orbit checkpointing, Git dirty-tree recording, and secret redaction enabled.',
    features: ['Zero agent overhead', 'Instant dirty-state diffs', 'Automatic secrets redaction', 'Cross-session handoffs'],
    operationalModes: ['Plan', 'Code', 'Audit'],
    commandPreview: 'orbit run --shell /bin/zsh --watch-git'
  }
];

export const EngineMatrix: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('antigravity');
  const activeEngine = ENGINES_DATA.find((e) => e.id === selectedId) || ENGINES_DATA[0];

  return (
    <section id="engines" className="relative w-full max-w-7xl mx-auto px-6 py-20 z-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4 uppercase tracking-widest">
          Heterogeneous Agent Mesh
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          One Command Center. Any Engine.
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-light">
          Orbit doesn’t force you into one AI provider or proprietary walled garden. Seamlessly run, orchestrate, and swap between multiple agents in persistent native sessions.
        </p>
      </div>

      {/* Engine Grid / Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Engine List Selector */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {ENGINES_DATA.map((engine) => {
            const isSelected = engine.id === selectedId;
            return (
              <div
                key={engine.id}
                onClick={() => setSelectedId(engine.id)}
                className={`cursor-pointer rounded-xl p-4 transition-all border ${
                  isSelected
                    ? 'bg-white/[0.08] border-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.5)] translate-x-1'
                    : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white tracking-tight">{engine.name}</span>
                  <span 
                    className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ 
                      color: engine.color, 
                      backgroundColor: `${engine.color}15`, 
                      border: `1px solid ${engine.color}30` 
                    }}
                  >
                    {engine.badge}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{engine.provider}</span>
                  <span className="text-zinc-500 font-mono text-[11px]">{engine.tag}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Engine Details Panel */}
        <div className="lg:col-span-7 bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          {/* Top Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
            <div>
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1">{activeEngine.provider}</div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{activeEngine.name}</h3>
            </div>
            {/* Operational Modes Pill Group */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-zinc-500 mr-1">Modes:</span>
              {activeEngine.operationalModes.map((mode) => (
                <span 
                  key={mode}
                  className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10"
                >
                  {mode}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <p className="text-zinc-300 text-sm leading-relaxed my-6">
            {activeEngine.description}
          </p>

          {/* Feature Bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {activeEngine.features.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeEngine.color }} />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          {/* Terminal Command Simulation Box */}
          <div className="rounded-xl bg-black/60 border border-white/10 p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
            <div className="flex items-center justify-between text-zinc-500 text-[10px] mb-2 pb-2 border-b border-white/5">
              <span>ORBIT RUNTIME SHELL</span>
              <span>PTY ATTACHED</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">$</span>
              <span className="text-white">{activeEngine.commandPreview}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
