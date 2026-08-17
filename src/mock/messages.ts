import { Message } from '../types/orbit';

export const INITIAL_MESSAGES: Record<string, Message[]> = {
  'sess-agy-04': [
    {
      id: 'msg-agy-1',
      sessionId: 'sess-agy-04',
      role: 'user',
      content: 'Implement playlist synchronization between connected peers.',
      timestamp: Date.now() - 3600000 * 1.2,
    },
    {
      id: 'msg-agy-2',
      sessionId: 'sess-agy-04',
      role: 'agent',
      content: "I'll inspect the existing socket architecture and zustand state slice first.",
      toolInvocations: [
        { id: 't1', toolName: 'read_file', file: 'src/store/playlist.store.ts', status: 'completed' },
        { id: 't2', toolName: 'read_file', file: 'src/socket/playlist.socket.ts', status: 'completed' },
        { id: 't3', toolName: 'edit_file', file: 'src/server/websocket.server.ts', status: 'completed' },
        { id: 't4', toolName: 'run_tests', file: 'tests/socket.test.ts', status: 'in_progress', output: 'Running 6 test suites...' }
      ],
      timestamp: Date.now() - 3600000 * 1.1,
    },
    {
      id: 'msg-agy-3',
      sessionId: 'sess-agy-04',
      role: 'user',
      content: 'Fix the reconnect issue. When the client drops and reconnects, local playlist state becomes stale.',
      timestamp: Date.now() - 1800000,
    },
    {
      id: 'msg-agy-4',
      sessionId: 'sess-agy-04',
      role: 'agent',
      content: "I've isolated the socket event handler. The `CLIENT_RECONNECTED` event is missing the epoch version negotiation handshake with the central queue. I'll write the state resync protocol.",
      toolInvocations: [
        { id: 't5', toolName: 'edit_file', file: 'src/socket/playlist.socket.ts', status: 'completed' },
        { id: 't6', toolName: 'edit_file', file: 'src/store/playlist.store.ts', status: 'completed' },
      ],
      timestamp: Date.now() - 600000,
    }
  ],
  'sess-codex-01': [
    {
      id: 'msg-codex-1',
      sessionId: 'sess-codex-01',
      role: 'user',
      content: 'Review the WebSocket connection heartbeat and backoff algorithm.',
      timestamp: Date.now() - 3600000,
    },
    {
      id: 'msg-codex-2',
      sessionId: 'sess-codex-01',
      role: 'agent',
      content: "I checked `playlist.socket.ts`. The exponential backoff interval formula is `Math.min(1000 * Math.pow(2, attempt), 30000)` with ±20% jitter. Connection heartbeat is sent every 15s. Ready for context handoff.",
      toolInvocations: [
        { id: 'tc1', toolName: 'read_file', file: 'src/socket/playlist.socket.ts', status: 'completed' },
      ],
      timestamp: Date.now() - 3000000,
    }
  ],
  'sess-claude-02': [
    {
      id: 'msg-claude-1',
      sessionId: 'sess-claude-02',
      role: 'user',
      content: 'Run the audio buffer decoding integration tests.',
      timestamp: Date.now() - 86400000 + 3600000,
    },
    {
      id: 'msg-claude-2',
      sessionId: 'sess-claude-02',
      role: 'agent',
      content: 'Executed test suite across 12 test fixtures. All 12 audio buffer synchronization tests passed.',
      toolInvocations: [
        { id: 'cl1', toolName: 'run_tests', file: 'tests/audio.test.ts', status: 'completed', output: '✓ 12 tests passed in 1.42s' },
      ],
      timestamp: Date.now() - 86400000 + 7200000,
    }
  ]
};
