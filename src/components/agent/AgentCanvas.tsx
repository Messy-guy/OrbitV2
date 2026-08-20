import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, LayoutGrid, RotateCcw, Terminal, ZoomIn, ZoomOut, Maximize, Sparkles, Code2, Bookmark, Activity, GitBranch, FolderTree, X, Columns2, Columns3, Keyboard } from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { useSettingsStore } from '../../stores/settings.store';
import { AgentFloatingWindow } from './AgentFloatingWindow';
import { CanvasMinimap } from './CanvasMinimap';
import { AgentProvider } from '../../types/orbit';
import { clsx } from 'clsx';

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export const AgentCanvas: React.FC = () => {
  const { agents, addAgent } = useAgentStore();
  const { getActiveWorkspace, activeSpaceIdByProject, setActiveSpace, createSpace, deleteSpace } = useWorkspaceStore();
  const { toggleBottomPanel, activeBottomPanel, setShareContextOpen, setAddAgentOpen, maximizedAgentId } = useUIStore();
  const { checkpoints, currentContext } = useContextStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [topZIndex, setTopZIndex] = useState<number>(10);
  const [windowBounds, setWindowBounds] = useState<Record<string, WindowBounds>>({});
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Infinite Canvas Pan & Zoom Camera State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  });

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const activeWorkspace = getActiveWorkspace();
  const activeSpaceId = (activeWorkspace && activeSpaceIdByProject[activeWorkspace.id]) || activeWorkspace?.spaces?.[0]?.id || `space-${activeWorkspace?.id}-1`;

  // Filter agents that belong to current active Space/Tab (or default fallback)
  const visibleAgents = agents.filter(
    (a) => (a.spaceId || activeWorkspace?.spaces?.[0]?.id || 'default') === activeSpaceId || (!a.spaceId && activeWorkspace?.spaces?.[0]?.id === activeSpaceId)
  );

  // Track container dimensions on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute precise aligned layout for N agents
  const calculateSmartLayout = (agentList: typeof agents, containerW: number, containerH: number): Record<string, WindowBounds> => {
    const pad = 24;
    const gap = 16;
    const availW = Math.max(400, containerW - pad * 2);
    const availH = Math.max(300, containerH - pad * 2);
    const count = agentList.length;
    const layout: Record<string, WindowBounds> = {};

    if (count === 1) {
      // 1 Agent: Long full-height terminal, centered horizontally
      const w = Math.min(880, Math.floor(availW * 0.62));
      const fullH = availH;
      const x = Math.floor(pad + (availW - w) / 2);
      layout[agentList[0].id] = { x, y: pad, width: w, height: fullH, zIndex: 10 };
    } else if (count === 2) {
      // 2 Agents: 2 Long Full-Height Terminals Side-by-Side (50% / 50%)
      const halfW = Math.floor((availW - gap) / 2);
      const fullH = availH;
      layout[agentList[0].id] = { x: pad, y: pad, width: halfW, height: fullH, zIndex: 10 };
      layout[agentList[1].id] = { x: pad + halfW + gap, y: pad, width: halfW, height: fullH, zIndex: 11 };
    } else if (count === 3) {
      // 3 Agents: Master-Stack (1st long full-height on left, 2nd & 3rd stacked up/down on right)
      const halfW = Math.floor((availW - gap) / 2);
      const halfH = Math.floor((availH - gap) / 2);
      const fullH = availH;
      // 1st Agent (Master): Left 50% width, 100% full height
      layout[agentList[0].id] = { x: pad, y: pad, width: halfW, height: fullH, zIndex: 10 };
      // 2nd Agent: Top-right quadrant
      layout[agentList[1].id] = { x: pad + halfW + gap, y: pad, width: halfW, height: halfH, zIndex: 11 };
      // 3rd Agent: Bottom-right quadrant
      layout[agentList[2].id] = { x: pad + halfW + gap, y: pad + halfH + gap, width: halfW, height: halfH, zIndex: 12 };
    } else if (count === 4) {
      // 4 Agents: 2x2 Grid (Each 50% width, 50% height)
      const halfW = Math.floor((availW - gap) / 2);
      const halfH = Math.floor((availH - gap) / 2);
      layout[agentList[0].id] = { x: pad, y: pad, width: halfW, height: halfH, zIndex: 10 };
      layout[agentList[1].id] = { x: pad + halfW + gap, y: pad, width: halfW, height: halfH, zIndex: 11 };
      layout[agentList[2].id] = { x: pad, y: pad + halfH + gap, width: halfW, height: halfH, zIndex: 12 };
      layout[agentList[3].id] = { x: pad + halfW + gap, y: pad + halfH + gap, width: halfW, height: halfH, zIndex: 13 };
    } else {
      // 5+ Agents: 3-column Grid
      const cols = 3;
      const rows = Math.ceil(count / cols);
      const cellW = Math.floor((availW - (cols - 1) * gap) / cols);
      const cellH = Math.floor((availH - (rows - 1) * gap) / rows);
      agentList.forEach((agent, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        layout[agent.id] = {
          x: pad + c * (cellW + gap),
          y: pad + r * (cellH + gap),
          width: cellW,
          height: cellH,
          zIndex: 10 + idx,
        };
      });
    }

    return layout;
  };

  // Re-align layout whenever agents count changes or on mount
  useEffect(() => {
    if (!containerRef.current || agents.length === 0) return;
    const containerW = containerRef.current.clientWidth || window.innerWidth - 260;
    const containerH = containerRef.current.clientHeight || window.innerHeight - 80;

    const newLayout = calculateSmartLayout(agents, containerW, containerH);
    setWindowBounds(newLayout);

    if (agents.length > 0 && !activeAgentId) {
      setActiveAgentId(agents[0].id);
    }
  }, [agents.length]);

  const bringToFront = (agentId: string) => {
    setActiveAgentId(agentId);
    setTopZIndex(prev => {
      const nextZ = prev + 1;
      setWindowBounds(current => ({
        ...current,
        [agentId]: {
          ...(current[agentId] || { x: 40, y: 40, width: 600, height: 400 }),
          zIndex: nextZ,
        },
      }));
      return nextZ;
    });
  };

  const handlePositionChange = (agentId: string, bounds: { x: number; y: number; width: number; height: number }) => {
    setWindowBounds(prev => ({
      ...prev,
      [agentId]: {
        ...(prev[agentId] || { zIndex: 10 }),
        ...bounds,
      },
    }));
  };

  // Auto-tile / Arrange all windows
  const handleAutoArrange = () => {
    if (!containerRef.current || agents.length === 0) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const newLayout = calculateSmartLayout(agents, containerW, containerH);
    setWindowBounds(newLayout);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // Fit all windows into current view
  const handleFitToView = () => {
    if (agents.length === 0 || !containerRef.current) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    agents.forEach(a => {
      const b = windowBounds[a.id];
      if (b) {
        minX = Math.min(minX, b.x);
        maxX = Math.max(maxX, b.x + b.width);
        minY = Math.min(minY, b.y);
        maxY = Math.max(maxY, b.y + b.height);
      }
    });

    if (minX === Infinity) return;

    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    const fitScale = Math.min(1.2, Math.max(0.4, Math.min(containerW / contentW, containerH / contentH)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const targetPanX = containerW / 2 - centerX * fitScale;
    const targetPanY = containerH / 2 - centerY * fitScale;

    setZoom(fitScale);
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Canvas Mouse Pan Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only pan if clicking empty canvas or with middle mouse / space key
    if ((e.target as HTMLElement).closest('.react-draggable, button, input, select, textarea, .floating-window-header')) {
      return;
    }

    setIsPanning(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.mouseX;
    const dy = e.clientY - panStartRef.current.mouseY;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  // Smooth Zoom with Mouse Wheel
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.xterm, .xterm-screen, textarea, select')) {
      return; // allow normal terminal scroll
    }

    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(1.8, Math.max(0.35, zoom * zoomFactor));

    if (!containerRef.current) {
      setZoom(newZoom);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom centered around mouse cursor point
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;

    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleQuickSpawn = async (provider: AgentProvider) => {
    setIsQuickAddOpen(false);
    if (!activeWorkspace) return;
    const agent = await addAgent(
      activeWorkspace.id,
      provider,
      undefined,
      undefined,
      activeWorkspace.projectPath,
      activeSpaceId
    );
    bringToFront(agent.id);
  };

  const { canvasGridStyle } = useSettingsStore();

  const getCanvasBackground = () => {
    if (canvasGridStyle === 'grid') {
      return {
        backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
        backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      };
    } else if (canvasGridStyle === 'solid') {
      return {};
    }
    // Default: Dots
    return {
      backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)',
      backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
      backgroundPosition: `${pan.x}px ${pan.y}px`,
    };
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onWheel={handleCanvasWheel}
      className={`relative flex-1 w-full h-full overflow-hidden select-none transition-colors duration-200 ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        backgroundColor: 'var(--bg-canvas, #07080a)',
        ...getCanvasBackground(),
      }}
    >
      {/* Bottom-Left Canvas Zoom & Navigation Floating Bar */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-1 bg-[#14151b]/95 backdrop-blur-md border border-[#272935] rounded-lg p-1 shadow-2xl text-xs font-mono text-[#8e93a0]">
        <button
          onClick={() => setZoom(prev => Math.max(0.35, prev * 0.9))}
          className="p-1.5 hover:text-[#f3f4f8] hover:bg-[#1f212c] rounded-md transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-1.5 py-0.5 hover:text-[#f3f4f8] font-medium text-[11px] transition-colors"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(prev => Math.min(1.8, prev * 1.1))}
          className="p-1.5 hover:text-[#f3f4f8] hover:bg-[#1f212c] rounded-md transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
        <div className="h-3.5 w-px bg-[#272935] mx-0.5" />
        <button
          onClick={handleFitToView}
          className="flex items-center gap-1 px-2 py-1 hover:text-[#f3f4f8] hover:bg-[#1f212c] rounded-md text-[11px] transition-colors"
          title="Fit All Terminals to View"
        >
          <Maximize size={11} />
          <span>Fit View</span>
        </button>
        <div className="h-3.5 w-px bg-[#272935] mx-0.5" />
        {/* Layout Presets */}
        <button
          onClick={() => {
            if (!containerRef.current || visibleAgents.length === 0) return;
            const pad = 20, gap = 14;
            const availW = containerRef.current.clientWidth - pad * 2;
            const availH = containerRef.current.clientHeight - pad * 2;
            const halfW = Math.floor((availW - gap) / 2);
            const layout: Record<string, WindowBounds> = {};
            visibleAgents.forEach((a, i) => {
              if (i === 0) layout[a.id] = { x: pad, y: pad, width: halfW, height: availH, zIndex: 10 };
              else if (i === 1) layout[a.id] = { x: pad + halfW + gap, y: pad, width: halfW, height: availH, zIndex: 11 };
              else layout[a.id] = { x: pad + 40 * i, y: pad + 40 * i, width: halfW, height: availH, zIndex: 10 + i };
            });
            setWindowBounds(layout);
          }}
          className="p-1.5 hover:text-white hover:bg-[#1f212c] rounded-md transition-colors"
          title="Side-by-Side (50/50 Split)"
        >
          <Columns2 size={13} />
        </button>
        <button
          onClick={() => {
            if (!containerRef.current || visibleAgents.length === 0) return;
            const pad = 20, gap = 14;
            const availW = containerRef.current.clientWidth - pad * 2;
            const availH = containerRef.current.clientHeight - pad * 2;
            const halfW = Math.floor((availW - gap) / 2);
            const halfH = Math.floor((availH - gap) / 2);
            const layout: Record<string, WindowBounds> = {};
            visibleAgents.forEach((a, i) => {
              const c = i % 2;
              const r = Math.floor(i / 2);
              layout[a.id] = {
                x: pad + c * (halfW + gap),
                y: pad + r * (halfH + gap),
                width: halfW,
                height: halfH,
                zIndex: 10 + i,
              };
            });
            setWindowBounds(layout);
          }}
          className="p-1.5 hover:text-white hover:bg-[#1f212c] rounded-md transition-colors"
          title="2x2 Quad Grid"
        >
          <LayoutGrid size={13} />
        </button>
        <button
          onClick={() => {
            if (!containerRef.current || visibleAgents.length === 0) return;
            const pad = 20, gap = 14;
            const availW = containerRef.current.clientWidth - pad * 2;
            const availH = containerRef.current.clientHeight - pad * 2;
            const cols = 3;
            const cellW = Math.floor((availW - (cols - 1) * gap) / cols);
            const layout: Record<string, WindowBounds> = {};
            visibleAgents.forEach((a, i) => {
              const c = i % cols;
              layout[a.id] = {
                x: pad + c * (cellW + gap),
                y: pad,
                width: cellW,
                height: availH,
                zIndex: 10 + i,
              };
            });
            setWindowBounds(layout);
          }}
          className="p-1.5 hover:text-white hover:bg-[#1f212c] rounded-md transition-colors"
          title="3-Column Panoramic Split"
        >
          <Columns3 size={13} />
        </button>
      </div>

      {/* Interactive Live Minimap in Bottom-Right */}
      <CanvasMinimap
        agents={visibleAgents}
        windowBounds={windowBounds}
        pan={pan}
        zoom={zoom}
        containerSize={containerSize}
        onNavigate={targetPan => setPan(targetPan)}
      />

      {/* Maximized Agent Fullscreen Overlay (Bypasses Pan & Zoom Scale for true 100% Viewport) */}
      {maximizedAgentId && (
        <div className="absolute inset-0 z-50 p-2 bg-[#0b0c0e] pointer-events-auto flex flex-col">
          {(() => {
            const maxAgent = visibleAgents.find((a) => a.id === maximizedAgentId) || visibleAgents[0];
            const bounds = windowBounds[maxAgent.id] || {
              x: 0,
              y: 0,
              width: 600,
              height: 420,
              zIndex: 100,
            };

            return (
              <AgentFloatingWindow
                key={maxAgent.id}
                agent={maxAgent}
                initialPosition={{
                  x: 0,
                  y: 0,
                  width: containerSize.width - 16,
                  height: containerSize.height - 16,
                }}
                zIndex={9999}
                isActive={true}
                scale={1}
                onFocus={() => bringToFront(maxAgent.id)}
                onPositionChange={(pos) => handlePositionChange(maxAgent.id, pos)}
              />
            );
          })()}
        </div>
      )}

      {/* Infinite Canvas Scaled Transform Layer */}
      <div
        className={clsx(
          "absolute inset-0 origin-top-left pointer-events-none",
          maximizedAgentId && "invisible"
        )}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          width: '100%',
          height: '100%',
        }}
      >
        <div className="relative w-full h-full pointer-events-auto">
          {visibleAgents.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none">
              <div className="w-12 h-12 rounded-2xl bg-panel border border-border flex items-center justify-center text-text-muted shadow-sm">
                <Terminal size={22} />
              </div>
              <div className="text-center">
                <p className="text-sm font-mono text-text-primary font-semibold">No agent terminals active in this space</p>
                <p className="text-xs font-mono text-text-muted mt-0.5">Click + Add Agent to launch an interactive session</p>
              </div>
              <button
                onClick={() => setAddAgentOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-text-primary text-background rounded-lg text-xs font-mono font-bold transition-all shadow-md hover:opacity-90 cursor-pointer"
              >
                <Plus size={13} strokeWidth={3} />
                <span>+ Add Agent</span>
              </button>
            </div>
          ) : (
            visibleAgents.map(agent => {
              const bounds = windowBounds[agent.id] || {
                x: 40,
                y: 40,
                width: 600,
                height: 420,
                zIndex: 10,
              };

              return (
                <AgentFloatingWindow
                  key={agent.id}
                  agent={agent}
                  initialPosition={{
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                  }}
                  zIndex={bounds.zIndex}
                  isActive={activeAgentId === agent.id}
                  scale={zoom}
                  onFocus={() => bringToFront(agent.id)}
                  onPositionChange={pos => handlePositionChange(agent.id, pos)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
