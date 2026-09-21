import React from 'react';
import { LandingNavbar } from './components/LandingNavbar';
import { HeroCarousel } from './components/HeroCarousel';
import { EngineMatrix } from './components/EngineMatrix';
import { BentoFeatures } from './components/BentoFeatures';
import { WorkflowSection } from './components/WorkflowSection';
import { QuickstartSection } from './components/QuickstartSection';
import { ManifestoSection } from './components/ManifestoSection';
import { LandingFooter } from './components/LandingFooter';

export const LandingStyles: React.FC = () => (
  <style dangerouslySetInnerHTML={{
    __html: `
      html {
        scroll-behavior: smooth;
      }

      .grid-bg {
        position: fixed;
        inset: 0;
        background-image: 
          linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(circle at 50% 0%, black 15%, transparent 85%);
        -webkit-mask-image: radial-gradient(circle at 50% 0%, black 15%, transparent 85%);
        pointer-events: none;
        z-index: 0;
      }

      .glow-bg {
        position: fixed;
        top: -15%;
        left: 50%;
        transform: translateX(-50%);
        width: 75vw;
        height: 55vh;
        background: radial-gradient(ellipse at center, rgba(120, 119, 198, 0.14) 0%, rgba(255, 255, 255, 0) 70%);
        filter: blur(90px);
        pointer-events: none;
        z-index: 0;
        animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      .card-inner {
        background: linear-gradient(145deg, rgba(25,25,25,0.9) 0%, rgba(10,10,10,0.9) 100%);
        box-shadow: 
          inset 0 1px 1px rgba(255,255,255,0.08),
          0 20px 40px -10px rgba(0,0,0,0.8);
        transition: border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease, transform 0.3s ease;
      }

      .card-inner::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1px;
        background: linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0));
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }

      .is-active .card-inner {
        background: linear-gradient(145deg, rgba(35,35,35,0.95) 0%, rgba(15,15,15,0.95) 100%);
        box-shadow: 
          inset 0 1px 1px rgba(255,255,255,0.2),
          0 30px 60px -15px rgba(0,0,0,0.9),
          0 0 40px -10px rgba(255,255,255,0.05);
      }
      
      .is-active .card-inner::before {
        background: linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.05));
      }

      @keyframes fadeUp {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      
      .animate-fade-up {
        animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .7; }
      }
    `
  }} />
);

export default function OrbitLanding() {
  return (
    <div 
      className="min-h-screen flex flex-col relative selection:bg-white/30 selection:text-white" 
      style={{ 
        backgroundColor: '#050505', 
        color: '#ededed', 
        fontFamily: "'Inter', sans-serif", 
        overflowX: 'hidden' 
      }}
    >
      <LandingStyles />
      <div className="grid-bg" />
      <div className="glow-bg" />

      {/* Fixed Navigation Bar */}
      <LandingNavbar />

      {/* Main Content Sections */}
      <main className="flex-grow flex flex-col items-center justify-start relative z-10 w-full">
        {/* Hero Section with 3D Arc Perspective Carousel */}
        <HeroCarousel />

        {/* Multi-Engine Compatibility Matrix */}
        <EngineMatrix />

        {/* Core Capabilities Bento Grid */}
        <BentoFeatures />

        {/* Interactive Context Handoff & Architecture Workflow */}
        <WorkflowSection />

        {/* Developer Installation & Quickstart */}
        <QuickstartSection />

        {/* Orbit Manifesto */}
        <ManifestoSection />
      </main>

      {/* Universal Footer */}
      <LandingFooter />
    </div>
  );
}
