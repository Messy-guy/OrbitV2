import React, { useEffect, useState, useRef } from 'react';
import RGL, { WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useAgentStore } from '../../stores/agent.store';
import { AgentTile } from './AgentTile';
import { AgentGridTileLayout } from '../../types/orbit';

const ReactGridLayout = WidthProvider(RGL);

export const AgentGrid: React.FC = () => {
  const { agents, gridLayouts, updateGridLayouts } = useAgentStore();
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleLayoutChange = (newLayouts: Layout[]) => {
    const formatted: AgentGridTileLayout[] = newLayouts.map(l => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      minW: l.minW,
      minH: l.minH,
    }));
    updateGridLayouts(formatted);
  };

  // Convert layouts to RGL format
  const rglLayouts: Layout[] = agents.map((agent, index) => {
    const existing = gridLayouts.find(l => l.i === agent.id);
    if (existing) {
      return {
        i: agent.id,
        x: existing.x,
        y: existing.y,
        w: existing.w,
        h: existing.h,
        minW: 3,
        minH: 4,
      };
    }
    const cols = 2;
    return {
      i: agent.id,
      x: (index % cols) * 6,
      y: Math.floor(index / cols) * 6,
      w: 6,
      h: 6,
      minW: 3,
      minH: 4,
    };
  });

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto p-3">
      <ReactGridLayout
        className="layout"
        layout={rglLayouts}
        cols={12}
        rowHeight={70}
        draggableHandle=".handle"
        draggableCancel=".no-drag"
        onLayoutChange={handleLayoutChange}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        isResizable={true}
        isDraggable={true}
      >
        {agents.map(agent => (
          <div key={agent.id} className="relative">
            <AgentTile agent={agent} />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
};
