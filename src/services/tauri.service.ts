import { Channel, invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { markPtySpawn } from './remoteControl/ptySpawnTracker';
import type {
  TerminalCell,
  TerminalColor,
  TerminalEvent,
  TerminalPatch,
  TerminalRow,
  TerminalSnapshot,
} from './terminal/terminalTypes';
import {
  Agent,
  AgentUsageStats,
  ChangedFileItem,
  Checkpoint,
  ContextPackage,
  GitState,
  HandoffRecord,
  ProjectContext,
  ProjectDecision,
  Session,
  Workspace,
} from '../types/orbit';

export interface DetectedAgentDto {
  provider: string;
  name: string;
  path: string;
  version?: string;
  isAvailable: boolean;
  description: string;
  installationSource?: 'orbit' | 'external' | 'system';
  installedByOrbit?: boolean;
}

export interface AgentOutputPayload {
  agentId: string;
  sessionId: string;
  stream: 'stdout' | 'stderr' | 'system' | 'tool' | 'diff-add' | 'diff-del';
  text: string;
  timestamp: number;
}

export interface AgentStatusPayload {
  agentId: string;
  sessionId?: string;
  status: string;
  phase?: 'reattached' | 'booting' | 'ready' | 'running' | 'exited' | 'failed' | string;
  pid?: number;
  exitCode?: number;
  message?: string;
}

export type NativeTerminalColor = TerminalColor;
export type NativeTerminalCell = TerminalCell;
export type NativeTerminalRow = TerminalRow;
export type NativeTerminalSnapshot = TerminalSnapshot;
export type NativeTerminalPatch = TerminalPatch;
export type NativeTerminalEvent = TerminalEvent;
export interface NativeTerminalDiagnostics { sessionsStarted: number; outputBytes: number; screenUpdates: number; attachCount: number; launchFailures: number; readerFailures: number; }

export interface NativeTerminalSessionInfo {
  sessionId: string;
  agentId: string;
  provider: string;
  pid: number;
  rows: number;
  columns: number;
  profileId?: string;
}

export const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const tauriService = {
  isAvailable: isTauriAvailable,

  // Agents Discovery
  async detectAgents(): Promise<DetectedAgentDto[]> {
    if (!isTauriAvailable()) return [];
    return invoke<DetectedAgentDto[]>('detect_agents');
  },

  async refreshDetectedAgents(): Promise<DetectedAgentDto[]> {
    if (!isTauriAvailable()) return [];
    return invoke<DetectedAgentDto[]>('refresh_detected_agents');
  },

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    if (!isTauriAvailable()) return [];
    return invoke<Workspace[]>('get_workspaces');
  },

  async createWorkspace(name: string, projectPath: string): Promise<Workspace> {
    if (!isTauriAvailable()) throw new Error('Tauri runtime unavailable');
    return invoke<Workspace>('create_workspace', { name, projectPath });
  },

  async openFolderDialog(): Promise<string | null> {
    if (!isTauriAvailable()) return null;
    return invoke<string | null>('open_folder_dialog');
  },

  async openFileDialog(title?: string): Promise<string | null> {
    if (!isTauriAvailable()) return null;
    return invoke<string | null>('open_file_dialog', { title });
  },

  async openExternalUrl(url: string): Promise<void> {
    if (!isTauriAvailable()) {
      window.open(url, '_blank');
      return;
    }
    return invoke<void>('open_external_url', { url });
  },

  async deleteWorkspace(id: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('delete_workspace', { id });
  },

  // Agents
  async getWorkspaceAgents(workspaceId: string): Promise<Agent[]> {
    if (!isTauriAvailable()) return [];
    return invoke<Agent[]>('get_workspace_agents', { workspaceId });
  },

  async saveAgent(agent: Agent): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('save_agent', { agent });
  },

  async deleteAgent(agentId: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('delete_agent', { agentId });
  },

  async getAgentUsageStats(agentId: string, provider: string): Promise<AgentUsageStats | null> {
    if (!isTauriAvailable()) return null;
    return invoke<AgentUsageStats>('get_agent_usage_stats', { agentId, provider });
  },

  // Sessions
  async getSessions(workspaceId: string): Promise<Session[]> {
    if (!isTauriAvailable()) return [];
    return invoke<Session[]>('get_sessions', { workspaceId });
  },

  async createSession(session: Session): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('create_session', { session });
  },

  // PTY Session Control
  async startAgentSession(
    workspacePath: string,
    agentId: string,
    sessionId: string,
    provider: string,
    prompt?: string,
    workspaceId?: string,
    rows?: number,
    cols?: number,
    profileId?: string,
    role?: string
  ): Promise<number> {
    if (!isTauriAvailable()) throw new Error('Tauri runtime unavailable');
    const pid = await invoke<number>('start_agent_session', {
      workspacePath,
      agentId,
      sessionId,
      provider,
      profileId,
      prompt,
      workspaceId,
      rows,
      cols,
      role,
    });
    // Record the spawn instant so PTY delivery can distinguish a freshly-spawned
    // TUI (needs its short readiness gate) from an established, ready process
    // (must receive remote messages instantly).
    markPtySpawn(agentId);
    return pid;
  },

  async startNativeTerminal(
    sessionId: string,
    agentId: string,
    provider: string,
    cwd: string,
    rows: number,
    columns: number,
    role?: string,
    prompt?: string,
    profileId?: string,
  ): Promise<NativeTerminalSessionInfo> {
    if (!isTauriAvailable()) throw new Error('Tauri runtime unavailable');
    const info = await invoke<NativeTerminalSessionInfo>('terminal_v2_start', {
      sessionId,
      agentId,
      provider,
      cwd,
      rows,
      columns,
      role,
      prompt,
      profileId,
    });
    // Keep remote-control delivery's startup/ready bookkeeping coherent for
    // sessions started through the native terminal path.
    markPtySpawn(agentId);
    return info;
  },

  async attachNativeTerminal(
    sessionId: string,
    onEvent: (event: NativeTerminalEvent) => void,
  ): Promise<{ subscriptionId: number; detach: () => Promise<void> }> {
    if (!isTauriAvailable()) throw new Error('Tauri runtime unavailable');
    const channel = new Channel<NativeTerminalEvent>(onEvent);
    const subscriptionId = await invoke<number>('terminal_v2_attach', { sessionId, channel });
    return {
      subscriptionId,
      detach: () => invoke<void>('terminal_v2_detach', { sessionId, subscriptionId }),
    };
  },

  async getNativeTerminalSnapshot(sessionId: string): Promise<NativeTerminalSnapshot> {
    if (!isTauriAvailable()) throw new Error('Tauri runtime unavailable');
    return invoke<NativeTerminalSnapshot>('terminal_v2_snapshot', { sessionId });
  },

  async sendNativeTerminalInput(sessionId: string, bytes: Uint8Array | number[]): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('terminal_v2_input', { sessionId, bytes: Array.from(bytes) });
  },

  async resizeNativeTerminal(sessionId: string, rows: number, columns: number): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('terminal_v2_resize', { sessionId, rows, columns });
  },

  async interruptNativeTerminal(sessionId: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('terminal_v2_interrupt', { sessionId });
  },

  async stopNativeTerminal(sessionId: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('terminal_v2_stop', { sessionId });
  },

  async getNativeTerminalDiagnostics(): Promise<NativeTerminalDiagnostics> {
    if (!isTauriAvailable()) return { sessionsStarted: 0, outputBytes: 0, screenUpdates: 0, attachCount: 0, launchFailures: 0, readerFailures: 0 };
    return invoke<NativeTerminalDiagnostics>('terminal_v2_diagnostics');
  },

  async sendAgentInput(agentId: string, sessionId: string, input: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('send_agent_input', { agentId, sessionId, input });
  },

  async setAgentRole(agentId: string, role: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('set_agent_role', { agentId, role });
  },

  async getAgentMcpTools(agentId: string): Promise<any[]> {
    if (!isTauriAvailable()) return [];
    return invoke<any[]>('get_agent_mcp_tools', { agentId });
  },

  async resizeAgentTerminal(agentId: string, rows: number, cols: number): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('resize_agent_terminal', { agentId, rows, cols });
  },

  async interruptAgentSession(agentId: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('interrupt_agent_session', { agentId });
  },

  async stopAgentSession(agentId: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('stop_agent_session', { agentId });
  },

  async getAgentTerminalHistory(agentId: string): Promise<string> {
    if (!isTauriAvailable()) return '';
    return invoke<string>('get_agent_terminal_history', { agentId });
  },

  async isAgentProcessRunning(agentId: string): Promise<boolean> {
    if (!isTauriAvailable()) return false;
    return invoke<boolean>('is_agent_process_running', { agentId });
  },

  // Phase 3: Git State
  async getGitState(projectPath: string): Promise<GitState> {
    if (!isTauriAvailable()) {
      return {
        currentBranch: 'main',
        headCommit: 'a82f31c',
        modifiedFiles: [],
        recentCommits: [],
      };
    }
    return invoke<GitState>('get_git_state', { projectPath });
  },

  // Phase 3: Project Context
  async getProjectContext(workspaceId: string): Promise<ProjectContext | null> {
    if (!isTauriAvailable()) return null;
    return invoke<ProjectContext | null>('get_project_context', { workspaceId });
  },

  async saveProjectContext(context: ProjectContext): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('save_project_context', { context });
  },

  // Phase 3: Checkpoints
  async getCheckpoints(workspaceId: string): Promise<Checkpoint[]> {
    if (!isTauriAvailable()) return [];
    return invoke<Checkpoint[]>('get_checkpoints', { workspaceId });
  },

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('save_checkpoint', { checkpoint });
  },

  async deleteCheckpoint(id: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('delete_checkpoint', { id });
  },

  // Phase 3: Context Package & Handoff
  async generateContextPackage(params: {
    sourceAgent: string;
    sourceSessionId: string;
    targetAgent: string;
    workspaceId: string;
    workspaceName: string;
    projectPath: string;
    checkpointId?: string;
    currentTask: string;
    progress: string;
    decisions: string[];
    changedFiles: ChangedFileItem[];
    knownIssues: string[];
    gitState?: GitState;
    relevantHistory?: string[];
    notes?: string[];
  }): Promise<ContextPackage> {
    if (!isTauriAvailable()) {
      const chars = (params.currentTask + params.progress + params.decisions.join(' ')).length;
      return {
        schemaVersion: 1,
        ...params,
        generatedAt: Date.now(),
        estimatedTokens: Math.max(1, Math.floor(chars / 4)),
        formattedInstruction: `Context Package from ${params.sourceAgent} for ${params.targetAgent}`,
      };
    }
    return invoke<ContextPackage>('generate_context_package', params);
  },

  async getHandoffHistory(workspaceId: string): Promise<HandoffRecord[]> {
    if (!isTauriAvailable()) return [];
    return invoke<HandoffRecord[]>('get_handoff_history', { workspaceId });
  },

  async recordHandoff(handoff: HandoffRecord): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('record_handoff', { handoff });
  },

  async executeAgentHandoff(handoff: HandoffRecord, targetProvider: string): Promise<number> {
    if (!isTauriAvailable()) return 0;
    return invoke<number>('execute_agent_handoff', { handoff, targetProvider });
  },

  // Phase 4: Intelligent Context Engine
  async getProjectActivity(workspaceId: string): Promise<import('../types/orbit').ProjectActivityState | null> {
    if (!isTauriAvailable()) return null;
    return invoke<import('../types/orbit').ProjectActivityState>('get_project_activity', { workspaceId });
  },

  async generateContextDraft(workspaceId: string, projectPath: string): Promise<import('../types/orbit').ContextDraft | null> {
    if (!isTauriAvailable()) return null;
    return invoke<import('../types/orbit').ContextDraft>('generate_context_draft', { workspaceId, projectPath });
  },

  async applyContextDraft(
    workspaceId: string,
    currentTask: string,
    progress: number,
    activeWork: string
  ): Promise<ProjectContext | null> {
    if (!isTauriAvailable()) return null;
    return invoke<ProjectContext>('apply_context_draft', {
      workspaceId,
      currentTask,
      progress,
      activeWork,
    });
  },

  async recordUserDecision(
    workspaceId: string,
    title: string,
    description?: string,
    authorAgent?: string
  ): Promise<ProjectDecision | null> {
    if (!isTauriAvailable()) return null;
    return invoke<ProjectDecision>('record_user_decision', {
      workspaceId,
      title,
      description,
      authorAgent,
    });
  },

  async resolveProjectIssue(workspaceId: string, issueId: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('resolve_project_issue', { workspaceId, issueId });
  },

  async writeProjectSkillFile(projectPath: string, relativePath: string, content: string): Promise<boolean> {
    if (!isTauriAvailable()) return false;
    try {
      return await invoke<boolean>('write_project_skill_file', { projectPath, relativePath, content });
    } catch (e) {
      console.warn('write_project_skill_file fallback:', e);
      return false;
    }
  },

  async removeProjectSkillFile(projectPath: string, relativePath: string): Promise<boolean> {
    if (!isTauriAvailable()) return false;
    try {
      return await invoke<boolean>('remove_project_skill_file', { projectPath, relativePath });
    } catch (e) {
      console.warn('remove_project_skill_file fallback:', e);
      return false;
    }
  },

  async installAgentCli(provider: string, command: string): Promise<string> {
    if (!isTauriAvailable()) return 'Simulated install in web mode';
    return invoke<string>('install_agent_cli', { provider, command });
  },

  async uninstallAgentCli(provider: string): Promise<string> {
    if (!isTauriAvailable()) return 'Simulated uninstall in web mode';
    return invoke<string>('uninstall_agent_cli', { provider });
  },

  async readWorkspaceFile(projectPath: string, relativePath: string): Promise<string> {
    if (!isTauriAvailable()) return `// Web demo preview for ${relativePath}`;
    return invoke<string>('read_workspace_file', { projectPath, relativePath });
  },

  async writeWorkspaceFile(projectPath: string, relativePath: string, content: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('write_workspace_file', { projectPath, relativePath, content });
  },

  async getWorkspaceFileDiff(projectPath: string, filePath: string): Promise<string> {
    if (!isTauriAvailable()) {
      return `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,5 +1,6 @@\n// Simulated diff for ${filePath}`;
    }
    return invoke<string>('get_workspace_file_diff', { projectPath, filePath });
  },

  async openInExternalEditor(projectPath: string, relativePath?: string): Promise<void> {
    if (!isTauriAvailable()) return;
    return invoke<void>('open_in_external_editor', { projectPath, relativePath });
  },

  // Event Subscriptions
  async onAgentOutput(callback: (payload: AgentOutputPayload) => void): Promise<UnlistenFn> {
    if (!isTauriAvailable()) return () => {};
    return listen<AgentOutputPayload>('agent-output', (event) => {
      callback(event.payload);
    });
  },

  async onAgentStatus(callback: (payload: AgentStatusPayload) => void): Promise<UnlistenFn> {
    if (!isTauriAvailable()) return () => {};
    return listen<AgentStatusPayload>('agent-status', (event) => {
      callback(event.payload);
    });
  },
};
