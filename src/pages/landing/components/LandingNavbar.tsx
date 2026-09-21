import React from 'react';

export const LandingNavbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 w-full z-50 px-6 py-4 backdrop-blur-xl bg-[#050505]/70 border-b border-white/[0.06] transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <a href="#" className="flex items-center gap-3 font-semibold text-lg tracking-tight text-white hover:opacity-85 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black shadow-[0_0_12px_rgba(255,255,255,0.4)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span className="font-semibold tracking-tight text-white text-base">Orbit</span>
          <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 border border-white/10">
            Runtime v1.0
          </span>
        </a>

        {/* Center Links */}
        <div className="hidden md:flex items-center gap-7 text-zinc-400 font-medium text-xs tracking-wide">
          <a href="#engines" className="hover:text-white transition-colors">Engines</a>
          <a href="#features" className="hover:text-white transition-colors">Superpowers</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          <a href="#quickstart" className="hover:text-white transition-colors">Install</a>
          <a href="#manifesto" className="hover:text-white transition-colors">Manifesto</a>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a 
            href="https://github.com/Messy-guy/OrbitV2" 
            target="_blank" 
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
          <button 
            onClick={() => {
              // Smooth scroll to quickstart or trigger app entry
              const el = document.getElementById('quickstart');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-1.5 rounded-full font-medium text-xs transition-all backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.12)]"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
};
