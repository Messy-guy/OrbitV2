import { Handoff, HandoffSelection, ProjectContext, Message } from '../types/orbit';

export interface IHandoffService {
  generateHandoffPreview(
    context: ProjectContext,
    sourceAgentName: string,
    sourceSessionTitle: string,
    targetAgentName: string,
    selection: HandoffSelection
  ): {
    task: string;
    progress: string;
    currentIssue: string;
    relevantFiles: string[];
    previousAgent: string;
    nextStep: string;
    estimatedTokens: number;
  };
  executeHandoff(
    workspaceId: string,
    sourceAgentId: string,
    sourceSessionId: string,
    targetAgentId: string,
    targetSessionId: string,
    selection: HandoffSelection,
    previewSummary: any
  ): Promise<{ handoff: Handoff; targetMessage: Message; agentReply: Message }>;
}

export class MockHandoffService implements IHandoffService {
  generateHandoffPreview(
    context: ProjectContext,
    sourceAgentName: string,
    _sourceSessionTitle: string,
    _targetAgentName: string,
    selection: HandoffSelection
  ) {
    let tokenBase = 450;
    if (selection.includeCurrentTask) tokenBase += 200;
    if (selection.includeProgress) tokenBase += 150;
    if (selection.includeDecisions) tokenBase += context.decisions.length * 280;
    if (selection.includeKnownIssues) tokenBase += context.issues.length * 320;
    if (selection.includeChangedFiles) tokenBase += context.relevantFiles.length * 210;
    if (selection.includeRelevantConversation) tokenBase += 950;
    if (selection.includeFullConversation) tokenBase += 2400;

    const primaryIssue = context.issues[0]?.title || "Client state isn't resynchronized after reconnect.";
    const files = selection.includeChangedFiles ? context.relevantFiles.slice(0, 3) : ['src/socket/playlist.socket.ts'];

    return {
      task: `Continue ${context.goal.toLowerCase() || 'collaborative playlist synchronization'}.`,
      progress: selection.includeProgress ? `WebSocket implementation is complete (~${context.progress}%).` : 'In progress.',
      currentIssue: selection.includeKnownIssues ? primaryIssue : 'None specified.',
      relevantFiles: files,
      previousAgent: sourceAgentName,
      nextStep: 'Investigate reconnect state synchronization and verify socket event handlers.',
      estimatedTokens: tokenBase,
    };
  }

  async executeHandoff(
    workspaceId: string,
    sourceAgentId: string,
    sourceSessionId: string,
    targetAgentId: string,
    targetSessionId: string,
    selection: HandoffSelection,
    previewSummary: any
  ): Promise<{ handoff: Handoff; targetMessage: Message; agentReply: Message }> {
    const handoff: Handoff = {
      id: `handoff-${Date.now()}`,
      workspaceId,
      sourceAgentId,
      sourceSessionId,
      targetAgentId,
      targetSessionId,
      selectedContext: selection,
      generatedSummary: previewSummary,
      createdAt: Date.now(),
    };

    // System handoff banner message
    const targetMessage: Message = {
      id: `msg-handoff-${Date.now()}`,
      sessionId: targetSessionId,
      role: 'system',
      content: `ORBIT HANDOFF\nContinuing from ${previewSummary.previousAgent}.\n\nCurrent task:\n${previewSummary.task}\n\nProgress:\n${previewSummary.progress}\n\nCurrent issue:\n${previewSummary.currentIssue}\n\nRelevant files:\n${previewSummary.relevantFiles.join('\n')}`,
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
      content: `I've received the context handoff from ${previewSummary.previousAgent}. I'll inspect the reconnect state flow in \`${previewSummary.relevantFiles[0] || 'src/socket/playlist.socket.ts'}\` and resolve the unsynchronized client state.`,
      toolInvocations: [
        { id: 'th-1', toolName: 'read_file', file: previewSummary.relevantFiles[0] || 'src/socket/playlist.socket.ts', status: 'completed' },
        { id: 'th-2', toolName: 'edit_file', file: 'src/store/playlist.store.ts', status: 'completed' }
      ],
      timestamp: Date.now() + 100,
    };

    return { handoff, targetMessage, agentReply };
  }
}
