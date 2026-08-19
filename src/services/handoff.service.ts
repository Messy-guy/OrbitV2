import {
  ContextPackage,
  Handoff,
  HandoffRecord,
  HandoffSelection,
  Message,
  ProjectContext,
  GitState,
  ChangedFileItem,
} from '../types/orbit';
import { isTauriAvailable, tauriService } from './tauri.service';

export interface IHandoffService {
  buildContextPackage(params: {
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
  }): Promise<ContextPackage>;

  generateHandoffPreview(
    context: ProjectContext,
    sourceAgentName: string,
    sourceSessionTitle: string,
    targetAgentName: string,
    selection: HandoffSelection,
    gitState?: GitState,
    distilledBrief?: any
  ): {
    task: string;
    progress: string;
    currentIssue: string;
    relevantFiles: string[];
    previousAgent: string;
    nextStep: string;
    estimatedTokens: number;
    formattedInstruction?: string;
  };

  executeHandoff(
    workspaceId: string,
    sourceAgentId: string,
    sourceAgentName: string,
    sourceSessionId: string,
    targetAgentId: string,
    targetAgentName: string,
    targetProvider: string,
    targetSessionId: string,
    selection: HandoffSelection,
    previewSummary: any,
    contextPackage: ContextPackage
  ): Promise<{ handoffRecord: HandoffRecord; targetMessage: Message; agentReply: Message }>;

  getHandoffHistory(workspaceId: string): Promise<HandoffRecord[]>;
}

export class HybridHandoffService implements IHandoffService {
  private fallbackHistory: Record<string, HandoffRecord[]> = {};

  async buildContextPackage(params: {
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
    return await tauriService.generateContextPackage(params);
  }

  generateHandoffPreview(
    context: ProjectContext,
    sourceAgentName: string,
    _sourceSessionTitle: string,
    _targetAgentName: string,
    selection: HandoffSelection,
    gitState?: GitState,
    distilledBrief?: any
  ) {
    let tokenBase = distilledBrief?.estimatedTokens || 350;
    if (selection.includeCurrentTask) tokenBase += 80;
    if (selection.includeProgress) tokenBase += 60;
    if (selection.includeDecisions) tokenBase += context.decisions.length * 40;
    if (selection.includeKnownIssues) tokenBase += context.issues.length * 50;
    if (selection.includeChangedFiles) tokenBase += (gitState?.modifiedFiles.length || context.relevantFiles.length) * 60;
    if (selection.includeGitState) tokenBase += 100;
    if (selection.includeRelevantConversation) tokenBase += 150;
    if (selection.includeFullConversation) tokenBase += 300;

    const primaryIssue = distilledBrief?.blockers?.[0] || context.issues[0]?.title || "None specified.";
    const files = selection.includeChangedFiles
      ? (distilledBrief?.filesTouched?.length ? distilledBrief.filesTouched : (gitState?.modifiedFiles.map((f: any) => f.path) || context.relevantFiles)).slice(0, 6)
      : ['src/main.rs'];

    const narrativeSection = distilledBrief?.summaryNarrative
      ? `\n\n--- SESSION SYNTHESIS & GRAPH CONTEXT ---\n${distilledBrief.summaryNarrative}\n`
      : '';

    const formattedInstruction = `============================================================\nORBIT CONTEXT HANDOFF\n============================================================\nProject: ${context.goal || 'Orbit Workspace'}\nFrom: ${sourceAgentName}\n\nTask:\n${distilledBrief?.goal || context.currentTask || context.goal}\n\nProgress:\n${selection.includeProgress ? `Implementation is active (~${context.progress}%).` : 'In progress.'}\n${narrativeSection}\nDecisions:\n${context.decisions.map((d: any) => `• ${d.title}`).join('\n')}\n\nKnown Issues / Blockers:\n• ${primaryIssue}\n\nRelevant Files:\n${files.map((f: string) => `• ${f}`).join('\n')}\n============================================================\nContinue from this state without repeating completed work.`;

    return {
      task: distilledBrief?.goal || context.currentTask || `Continue ${context.goal.toLowerCase() || 'active workspace development'}.`,
      progress: selection.includeProgress ? `Implementation is active (~${context.progress}%).` : 'In progress.',
      currentIssue: primaryIssue,
      relevantFiles: files,
      previousAgent: sourceAgentName,
      nextStep: distilledBrief?.nextSteps || 'Inspect active files and proceed with next task module.',
      estimatedTokens: tokenBase,
      formattedInstruction,
    };
  }

  async executeHandoff(
    workspaceId: string,
    sourceAgentId: string,
    sourceAgentName: string,
    sourceSessionId: string,
    targetAgentId: string,
    targetAgentName: string,
    targetProvider: string,
    targetSessionId: string,
    _selection: HandoffSelection,
    previewSummary: any,
    contextPackage: ContextPackage
  ): Promise<{ handoffRecord: HandoffRecord; targetMessage: Message; agentReply: Message }> {
    const handoffRecord: HandoffRecord = {
      id: `handoff-${Date.now()}`,
      workspaceId,
      sourceAgentId,
      sourceAgentName,
      targetAgentId,
      targetAgentName,
      sourceSessionId,
      targetSessionId,
      checkpointId: contextPackage.checkpointId,
      task: previewSummary.task,
      contextPackage,
      status: 'sent',
      createdAt: Date.now(),
    };

    if (isTauriAvailable()) {
      try {
        await tauriService.executeAgentHandoff(handoffRecord, targetProvider);
      } catch (e) {
        console.warn('Tauri executeAgentHandoff error', e);
      }
    } else {
      if (!this.fallbackHistory[workspaceId]) {
        this.fallbackHistory[workspaceId] = [];
      }
      this.fallbackHistory[workspaceId].unshift(handoffRecord);
    }

    // System handoff banner message
    const targetMessage: Message = {
      id: `msg-handoff-${Date.now()}`,
      sessionId: targetSessionId,
      role: 'system',
      content: `ORBIT CONTEXT HANDOFF\nContinuing from ${previewSummary.previousAgent}.\n\nCurrent task:\n${previewSummary.task}\n\nProgress:\n${previewSummary.progress}\n\nCurrent issue:\n${previewSummary.currentIssue}\n\nRelevant files:\n${previewSummary.relevantFiles.join('\n')}`,
      isHandoffMessage: true,
      handoffData: {
        fromAgent: previewSummary.previousAgent,
        fromSession: sourceSessionId,
        task: previewSummary.task,
        progress: previewSummary.progress,
        issues: previewSummary.currentIssue,
        files: previewSummary.relevantFiles,
        tokenCount: previewSummary.estimatedTokens,
      },
      timestamp: Date.now(),
    };

    // Receiving Agent direct acknowledgement
    const agentReply: Message = {
      id: `msg-reply-${Date.now() + 100}`,
      sessionId: targetSessionId,
      role: 'agent',
      content: `I've received the structured context handoff from ${previewSummary.previousAgent}. I am inspecting the changed files and will resolve the known blockers without repeating previous tasks.`,
      toolInvocations: [
        { id: 'th-1', toolName: 'read_file', file: previewSummary.relevantFiles[0] || 'src/socket/playlist.socket.ts', status: 'completed' },
        { id: 'th-2', toolName: 'edit_file', file: 'src/store/playlist.store.ts', status: 'completed' },
      ],
      timestamp: Date.now() + 100,
    };

    return { handoffRecord, targetMessage, agentReply };
  }

  async getHandoffHistory(workspaceId: string): Promise<HandoffRecord[]> {
    if (isTauriAvailable()) {
      try {
        const list = await tauriService.getHandoffHistory(workspaceId);
        if (list && list.length > 0) return list;
      } catch (e) {
        console.warn('Tauri getHandoffHistory failed', e);
      }
    }
    return this.fallbackHistory[workspaceId] || [];
  }
}
