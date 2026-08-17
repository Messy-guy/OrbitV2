import { ProjectContext, Checkpoint } from '../types/orbit';

export const INITIAL_CONTEXT: Record<string, ProjectContext> = {
  'ws-music-app': {
    id: 'ctx-music-app',
    workspaceId: 'ws-music-app',
    goal: 'Collaborative playlist synchronization',
    progress: 78,
    decisions: [
      {
        id: 'dec-1',
        title: 'Zustand for client state',
        description: 'Lightweight reactive store slice for local playlist state without boilerplate',
        timestamp: '2h ago',
        authorAgent: 'ANTIGRAVITY'
      },
      {
        id: 'dec-2',
        title: 'WebSockets instead of polling',
        description: 'Bi-directional real-time event pipeline for instantaneous peer updates',
        timestamp: '4h ago',
        authorAgent: 'CLAUDE CODE'
      },
      {
        id: 'dec-3',
        title: 'Exponential backoff with jitter for reconnect',
        description: 'Prevents thundering herd on server reconnection bursts',
        timestamp: '1h ago',
        authorAgent: 'CODEX'
      }
    ],
    issues: [
      {
        id: 'iss-1',
        title: "Reconnection state isn't synchronized",
        severity: 'warning',
        status: 'investigating'
      },
      {
        id: 'iss-2',
        title: 'Audio buffer underrun during rapid track skip',
        severity: 'info',
        status: 'open'
      }
    ],
    architecture: 'Modular React + Zustand frontend connected over secure WebSockets to Node.js / Express real-time state coordinator.',
    relevantFiles: [
      'src/store/playlist.store.ts',
      'src/socket/playlist.socket.ts',
      'src/server/websocket.server.ts',
      'tests/socket.test.ts'
    ],
    lastCheckpointTime: '8 minutes ago',
    updatedAt: Date.now() - 480000,
  }
};

export const INITIAL_CHECKPOINTS: Record<string, Checkpoint[]> = {
  'ws-music-app': [
    {
      id: 'chk-1',
      workspaceId: 'ws-music-app',
      name: 'Playlist sync — reconnect investigation',
      summary: 'WebSocket implementation complete. Reconnect synchronization remains broken.',
      agentId: 'agent-agy-1',
      createdAt: Date.now() - 480000,
    },
    {
      id: 'chk-0',
      workspaceId: 'ws-music-app',
      name: 'Base socket scaffold & state store',
      summary: 'Initial websocket server harness created with basic Zustand playlist store slice.',
      agentId: 'agent-claude-1',
      createdAt: Date.now() - 86400000,
    }
  ]
};
