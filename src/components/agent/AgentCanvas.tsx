import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, LayoutGrid, RotateCcw, Terminal, ZoomIn, ZoomOut, Maximize, Grid2x2, Code2, Bookmark, Activity, GitBranch, FolderTree, X, Columns2, Columns3, Keyboard } from 'lucide-react';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUIStore } from '../../stores/ui.store';
import { useContextStore } from '../../stores/context.store';
import { useSettingsStore } from '../../stores/settings.store';
import { AgentFloatingWindow } from './AgentFloatingWindow';
import { CanvasMinimap } from './CanvasMinimap';
import { SwarmBroadcastBar } from './SwarmBroadcastBar';
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
  const agents = useAgentStore(s => s.agents);
  const addAgent = useAgentStore(s => s.addAgent);
  const getActiveWorkspace = useWorkspaceStore(s => s.getActiveWorkspace);
  const activeSpaceIdByProject = useWorkspaceStore(s => s.activeSpaceIdByProject);
  const setActiveSpace = useWorkspaceStore(s => s.setActiveSpace);
  const createSpace = useWorkspaceStore(s => s.createSpace);
  const deleteSpace = useWorkspaceStore(s => s.deleteSpace);
  const toggleBottomPanel = useUIStore(s => s.toggleBottomPanel);
  const activeBottomPanel = useUIStore(s => s.activeBottomPanel);
  const setShareContextOpen = useUIStore(s => s.setShareContextOpen);
  const setAddAgentOpen = useUIStore(s => s.setAddAgentOpen);
  const maximizedAgentId = useUIStore(s => s.maximizedAgentId);
  const selectedAgentForModal = useUIStore(s => s.selectedAgentForModal);
  const isMinimapVisible = useUIStore(s => s.isMinimapVisible);
  const checkpoints = useContextStore(s => s.checkpoints);
  const currentContext = useContextStore(s => s.currentContext);

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const [topZIndex, setTopZIndex] = useState<number>(10);
  const [windowBounds, setWindowBounds] = useState<Record<string, WindowBounds>>({});
  const [isAutoReflowEnabled, setIsAutoReflowEnabled] = useState<boolean>(true);
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

  // All agents belonging to this workspace are visible on the canvas
  const visibleAgents = agents.filter(
    (a) => Boolean(a && a.id) && (!activeWorkspace || a.workspaceId === activeWorkspace.id || !a.workspaceId)
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

  // Compute balanced initial non-overlapping grid layout for N agents
  const getGridDimensions = (count: number): { cols: number; rows: number } => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count === 3) return { cols: 3, rows: 1 };
    if (count === 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 8) return { cols: 4, rows: 2 };
    return { cols: 3, rows: Math.ceil(count / 3) };
  };

  const computeInitialLayout = (
    agentsList: typeof visibleAgents,
    containerW: number,
    containerH: number
  ): Record<string, WindowBounds> => {
    const count = agentsList.length;
    if (count === 0) return {};

    const pad = 16;
    const gap = 14;
    const availW = Math.max(360, containerW - pad * 2);
    const availH = Math.max(260, containerH - pad * 2);

    const { cols, rows } = getGridDimensions(count);
    const cellW = Math.floor((availW - (cols - 1) * gap) / cols);
    const cellH = Math.floor((availH - (rows - 1) * gap) / rows);

    const layout: Record<string, WindowBounds> = {};

    agentsList.forEach((agent, idx) => {
      if (!agent?.id) return;
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

    return layout;
  };

  // Adjust adjacent neighbor size & placement when a terminal resizes.
  // When active terminal expands, the adjacent neighbor SHRINKS to accommodate it (does not move away).
  // When active terminal shrinks, the adjacent neighbor EXPANDS to fill the space.
  const adjustNeighborSizesAndPlacement = (
    activeId: string,
    newBounds: { x: number; y: number; width: number; height: number },
    currentBounds: Record<string, WindowBounds>,
    agentsList: typeof visibleAgents
  ): Record<string, WindowBounds> => {
    const gap = 14;
    const minWidth = 260;
    const minHeight = 180;
    const result: Record<string, WindowBounds> = { ...currentBounds };

    const oldTarget = currentBounds[activeId] || newBounds;
    let targetW = newBounds.width;
    let targetH = newBounds.height;
    const deltaW = targetW - oldTarget.width;
    const deltaH = targetH - oldTarget.height;

    // 1. Horizontal neighbor adjustment:
    if (Math.abs(deltaW) >= 1) {
      // Find immediate neighbor to the right that overlaps vertically
      const rightNeighbors = agentsList
        .filter(other => other.id !== activeId && currentBounds[other.id])
        .map(other => ({ id: other.id, bounds: { ...currentBounds[other.id] } }))
        .filter(item => {
          const wasToRight = item.bounds.x >= oldTarget.x + oldTarget.width - 30;
          const vOverlap =
            Math.max(item.bounds.y, oldTarget.y) <
            Math.min(item.bounds.y + item.bounds.height, oldTarget.y + oldTarget.height);
          return wasToRight && vOverlap;
        })
        .sort((a, b) => a.bounds.x - b.bounds.x);

      if (rightNeighbors.length > 0) {
        const immediateRight = rightNeighbors[0];
        const neighborBounds = currentBounds[immediateRight.id];

        // When active expands (+deltaW), neighbor shrinks (-deltaW).
        // When active shrinks (-deltaW), neighbor expands (+deltaW).
        const maxDeltaW = neighborBounds.width - minWidth;
        const minDeltaW = -(oldTarget.width - minWidth);

        const clampedDeltaW = Math.max(minDeltaW, Math.min(deltaW, maxDeltaW));

        targetW = Math.max(minWidth, oldTarget.width + clampedDeltaW);
        const newNeighborW = Math.max(minWidth, neighborBounds.width - clampedDeltaW);
        const newNeighborX = Math.round(newBounds.x + targetW + gap);

        result[immediateRight.id] = {
          ...neighborBounds,
          x: newNeighborX,
          width: newNeighborW,
        };
      }
    }

    // 2. Vertical neighbor adjustment:
    if (Math.abs(deltaH) >= 1) {
      // Find immediate neighbor below that overlaps horizontally
      const bottomNeighbors = agentsList
        .filter(other => other.id !== activeId && currentBounds[other.id])
        .map(other => ({ id: other.id, bounds: { ...currentBounds[other.id] } }))
        .filter(item => {
          const wasBelow = item.bounds.y >= oldTarget.y + oldTarget.height - 30;
          const hOverlap =
            Math.max(item.bounds.x, oldTarget.x) <
            Math.min(item.bounds.x + item.bounds.width, oldTarget.x + oldTarget.width);
          return wasBelow && hOverlap;
        })
        .sort((a, b) => a.bounds.y - b.bounds.y);

      if (bottomNeighbors.length > 0) {
        const immediateBottom = bottomNeighbors[0];
        const neighborBounds = currentBounds[immediateBottom.id];

        // When active expands (+deltaH), neighbor below shrinks (-deltaH).
        // When active shrinks (-deltaH), neighbor below expands (+deltaH).
        const maxDeltaH = neighborBounds.height - minHeight;
        const minDeltaH = -(oldTarget.height - minHeight);

        const clampedDeltaH = Math.max(minDeltaH, Math.min(deltaH, maxDeltaH));

        targetH = Math.max(minHeight, oldTarget.height + clampedDeltaH);
        const newNeighborH = Math.max(minHeight, neighborBounds.height - clampedDeltaH);
        const newNeighborY = Math.round(newBounds.y + targetH + gap);

        result[immediateBottom.id] = {
          ...neighborBounds,
          y: newNeighborY,
          height: newNeighborH,
        };
      }
    }

    result[activeId] = {
      ...(currentBounds[activeId] || { zIndex: 10 }),
      x: newBounds.x,
      y: newBounds.y,
      width: targetW,
      height: targetH,
    };

    return result;
  };

  const [isAnyInteracting, setIsAnyInteracting] = useState<boolean>(false);

  // Synchronize all spawned agents across the grid automatically on first appearance
  useEffect(() => {
    if (visibleAgents.length === 0) {
      setWindowBounds({});
      return;
    }
    const containerW = containerRef.current?.clientWidth || window.innerWidth - 260;
    const containerH = containerRef.current?.clientHeight || window.innerHeight - 80;

    setWindowBounds(prev => {
      const missingAgents = visibleAgents.filter(a => !prev[a.id]);

      // If all agents already exist, keep their individual bounds
      if (missingAgents.length === 0) return prev;

      // When newly spawned agents arrive, calculate clean initial layout
      const initialLayout = computeInitialLayout(visibleAgents, containerW, containerH);

      if (isAutoReflowEnabled) {
        return initialLayout;
      }

      // Freeform mode: only position missing agents
      const next = { ...prev };
      missingAgents.forEach(a => {
        next[a.id] = initialLayout[a.id] || {
          x: 40,
          y: 40,
          width: 800,
          height: 520,
          zIndex: 10,
        };
      });
      return next;
    });

    if (visibleAgents.length > 0 && !activeAgentId) {
      setActiveAgentId(visibleAgents[visibleAgents.length - 1].id);
    }
  }, [visibleAgents.map(a => a.id).join(','), isAutoReflowEnabled, containerSize.width, containerSize.height]);

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

  useEffect(() => {
    if (selectedAgentForModal) {
      bringToFront(selectedAgentForModal);
    }
  }, [selectedAgentForModal]);

  const handlePositionChange = (
    agentId: string,
    bounds: { x: number; y: number; width: number; height: number },
    _direction?: string
  ) => {
    setWindowBounds(prev => {
      if (!isAutoReflowEnabled) {
        return {
          ...prev,
          [agentId]: {
            ...(prev[agentId] || { zIndex: 10 }),
            ...bounds,
          },
        };
      }

      // Auto-Reflow Mode: Inversely adjust neighbor dimensions without pushing them away
      return adjustNeighborSizesAndPlacement(agentId, bounds, prev, visibleAgents);
    });
  };

  const handleInteractionStart = (
    agentId: string,
    _action: 'resize' | 'drag',
    _bounds: { x: number; y: number; width: number; height: number }
  ) => {
    setActiveAgentId(agentId);
    setIsAnyInteracting(true);
  };

  const handleInteractionUpdate = (
    agentId: string,
    action: 'resize' | 'drag',
    bounds: { x: number; y: number; width: number; height: number },
    direction?: string
  ) => {
    if (action === 'resize' && isAutoReflowEnabled) {
      handlePositionChange(agentId, bounds, direction);
    }
  };

  const handleInteractionEnd = () => {
    setIsAnyInteracting(false);
  };

  // Auto-tile / Arrange all windows
  const handleAutoArrange = () => {
    if (!containerRef.current || visibleAgents.length === 0) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const newLayout = computeInitialLayout(visibleAgents, containerW, containerH);
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
    if ((e.target as HTMLElement).closest('[role="textbox"], textarea, select, canvas, .react-draggable, .floating-window-header')) {
      return; // allow normal terminal scroll and prevent canvas zoom
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

  // Global Keyboard Shortcuts (Alt+1..5 for Role Switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const focusedAgent = activeAgentId ? agents.find(a => a.id === activeAgentId) : visibleAgents[0];
        if (!focusedAgent) return;

        const roleMap: Record<string, import('../../types/orbit').AgentRoleType> = {
          '1': 'architect',   // Alt+1: Plan
          '2': 'implementer', // Alt+2: Code
          '3': 'reviewer',    // Alt+3: Audit / Review
          '4': 'raw',         // Alt+4: Shell
        };

        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          useUIStore.getState().setAddAgentOpen(true);
          return;
        }

        const targetRole = roleMap[e.key];
        if (targetRole) {
          e.preventDefault();
          useAgentStore.getState().setAgentRole(focusedAgent.id, targetRole);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAgentId, agents, visibleAgents]);

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
        backgroundImage: `linear-gradient(to right, var(--border-hover) 1px, transparent 1px), linear-gradient(to bottom, var(--border-hover) 1px, transparent 1px)`,
        backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      };
    } else if (canvasGridStyle === 'solid') {
      return {};
    }
    // Default: Dynamic Theme-Aware Dots (Crisply visible in both Light and Dark themes)
    return {
      backgroundImage: 'radial-gradient(var(--border-active) 1.5px, transparent 1.5px)',
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
        backgroundColor: 'var(--bg-canvas)',
        ...getCanvasBackground(),
      }}
    >
      {/* Bottom-Left Canvas Zoom & Navigation Floating Bar */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-1.5 glass-elevated rounded-xl p-1.5 shadow-2xl text-xs font-mono text-text-muted">
        <button
          onClick={() => setZoom(prev => Math.max(0.35, prev * 0.9))}
          className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-2 py-0.5 hover:text-white font-medium text-[11px] transition-colors cursor-pointer"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(prev => Math.min(1.8, prev * 1.1))}
          className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
        <div className="h-3.5 w-px bg-white/10 mx-0.5" />
        <button
          onClick={handleFitToView}
          className="flex items-center gap-1.5 px-2.5 py-1 hover:text-white hover:bg-white/5 rounded-lg text-[11px] transition-colors cursor-pointer"
          title="Fit All Terminals to View"
        >
          <Maximize size={11} />
          <span>Fit View</span>
        </button>
        <div className="h-3.5 w-px bg-white/10 mx-0.5" />
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
              if (!a?.id) return;
              if (i === 0) layout[a.id] = { x: pad, y: pad, width: halfW, height: availH, zIndex: 10 };
              else if (i === 1) layout[a.id] = { x: pad + halfW + gap, y: pad, width: halfW, height: availH, zIndex: 11 };
              else layout[a.id] = { x: pad + 40 * i, y: pad + 40 * i, width: halfW, height: availH, zIndex: 10 + i };
            });
            setWindowBounds(layout);
          }}
          className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
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
              if (!a?.id) return;
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
              if (!a?.id) return;
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
        <div className="h-3.5 w-px bg-white/10 mx-0.5" />
        <button
          onClick={() => {
            setIsAutoReflowEnabled(prev => {
              const next = !prev;
              if (next && containerRef.current && visibleAgents.length > 0) {
                const containerW = containerRef.current.clientWidth;
                const containerH = containerRef.current.clientHeight;
                const res = computeInitialLayout(visibleAgents, containerW, containerH);
                setWindowBounds(res);
              }
              return next;
            });
          }}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-mono transition-all cursor-pointer select-none',
            isAutoReflowEnabled
              ? 'bg-white/10 text-text-primary font-medium border border-white/15 shadow-xs'
              : 'text-text-muted hover:text-white hover:bg-white/5 border border-transparent'
          )}
          title={
            isAutoReflowEnabled
              ? 'Auto-Reflow is Active: Resizing any terminal automatically adjusts neighbor placement and dimensions'
              : 'Freeform Mode: Terminals can be positioned and resized completely independently'
          }
        >
          <Grid2x2 size={11} className={isAutoReflowEnabled ? 'text-text-primary' : 'text-text-dim'} />
          <span>{isAutoReflowEnabled ? 'Auto-Reflow' : 'Freeform'}</span>
        </button>
      </div>

      {/* Interactive Live Minimap in Bottom-Right */}
      {isMinimapVisible && (
        <CanvasMinimap
          agents={visibleAgents}
          windowBounds={windowBounds}
          pan={pan}
          zoom={zoom}
          containerSize={containerSize}
          onNavigate={targetPan => setPan(targetPan)}
        />
      )}

      {/* Maximized Agent Fullscreen Overlay (Bypasses Pan & Zoom Scale for true 100% Viewport) */}
      {maximizedAgentId && (
        <div className="absolute inset-0 z-50 p-2 bg-[#0b0c0e] pointer-events-auto flex flex-col">
          {(() => {
            const maxAgent = visibleAgents.find((a) => a.id === maximizedAgentId) || visibleAgents[0];
            if (!maxAgent) return null;
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
                <span>Spawn Worker</span>
              </button>
            </div>
          ) : (
            (() => {
              const defaultLayout = computeInitialLayout(
                visibleAgents,
                containerSize.width || (typeof window !== 'undefined' ? window.innerWidth - 260 : 1200),
                containerSize.height || (typeof window !== 'undefined' ? window.innerHeight - 80 : 800)
              );
              return visibleAgents.map(agent => {
                if (!agent?.id) return null;
                const bounds = windowBounds[agent.id] || defaultLayout[agent.id] || {
                  x: 40,
                  y: 40,
                  width: 880,
                  height: 600,
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
                    isInteractingWithSelf={activeAgentId === agent.id && isAnyInteracting}
                    isAnyInteracting={isAnyInteracting}
                    onFocus={() => bringToFront(agent.id)}
                    onPositionChange={(pos, direction) => handlePositionChange(agent.id, pos, direction)}
                    onInteractionStart={handleInteractionStart}
                    onInteractionUpdate={handleInteractionUpdate}
                    onInteractionEnd={handleInteractionEnd}
                  />
                );
              });
            })()
          )}
        </div>
      </div>

      {/* Floating Broadcast Bar */}
      <SwarmBroadcastBar />
    </div>
  );
};
