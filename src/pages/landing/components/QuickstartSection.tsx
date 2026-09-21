import React, { useState } from 'react';

export const QuickstartSection: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'curl' | 'npm' | 'cargo' | 'brew'>('curl');
  const [copied, setCopied] = useState<boolean>(false);

  const snippets: Record<string, string> = {
    curl: 'curl -fsSL https://orbit.run/install.sh | bash',
    npm: 'npm install -g @orbit/cli && orbit init',
    cargo: 'cargo install orbit-runtime-cli',
    brew: 'brew install messy-guy/orbit/orbit'
  };

  const currentCommand = snippets[selectedTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="quickstart" className="relative w-full max-w-5xl mx-auto px-6 py-20 z-10">
      <div className="card-inner rounded-3xl p-8 sm:p-12 border border-white/10 backdrop-blur-2xl relative overflow-hidden text-center flex flex-col items-center">
        {/* Glow Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />

        <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 mb-4">
          Lightning Quickstart
        </span>

        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          Ready to Elevate Your Workflow?
        </h2>

        <p className="text-zinc-400 text-sm sm:text-base max-w-xl mb-8 font-light leading-relaxed">
          Install the Orbit runtime in under 10 seconds. Works seamlessly on Linux, macOS, and WSL with no root privileges required.
        </p>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-5">
          {(['curl', 'npm', 'cargo', 'brew'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-3.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                selectedTab === tab
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Copyable Terminal Command */}
        <div className="w-full max-w-2xl bg-black/70 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 font-mono text-xs sm:text-sm text-zinc-200 shadow-inner">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <span className="text-emerald-400 select-none">$</span>
            <span>{currentCommand}</span>
          </div>

          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs transition-all active:scale-95"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Post-install next steps */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 font-mono">
          <span>✓ Zero external dependencies</span>
          <span>✓ Instant update channel</span>
          <span>✓ Works with your existing keys</span>
        </div>
      </div>
    </section>
  );
};
