import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardItem } from '../types';

export const CARDS_DATA: CardItem[] = [
  {
    id: 'cli',
    accentClass: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    accentColor: '#34d399',
    title: 'Orbit CLI',
    subtitle: 'The primary interface.',
    tag: 'Terminal',
    detailTitle: 'Orbit CLI',
    detailSub: 'The primary interface. Work naturally from your terminal, backed by a persistent universal runtime.',
    detailBtn: 'View CLI Docs',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  },
  {
    id: 'desktop',
    accentClass: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    accentColor: '#60a5fa',
    title: 'Orbit Desktop',
    subtitle: 'Visual context management.',
    tag: 'Workspace',
    detailTitle: 'Orbit Desktop',
    detailSub: 'A rich visual workspace. Manage sessions, agent activity, and files without losing context.',
    detailBtn: 'Download Desktop',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    )
  },
  {
    id: 'app',
    accentClass: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    accentColor: '#fb7185',
    title: 'Orbit Mobile',
    subtitle: 'Remote session monitor.',
    tag: 'Companion',
    detailTitle: 'Orbit Mobile',
    detailSub: 'Your companion interface. Stay connected to active sessions and control running work remotely.',
    detailBtn: 'Get on Mobile',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    )
  }
];

export const HeroCarousel: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(1);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [displayIndex, setDisplayIndex] = useState(1);
  const [detailOpacity, setDetailOpacity] = useState(1);
  const sceneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; isDragging: boolean }>({ startX: 0, isDragging: false });

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setDetailOpacity(0);
    const timer = setTimeout(() => {
      setDisplayIndex(activeIndex);
      setDetailOpacity(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % CARDS_DATA.length);
  }, []);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + CARDS_DATA.length) % CARDS_DATA.length);
  }, []);

  const jumpTo = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Wheel / Trackpad listener
  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;

    let wheelThrottled = false;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelThrottled) return;

      const moveDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(moveDelta) > 10) {
        wheelThrottled = true;
        if (moveDelta > 0) handleNext();
        else handlePrev();

        setTimeout(() => {
          wheelThrottled = false;
        }, 600);
      }
    };

    sceneEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      sceneEl.removeEventListener('wheel', handleWheel);
    };
  }, [handleNext, handlePrev]);

  // Pointer & Touch handlers
  const onPointerDown = (e: React.PointerEvent | React.TouchEvent) => {
    dragRef.current.isDragging = true;
    if ('clientX' in e) {
      dragRef.current.startX = e.clientX;
    } else if (e.touches && e.touches[0]) {
      dragRef.current.startX = e.touches[0].clientX;
    }
  };

  const onPointerUp = (e: React.PointerEvent | React.TouchEvent) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;

    let clientX = 0;
    if ('clientX' in e) {
      clientX = e.clientX;
    } else if ('changedTouches' in e && e.changedTouches && e.changedTouches[0]) {
      clientX = e.changedTouches[0].clientX;
    }

    const diff = dragRef.current.startX - clientX;
    if (diff > 40) handleNext();
    else if (diff < -40) handlePrev();
  };

  const onPointerLeave = () => {
    dragRef.current.isDragging = false;
  };

  // 3D Geometry
  const isMobile = windowWidth <= 640;
  const xOffset = isMobile ? 55 : 35; // vw
  const zOffset = isMobile ? -80 : -120; // px
  const yOffset = isMobile ? 20 : 40; // px
  const rotation = isMobile ? 4 : 8; // deg
  const sideScale = isMobile ? 0.8 : 0.85;

  const currentCard = CARDS_DATA[displayIndex];

  return (
    <section className="relative w-full flex flex-col items-center pt-24 sm:pt-32 pb-16 z-10">
      {/* Hero Header */}
      <div className="text-center px-4 max-w-4xl mx-auto flex flex-col items-center gap-6 mb-4 animate-fade-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-medium text-zinc-300 shadow-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          Orbit Runtime v1.0
        </div>
        
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500 leading-[1.1]">
          ONE CLI.<br />ANY ENGINE.<br />
          <span className="text-white">YOUR WORKFLOW.</span>
        </h1>
        
        <p className="text-zinc-400 text-base sm:text-lg max-w-2xl leading-relaxed mt-2 font-light">
          A universal runtime for AI coding agents. Maintain one persistent workspace, context, and workflow across Claude, Codex, Antigravity, and any interface.
        </p>
      </div>

      {/* 3D Arc Card Carousel */}
      <div className="w-full relative animate-fade-up" style={{ animationDelay: '0.15s' }}>
        <div 
          ref={sceneRef}
          className="relative w-full h-[280px] sm:h-[380px] mt-6 z-10 select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onTouchStart={onPointerDown}
          onTouchEnd={onPointerUp}
        >
          {CARDS_DATA.map((card, index) => {
            let offset = index - activeIndex;
            if (offset === -2) offset = 1;
            if (offset === 2) offset = -1;

            let transform = '';
            let opacity = 1;
            let filter = '';
            let zIndex = 10;
            const isActive = offset === 0;

            if (offset === 0) {
              transform = 'translate(-50%, -50%) translateZ(40px) rotateZ(0deg) scale(1)';
              opacity = 1;
              filter = 'brightness(1) blur(0px)';
              zIndex = 30;
            } else if (offset === -1) {
              transform = `translate(calc(-50% - ${xOffset}vw), calc(-50% + ${yOffset}px)) translateZ(${zOffset}px) rotateZ(-${rotation}deg) scale(${sideScale})`;
              opacity = 0.6;
              filter = 'brightness(0.6) blur(2px)';
              zIndex = 20;
            } else if (offset === 1) {
              transform = `translate(calc(-50% + ${xOffset}vw), calc(-50% + ${yOffset}px)) translateZ(${zOffset}px) rotateZ(${rotation}deg) scale(${sideScale})`;
              opacity = 0.6;
              filter = 'brightness(0.6) blur(2px)';
              zIndex = 20;
            }

            return (
              <div 
                key={card.id}
                onClick={() => jumpTo(index)}
                className={`absolute top-1/2 left-1/2 w-[280px] sm:w-[360px] h-[180px] sm:h-[220px] rounded-2xl cursor-pointer ${isActive ? 'is-active' : ''}`}
                style={{
                  transform,
                  opacity,
                  filter,
                  zIndex,
                  willChange: 'transform, opacity, filter',
                  transition: 'transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.7s ease, filter 0.7s ease'
                }}
              >
                <div className="card-inner w-full h-full rounded-2xl backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden relative group">
                  <div className="flex justify-between items-start z-10">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${card.accentClass}`}>
                      {card.icon}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{card.tag}</span>
                  </div>
                  <div className="z-10 mt-4">
                    <h3 className="text-white font-semibold text-2xl tracking-tight">{card.title}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{card.subtitle}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Nav Dots */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
          {CARDS_DATA.map((_, index) => (
            <button 
              key={index}
              onClick={() => jumpTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${index === activeIndex ? 'bg-white' : 'bg-zinc-700 hover:bg-zinc-500'}`}
            />
          ))}
        </div>
      </div>

      {/* Dynamic Detail Card Below Carousel */}
      <div 
        className="mt-14 text-center flex flex-col items-center px-4 max-w-xl mx-auto h-[140px] animate-fade-up" 
        style={{
          animationDelay: '0.25s',
          opacity: detailOpacity,
          transform: `translateY(${detailOpacity === 1 ? '0' : '10px'})`,
          transition: 'opacity 0.3s ease, transform 0.3s ease'
        }}
      >
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2.5 tracking-tight">
          {currentCard.detailTitle}
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-5">
          {currentCard.detailSub}
        </p>
        <button 
          onClick={() => {
            const el = document.getElementById('features');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white text-black px-6 py-2 rounded-full font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
        >
          {currentCard.detailBtn}
        </button>
      </div>
    </section>
  );
};
