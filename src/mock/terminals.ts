import { TerminalLine } from '../types/orbit';

export const INITIAL_TERMINAL_LOGS: Record<string, TerminalLine[]> = {
  'agent-agy-1': [
    { id: 't-agy-1', type: 'system', text: '\x1b[1;37m[Orbit Harness]\x1b[0m Spawning Antigravity Agent runtime (v2.4.0)...', timestamp: Date.now() - 3600000 },
    { id: 't-agy-2', type: 'system', text: '\x1b[38;5;244mConnecting to workspace:\x1b[0m ~/projects/music-app', timestamp: Date.now() - 3590000 },
    { id: 't-agy-3', type: 'stdout', text: '\x1b[32m✔\x1b[0m Workspace context synchronized (14 files, 3 decisions)', timestamp: Date.now() - 3580000 },
    { id: 't-agy-4', type: 'stdin', text: '$ agy "Implement playlist synchronization between connected peers"', timestamp: Date.now() - 3500000 },
    { id: 't-agy-5', type: 'tool', text: '\x1b[36m[TOOL:read_file]\x1b[0m src/store/playlist.store.ts', timestamp: Date.now() - 3400000 },
    { id: 't-agy-6', type: 'tool', text: '\x1b[36m[TOOL:read_file]\x1b[0m src/socket/playlist.socket.ts', timestamp: Date.now() - 3300000 },
    { id: 't-agy-7', type: 'tool', text: '\x1b[33m[TOOL:edit_file]\x1b[0m src/server/websocket.server.ts', timestamp: Date.now() - 3200000 },
    { id: 't-agy-8', type: 'diff-add', text: '+  socket.on("SYNC_PLAYLIST", (payload) => broadcastEpoch(payload));', timestamp: Date.now() - 3190000 },
    { id: 't-agy-9', type: 'diff-del', text: '-  socket.on("SYNC_PLAYLIST", (payload) => localQueue.push(payload));', timestamp: Date.now() - 3180000 },
    { id: 't-agy-10', type: 'stdout', text: '\x1b[32m✔\x1b[0m WebSocket event listener patched. Ready for prompt.', timestamp: Date.now() - 3000000 },
  ],
  'agent-codex-1': [
    { id: 't-cdx-1', type: 'system', text: '\x1b[1;37m[Orbit Harness]\x1b[0m Spawning OpenAI Codex CLI (o3-mini)...', timestamp: Date.now() - 3600000 },
    { id: 't-cdx-2', type: 'stdout', text: 'codex-cli initialized in interactive REPL mode.', timestamp: Date.now() - 3590000 },
    { id: 't-cdx-3', type: 'stdin', text: '$ codex review src/socket/playlist.socket.ts', timestamp: Date.now() - 3000000 },
    { id: 't-cdx-4', type: 'stdout', text: 'Inspecting heartbeat intervals & reconnect retry loops...', timestamp: Date.now() - 2900000 },
    { id: 't-cdx-5', type: 'stdout', text: 'Heartbeat interval: 15s. Backoff formula: Math.min(1000 * 2^attempt, 30000).', timestamp: Date.now() - 2800000 },
    { id: 't-cdx-6', type: 'stdout', text: '\x1b[32m✔\x1b[0m Analysis completed with 0 errors.', timestamp: Date.now() - 2700000 },
  ],
  'agent-claude-1': [
    { id: 't-cld-1', type: 'system', text: '\x1b[1;37m[Orbit Harness]\x1b[0m Spawning Claude Code CLI (v1.0.8)...', timestamp: Date.now() - 86400000 },
    { id: 't-cld-2', type: 'stdin', text: '$ claude "Run the audio buffer decoding integration tests"', timestamp: Date.now() - 86000000 },
    { id: 't-cld-3', type: 'tool', text: '\x1b[36m[TOOL:bash]\x1b[0m npm test tests/audio.test.ts', timestamp: Date.now() - 85900000 },
    { id: 't-cld-4', type: 'stdout', text: 'PASS tests/audio.test.ts (1.42s)', timestamp: Date.now() - 85800000 },
    { id: 't-cld-5', type: 'stdout', text: '✓ 12 tests passed, 0 failures', timestamp: Date.now() - 85700000 },
  ],
};
