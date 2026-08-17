import { Agent } from '../types/orbit';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-agy-1',
    workspaceId: 'ws-music-app',
    provider: 'antigravity',
    name: 'ANTIGRAVITY',
    model: 'Gemini 3.6 Flash',
    status: 'working',
    currentSessionId: 'sess-agy-04',
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'agent-codex-1',
    workspaceId: 'ws-music-app',
    provider: 'codex',
    name: 'CODEX',
    model: 'o3-mini (High)',
    status: 'ready',
    currentSessionId: 'sess-codex-01',
    createdAt: Date.now() - 3600000 * 1.5,
  },
  {
    id: 'agent-claude-1',
    workspaceId: 'ws-music-app',
    provider: 'claude',
    name: 'CLAUDE CODE',
    model: 'Claude 3.7 Sonnet',
    status: 'paused',
    currentSessionId: 'sess-claude-02',
    createdAt: Date.now() - 3600000 * 5,
  },
];

export const AVAILABLE_AGENT_PRESETS = [
  {
    provider: 'antigravity' as const,
    name: 'ANTIGRAVITY',
    model: 'Gemini 3.6 Flash',
    description: 'Deep reasoning, codebase exploration & multi-agent subagent delegation',
    connected: true,
  },
  {
    provider: 'codex' as const,
    name: 'CODEX',
    model: 'o3-mini (High)',
    description: 'Fast algorithmic code generation & surgical refactoring',
    connected: true,
  },
  {
    provider: 'claude' as const,
    name: 'CLAUDE CODE',
    model: 'Claude 3.7 Sonnet',
    description: 'Autonomous terminal execution, architecture analysis & tests',
    connected: true,
  },
  {
    provider: 'opencode' as const,
    name: 'OPENCODE',
    model: 'DeepSeek R1 / V3',
    description: 'Open source localized engine & fast terminal scripting',
    connected: true,
  },
  {
    provider: 'gemini' as const,
    name: 'GEMINI CLI',
    model: 'Gemini 2.5 Pro',
    description: 'Multimodal context parsing and 2M token repo ingestion',
    connected: true,
  },
  {
    provider: 'custom' as const,
    name: 'CUSTOM AGENT',
    model: 'Local LLM / Custom Adapter',
    description: 'Connect any custom agent CLI via Orbit standard protocol',
    connected: true,
  }
];
