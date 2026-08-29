import React, { useRef } from 'react';
import { Agent } from '../../types/orbit';

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface CanvasMinimapProps {
  agents: Agent[];
  windowBounds: Record<string, WindowBounds>;
  pan: { x: number; y: number };
  zoom: number;
  containerSize: { width: number; height: number };
  onNavigate: (pan: { x: number; y: number }) => void;
}

export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  agents,
  windowBounds,
  pan,
  zoom,
  containerSize,
  onNavigate,
}) => {
  const minimapRef = useRef<HTMLDivElement>(null);

  if (agents.length === 0) return null;

  // Fixed size of the minimap widget (px)
  const MAP_W = 160;
  const MAP_H = 100;

  // 1. Calculate the bounding box of the entire virtual canvas (all windows + current viewport)
  const viewportWorldLeft = -pan.x / zoom;
  const viewportWorldTop = -pan.y / zoom;
  const viewportWorldRight = viewportWorldLeft + containerSize.width / zoom;
  const viewportWorldBottom = viewportWorldTop + containerSize.height / zoom;

  let minX = viewportWorldLeft;
  let maxX = viewportWorldRight;
  let minY = viewportWorldTop;
  let maxY = viewportWorldBottom;

  agents.forEach(agent => {
    const b = windowBounds[agent.id];
    if (b) {
      minX = Math.min(minX, b.x - 100);
      maxX = Math.max(maxX, b.x + b.width + 100);
      minY = Math.min(minY, b.y - 100);
      maxY = Math.max(maxY, b.y + b.height + 100);
    }
  });

  const worldW = Math.max(1200, maxX - minX);
  const worldH = Math.max(800, maxY - minY);

  // Map world coordinates to minimap pixel space
  const scaleX = MAP_W / worldW;
  const scaleY = MAP_H / worldH;
  const mapScale = Math.min(scaleX, scaleY);

  const offsetX = (MAP_W - worldW * mapScale) / 2;
  const offsetY = (MAP_H - worldH * mapScale) / 2;

  const worldToMinimap = (wx: number, wy: number) => ({
    x: offsetX + (wx - minX) * mapScale,
    y: offsetY + (wy - minY) * mapScale,
  });

  // Current camera viewport rectangle on minimap
  const vpPos = worldToMinimap(viewportWorldLeft, viewportWorldTop);
  const vpW = (containerSize.width / zoom) * mapScale;
  const vpH = (containerSize.height / zoom) * mapScale;

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap pixel to world coordinates
    const targetWorldX = minX + (clickX - offsetX) / mapScale;
    const targetWorldY = minY + (clickY - offsetY) / mapScale;

    // Center viewport at this world coordinate
    const targetPanX = -targetWorldX * zoom + containerSize.width / 2;
    const targetPanY = -targetWorldY * zoom + containerSize.height / 2;

    onNavigate({ x: targetPanX, y: targetPanY });
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'antigravity':
        return '#00e5ff';
      case 'claude':
        return '#f59e0b';
      case 'codex':
        return '#10b981';
      case 'opencode':
        return '#a855f7';
      case 'kilocode':
        return '#f97316';
      case 'freebuff':
        return '#10b981';
      case 'cline':
        return '#3b82f6';
      case 'copilot':
        return '#8b5cf6';
      case 'goose':
        return '#eab308';
      case 'kiro':
        return '#f43f5e';
      case 'qwen':
        return '#a855f7';
      case 'mimo':
        return '#10b981';
      case 'muse':
        return '#3b82f6';
      case 'continue':
        return '#14b8a6';
      case 'aider':
        return '#22c55e';
      case 'vibe':
        return '#fb923c';
      case 'qoder':
        return '#6366f1';
      default:
        return '#38bdf8';
    }
  };

  return (
    <div
      ref={minimapRef}
      onClick={handleMinimapClick}
      className="absolute bottom-4 right-4 z-40 bg-[#121318]/90 backdrop-blur-md border border-[#22242c] rounded-xl shadow-2xl p-1.5 cursor-crosshair overflow-hidden select-none hover:border-[#383b48] transition-colors"
      style={{ width: MAP_W, height: MAP_H }}
      title="Click or drag to navigate infinite canvas"
    >
      {/* Minimap background grid */}
      <div
        className="w-full h-full relative rounded-lg bg-[#0a0b0e] border border-[#1a1b22] overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
        }}
      >
        {/* Render each agent window as a mini node */}
        {agents.map(agent => {
          const b = windowBounds[agent.id];
          if (!b) return null;
          const pos = worldToMinimap(b.x, b.y);
          const w = Math.max(6, b.width * mapScale);
          const h = Math.max(4, b.height * mapScale);
          const color = getProviderColor(agent.provider);

          return (
            <div
              key={agent.id}
              className="absolute rounded-[2px] transition-all"
              style={{
                left: pos.x,
                top: pos.y,
                width: w,
                height: h,
                backgroundColor: `${color}33`,
                border: `1px solid ${color}`,
                boxShadow: `0 0 4px ${color}40`,
              }}
            />
          );
        })}

        {/* Viewport Camera Frame */}
        <div
          className="absolute rounded border border-white/40 bg-white/10 pointer-events-none transition-all duration-75 shadow-[0_0_8px_rgba(255,255,255,0.08)]"
          style={{
            left: Math.max(0, vpPos.x),
            top: Math.max(0, vpPos.y),
            width: Math.min(MAP_W, Math.max(12, vpW)),
            height: Math.min(MAP_H, Math.max(8, vpH)),
          }}
        />
      </div>
    </div>
  );
};
