import { Session } from '../types/orbit';

export const INITIAL_SESSIONS: Session[] = [
  {
    id: 'sess-agy-04',
    agentId: 'agent-agy-1',
    workspaceId: 'ws-music-app',
    title: 'Session 04 — Playlist sync & socket refactor',
    status: 'active',
    createdAt: Date.now() - 3600000 * 1.5,
    updatedAt: Date.now() - 120000,
    messageCount: 8,
    lastActivityTime: 'Today · 12:03',
  },
  {
    id: 'sess-codex-01',
    agentId: 'agent-codex-1',
    workspaceId: 'ws-music-app',
    title: 'Session 01 — Reconnect state flow',
    status: 'active',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 300000,
    messageCount: 4,
    lastActivityTime: 'Today · 12:18',
  },
  {
    id: 'sess-claude-02',
    agentId: 'agent-claude-1',
    workspaceId: 'ws-music-app',
    title: 'Session 02 — Audio buffer pipeline & tests',
    status: 'completed',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000 + 7200000,
    messageCount: 14,
    lastActivityTime: 'Yesterday',
  },
];
