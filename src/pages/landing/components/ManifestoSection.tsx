import React from 'react';

export const ManifestoSection: React.FC = () => {
  return (
    <section id="manifesto" className="relative w-full max-w-5xl mx-auto px-6 py-20 z-10">
      <div className="card-inner rounded-3xl p-8 sm:p-14 border border-white/10 backdrop-blur-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-72 h-72 bg-violet-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">The Orbit Manifesto</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-6 leading-snug">
          "Software agents belong to the developer, not the vendor's browser tab."
        </h2>

        <div className="space-y-4 text-zinc-300 text-sm sm:text-base leading-relaxed font-light">
          <p>
            The industry is attempting to lock coding agents inside isolated cloud SaaS web containers. When you close the tab or cancel a subscription, your agent's historical context, terminal memory, and local workflow vanish.
          </p>
          <p>
            Orbit is built on a fundamentally different thesis: <strong className="text-white font-medium">Local Sovereignty</strong>. Your codebase is your most valuable asset. The tools that modify it must run locally on your hardware, respect your filesystem, and integrate naturally into your existing shell and editor workflows.
          </p>
          <p>
            Whether an engineer prefers Antigravity, Claude Code, Codex, or local open-source weights, Orbit acts as the unifying nervous system — delivering persistent checkpoints, deterministic handoffs, and instant synchronization between terminal, desktop, and mobile.
          </p>
        </div>

        {/* Core Principles Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t border-white/[0.08]">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <h4 className="text-white text-sm font-semibold mb-1">Zero Token Markups</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">Bring your own credentials or run locally. We never charge a middleman fee on intelligence.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <h4 className="text-white text-sm font-semibold mb-1">Local State Files</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">Plain, schema-versioned JSON state saved directly on your disk for total auditability.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <h4 className="text-white text-sm font-semibold mb-1">Unbroken Continuity</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">Swap providers mid-task without starting over. Seamlessly chain agents together.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
