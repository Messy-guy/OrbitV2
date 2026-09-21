import React from 'react';
import { BentoFeatureItem } from '../types';

export const BENTO_FEATURES: BentoFeatureItem[] = [
  {
    id: 'handoff',
    title: 'Deterministic Context Handoff',
    badge: 'Zero Re-Explanation',
    colSpan: 'lg:col-span-8',
    accent: '#34d399',
    description: 'Switch between agents without repeating yourself. Orbit packages task intent, architectural decisions, dirty Git diffs, and redacted secrets into a schema-versioned ContextPackage that target agents read instantly.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
    previewElement: (
      <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-zinc-400 space-y-1">
        <div className="flex items-center justify-between text-zinc-500">
          <span>handoff_record.json</span>
          <span className="text-emerald-400 font-semibold">100% Deterministic</span>
        </div>
        <p className="text-zinc-300">{'->'} Source: <span className="text-blue-400">architect (agy)</span></p>
        <p className="text-zinc-300">{'->'} Target: <span className="text-emerald-400">implementer (claude)</span></p>
        <p className="text-zinc-400">{'->'} Payloads: Git Diffs (3 files), Redacted Secrets (2 keys), Task Checkpoint</p>
      </div>
    )
  },
  {
    id: 'terminal',
    title: 'Rust alacritty_terminal Native Canvas',
    badge: 'Hardware Accelerated',
    colSpan: 'lg:col-span-4',
    accent: '#60a5fa',
    description: 'Direct PTY worker threads feed high-speed screen snapshots and dirty-row patches into a custom Canvas renderer. Zero lag, ultra-low memory.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    previewElement: (
      <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-zinc-400 flex items-center justify-between">
        <span>Framerate: <span className="text-emerald-400 font-bold">120 FPS</span></span>
        <span>Latency: <span className="text-emerald-400 font-bold">&lt; 2ms</span></span>
      </div>
    )
  },
  {
    id: 'spatial',
    title: 'Spatial Canvas Orchestrator',
    badge: 'Multi-Window Workflow',
    colSpan: 'lg:col-span-4',
    accent: '#a78bfa',
    description: 'Arrange multiple concurrent coding agents across visual workspaces. Organize your implementer, reviewer, and test runner in flexible grids or floating windows.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    )
  },
  {
    id: 'local_privacy',
    title: 'Local-First Sovereign Privacy',
    badge: 'Air-Gapped Ready',
    colSpan: 'lg:col-span-4',
    accent: '#f43f5e',
    description: 'Your codebase, session memory, and checkpoints reside entirely on your machine in local JSON files. Orbit never stores your tokens on a middleman server.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  },
  {
    id: 'mobile_relay',
    title: 'Live Mobile Companion Relay',
    badge: 'Remote Control',
    colSpan: 'lg:col-span-4',
    accent: '#fbbf24',
    description: 'One QR scan pairs your phone over local Wi-Fi. Monitor test runs while away from your desk, receive push notifications, and authorize sensitive tool executions.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    )
  }
];

export const BentoFeatures: React.FC = () => {
  return (
    <section id="features" className="relative w-full max-w-7xl mx-auto px-6 py-20 z-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono mb-4 uppercase tracking-widest">
          Engineered for Power Users
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          Everything You Need to Run Autonomous Agents
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed font-light">
          Orbit solves the real bottlenecks of multi-agent development: context fragmentation, dropped terminal states, proprietary lock-in, and lost architectural intent.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {BENTO_FEATURES.map((item) => (
          <div
            key={item.id}
            className={`card-inner rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-white/[0.08] backdrop-blur-xl relative overflow-hidden ${item.colSpan || 'lg:col-span-6'}`}
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10">
                  {item.icon}
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  {item.badge}
                </span>
              </div>

              {/* Title & Desc */}
              <h3 className="text-xl font-semibold text-white tracking-tight mb-2">
                {item.title}
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-light">
                {item.description}
              </p>
            </div>

            {/* Optional Interactive Preview */}
            {item.previewElement && (
              <div className="pt-4">
                {item.previewElement}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
