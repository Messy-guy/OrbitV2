import { Agent } from '../types/orbit';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-agy-1',
    workspaceId: 'ws-music-app',
    provider: 'antigravity',
    name: 'ANTIGRAVITY',
    model: 'Gemini 3.6 Flash',
    status: 'working',
    viewMode: 'terminal',
    pid: 4810,
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
    viewMode: 'terminal',
    pid: 4814,
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
    viewMode: 'terminal',
    pid: 4822,
    currentSessionId: 'sess-claude-02',
    createdAt: Date.now() - 3600000 * 5,
  },
];

export const AVAILABLE_AGENT_PRESETS = [
  {
    provider: 'claude' as const,
    name: 'CLAUDE CODE',
    model: 'Claude 3.7 Sonnet',
    description: 'Autonomous terminal execution, architecture analysis, and interactive testing harness',
    connected: true,
  },
  {
    provider: 'codex' as const,
    name: 'CODEX CLI',
    model: 'o3-mini (High)',
    description: 'Algorithmic code generation, surgical refactoring, and AST inspections',
    connected: true,
  },
  {
    provider: 'antigravity' as const,
    name: 'ANTIGRAVITY',
    model: 'Gemini 3.6 Flash',
    description: 'Deep reasoning, codebase exploration & multi-agent subagent delegation',
    connected: true,
  },
  {
    provider: 'opencode' as const,
    name: 'OPENCODE',
    model: 'DeepSeek R1 / V3',
    description: 'Open source localized engine & fast terminal scripting harness',
    connected: true,
  },
  {
    provider: 'terminal' as const,
    name: 'SHELL TERMINAL',
    model: 'Host Bash / Zsh',
    description: 'Raw interactive shell terminal connected to the workspace project directory',
    connected: true,
  },
  {
    provider: 'custom' as const,
    name: 'CUSTOM AGENT',
    model: 'Local LLM / Custom CLI',
    description: 'Connect any custom agent CLI or MCP harness via Orbit standard protocol',
    connected: true,
  }
];
