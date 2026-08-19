import { ProjectContext, Checkpoint } from '../types/orbit';

export const INITIAL_CONTEXT: Record<string, ProjectContext> = {
  'ws-music-app': {
    id: 'ctx-music-app',
    workspaceId: 'ws-music-app',
    currentTask: 'Fix playlist synchronization across connected peers',
    goal: 'Real-time collaborative audio streaming platform with peer synchronization',
    progress: 72,
    activeWork: 'WebSocket reconnect and epoch state negotiation',
    decisions: [
      {
        id: 'dec-1',
        title: 'Zustand for client-side reactive state',
        description: 'Provides fast decoupled slices without boilerplate',
        timestamp: '2h ago',
        authorAgent: 'ANTIGRAVITY',
      },
      {
        id: 'dec-2',
        title: 'Centralized epoch counter for track queue events',
        description: 'Prevents race conditions between concurrent playlist updates',
        timestamp: '1h ago',
        authorAgent: 'CODEX',
      },
      {
        id: 'dec-3',
        title: 'Binary WebSocket framing for raw audio buffer chunks',
        description: 'Reduces JSON serialization overhead during playback streaming',
        timestamp: '3h ago',
        authorAgent: 'ANTIGRAVITY',
      }
    ],
    issues: [
      {
        id: 'iss-1',
        title: 'Reconnection state is not persisted across browser refresh',
        severity: 'warning',
        status: 'investigating',
      },
      {
        id: 'iss-2',
        title: 'Audio buffer underrun on high jitter networks (>180ms)',
        severity: 'info',
        status: 'open',
      }
    ],
    notes: [
      'Audio buffer decoder passes 12 integration tests',
    ],
    architecture: 'Vite React SPA + Tauri Rust Core + WebSocket Server + Zustand',
    relevantFiles: [
      'src/store/playlist.store.ts',
      'src/socket/playlist.socket.ts',
      'src/server/websocket.server.ts',
      'tests/reconnect.spec.ts',
    ],
    lastCheckpointTime: '30m ago',
    updatedAt: Date.now() - 1800000,
  }
};

export const INITIAL_CHECKPOINTS: Record<string, Checkpoint[]> = {
  'ws-music-app': [
    {
      id: 'chk-01',
      workspaceId: 'ws-music-app',
      name: 'Checkpoint #7 — WebSocket Reconnect',
      task: 'Fix playlist synchronization and socket reconnect handshake',
      progress: 'WebSocket reconnect logic implemented with exponential jitter backoff',
      decisions: [
        'Zustand store used for client playlist state slice',
        'WebSocket protocol version negotiation handshake used',
      ],
      knownIssues: [
        'Reconnect state is not persisted in local storage on page refresh',
      ],
      notes: 'Ready for Codex review and verification tests',
      changedFiles: [
        { path: 'src/store/playlist.store.ts', status: 'modified' },
        { path: 'src/socket/playlist.socket.ts', status: 'modified' },
      ],
      agentId: 'agent-agy-1',
      agentName: 'ANTIGRAVITY',
      createdAt: Date.now() - 1800000,
    },
    {
      id: 'chk-02',
      workspaceId: 'ws-music-app',
      name: 'Checkpoint #6 — Core Socket Harness',
      task: 'Initial websocket server harness created with basic Zustand playlist store slice',
      progress: 'Initial websocket server harness created with basic Zustand playlist store slice',
      decisions: ['Binary WebSocket framing for audio chunks'],
      knownIssues: [],
      changedFiles: [
        { path: 'src/server/websocket.server.ts', status: 'modified' },
      ],
      agentId: 'agent-claude-1',
      agentName: 'CLAUDE CODE',
      createdAt: Date.now() - 86400000,
    }
  ]
};
