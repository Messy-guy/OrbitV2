import React from 'react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="relative w-full border-t border-white/[0.06] bg-[#050505] py-14 px-6 z-10 text-xs text-zinc-500 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Left: Brand info */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2 text-white font-semibold">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-black">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <span>Orbit Universal Runtime</span>
          </div>
          <span className="hidden sm:inline-block text-zinc-700">•</span>
          <p>© {new Date().getFullYear()} Orbit Project. MIT Licensed.</p>
        </div>

        {/* Center: System Status */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>DAEMON RUNTIME ONLINE (v0.1.72)</span>
        </div>

        {/* Right: Quick Links */}
        <div className="flex items-center gap-6">
          <a href="https://github.com/Messy-guy/OrbitV2" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            GitHub
          </a>
          <a href="#manifesto" className="hover:text-white transition-colors">
            Manifesto
          </a>
          <a href="#quickstart" className="hover:text-white transition-colors">
            Docs
          </a>
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            Top ↑
          </button>
        </div>
      </div>
    </footer>
  );
};
