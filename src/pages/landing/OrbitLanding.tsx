import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface OrbitSectionData {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  detailTitle: string;
  detailSub: string;
  detailBtn: string;
  accentClass: string;
  accentColor: string;
  clip?: string;
  still?: string;
  icon: React.ReactNode;
}

const SECTIONS: OrbitSectionData[] = [
  {
    id: 'cli',
    tag: 'Terminal Core',
    title: 'Orbit CLI',
    subtitle: 'The primary universal interface.',
    detailTitle: 'Orbit CLI',
    detailSub: 'Work naturally from your terminal, backed by a persistent universal runtime and daemon.',
    detailBtn: 'View CLI Docs',
    accentClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    accentColor: '#34d399',
    clip: '/orbit-scroll/dive_cli.mp4',
    still: '/orbit-scroll/still_cli.png',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
    )
  },
  {
    id: 'desktop',
    tag: 'Visual Workspace',
    title: 'Orbit Desktop',
    subtitle: 'Context-rich agent orchestrator.',
    detailTitle: 'Orbit Desktop',
    detailSub: 'Manage multiple concurrent sessions, live agent diffs, terminal splits, and skill graphs with zero loss of context.',
    detailBtn: 'Download Desktop',
    accentClass: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    accentColor: '#60a5fa',
    clip: '/orbit-scroll/dive_desktop.mp4',
    still: '/orbit-scroll/still_desktop.png',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    )
  },
  {
    id: 'mobile',
    tag: 'Remote Companion',
    title: 'Orbit Mobile',
    subtitle: 'Always-on portable relay.',
    detailTitle: 'Orbit Mobile',
    detailSub: 'Pair with desktop & CLI in one QR scan. Monitor background builds, approve tool actions, and receive notifications anywhere.',
    detailBtn: 'Get on Mobile',
    accentClass: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    accentColor: '#fb7185',
    clip: '/orbit-scroll/dive_mobile.mp4',
    still: '/orbit-scroll/still_mobile.png',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
    )
  }
];

export const OrbitLanding: React.FC = () => {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState<Record<number, boolean>>({});
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Total scroll distance = 300vh (100vh per section)
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScrollableHeight = containerRef.current.scrollHeight - window.innerHeight;
      if (totalScrollableHeight <= 0) return;

      const currentScroll = -rect.top;
      const rawProgress = Math.min(Math.max(currentScroll / totalScrollableHeight, 0), 1);
      setScrollProgress(rawProgress);

      const sectionIndex = Math.min(
        Math.floor(rawProgress * SECTIONS.length),
        SECTIONS.length - 1
      );
      setActiveSection(sectionIndex);

      // Scrub the active video if video is available
      const sectionProgress = (rawProgress * SECTIONS.length) - sectionIndex;
      const activeVideo = videoRefs.current[sectionIndex];
      if (activeVideo && activeVideo.duration) {
        // Coalesce seeks to prevent decoder choking
        if (!activeVideo.seeking) {
          activeVideo.currentTime = sectionProgress * activeVideo.duration;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (index: number) => {
    if (!containerRef.current) return;
    const targetScroll = (index / (SECTIONS.length - 1)) * (containerRef.current.scrollHeight - window.innerHeight);
    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
  };

  const currentData = SECTIONS[activeSection];

  return (
    <div 
      ref={containerRef}
      className="relative w-full text-zinc-100 font-sans selection:bg-white/30 selection:text-white"
      style={{ 
        backgroundColor: '#050505',
        minHeight: '400vh' // Generates scroll headroom for scrub engine
      }}
    >
      {/* Global CSS / Custom Background Elements */}
      <style>{`
        .orbit-grid {
          position: fixed;
          inset: 0;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), 
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at 50% 20%, black 15%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at 50% 20%, black 15%, transparent 80%);
          pointer-events: none;
          z-index: 1;
        }
        .orbit-glow {
          position: fixed;
          top: -15%;
          left: 50%;
          transform: translateX(-50%);
          width: 80vw;
          height: 60vh;
          background: radial-gradient(ellipse at center, rgba(99, 102, 241, 0.12) 0%, rgba(255, 255, 255, 0) 70%);
          filter: blur(100px);
          pointer-events: none;
          z-index: 1;
        }
        .hud-card {
          background: linear-gradient(135deg, rgba(24, 24, 27, 0.8) 0%, rgba(9, 9, 11, 0.9) 100%);
          box-shadow: 0 20px 50px -10px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(16px);
        }
      `}</style>

      <div className="orbit-grid" />
      <div className="orbit-glow" />

      {/* FIXED VIEWPORT CINEMATIC STAGE */}
      <div className="fixed inset-0 w-full h-full flex flex-col justify-between pointer-events-none z-10 overflow-hidden">
        
        {/* TOP NAVIGATION BAR */}
        <header className="w-full flex items-center justify-between px-6 py-6 sm:px-12 max-w-7xl mx-auto pointer-events-auto z-30">
          <div className="flex items-center gap-3 font-semibold text-lg tracking-tight text-white cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                <path d="M2 12h20"></path>
              </svg>
            </div>
            <span>Orbit</span>
            <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-zinc-400">
              Universal Runtime
            </span>
          </div>

          {/* Section Step Indicators */}
          <nav className="hidden md:flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-full backdrop-blur-md">
            {SECTIONS.map((sec, idx) => (
              <button
                key={sec.id}
                onClick={() => scrollToSection(idx)}
                className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${
                  activeSection === idx 
                    ? 'bg-white text-black shadow' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {sec.title}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/Messy-guy/OrbitV2" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <button className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-5 py-2 rounded-full font-medium text-xs transition-all backdrop-blur-sm">
              Launch App
            </button>
          </div>
        </header>

        {/* 3D SCENIC FLIGHT LAYER / CINEMATIC VIDEO SCRUB STAGE */}
        <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          {SECTIONS.map((section, idx) => {
            const isActive = activeSection === idx;
            return (
              <div
                key={section.id}
                className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
                style={{ opacity: isActive ? 1 : 0 }}
              >
                {/* 1. Optional High-Definition Video Scrub Layer */}
                <video
                  ref={(el) => (videoRefs.current[idx] = el)}
                  src={section.clip}
                  preload="auto"
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onLoadedData={() => setVideoLoaded(prev => ({ ...prev, [idx]: true }))}
                  onError={() => setVideoLoaded(prev => ({ ...prev, [idx]: false }))}
                  style={{ display: videoLoaded[idx] ? 'block' : 'none' }}
                />

                {/* 2. Fallback Procedural 3D Hologram Simulator (Renders when clip is still generating) */}
                {!videoLoaded[idx] && (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div 
                      className="w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] rounded-full border border-white/10 flex items-center justify-center relative"
                      style={{
                        transform: `scale(${1 + (scrollProgress % 0.33) * 1.5}) rotate(${scrollProgress * 90}deg)`,
                        transition: 'transform 0.1s linear',
                        boxShadow: `0 0 100px ${section.accentColor}15`
                      }}
                    >
                      <div 
                        className="w-3/4 h-3/4 rounded-full border border-dashed border-white/20 flex items-center justify-center"
                        style={{ transform: `rotate(-${scrollProgress * 180}deg)` }}
                      >
                        <div className="p-8 rounded-3xl bg-zinc-900/40 backdrop-blur-xl border border-white/10 text-center flex flex-col items-center gap-3">
                          <div className={`p-4 rounded-2xl border ${section.accentClass}`}>
                            {section.icon}
                          </div>
                          <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{section.tag}</span>
                          <h2 className="text-xl font-bold tracking-tight text-white">{section.title}</h2>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* HERO HUD / FLOATING ACTIVE SECTION CARD */}
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 sm:pb-16 flex flex-col items-center pointer-events-auto z-30">
          <div className="hud-card w-full rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 ${currentData.accentClass}`}>
                {currentData.icon}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
                    {currentData.tag}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">{currentData.detailTitle}</h3>
                <p className="text-zinc-400 text-sm max-w-xl mt-1 leading-relaxed">{currentData.detailSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button 
                className="bg-white hover:bg-zinc-200 text-black px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg whitespace-nowrap"
              >
                {currentData.detailBtn}
              </button>
            </div>
          </div>

          {/* FLIGHT CONTROLS & SCROLL PROGRESS DOCK */}
          <div className="mt-4 flex items-center gap-6 text-zinc-500 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentData.accentColor }} />
              <span>STATION {activeSection + 1} OF {SECTIONS.length}</span>
            </div>
            <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-100"
                style={{ 
                  width: `${scrollProgress * 100}%`,
                  backgroundColor: currentData.accentColor 
                }}
              />
            </div>
            <span>SCROLL TO FLY</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrbitLanding;
