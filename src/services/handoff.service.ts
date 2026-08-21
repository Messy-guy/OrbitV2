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
    if (isTauriAvailable()) {
      try {
        return await tauriService.generateContextPackage(params);
      } catch (e) {
        console.warn('Tauri generateContextPackage fallback', e);
      }
    }

    return {
      schemaVersion: 1,
      sourceAgent: params.sourceAgent,
      sourceSessionId: params.sourceSessionId,
      targetAgent: params.targetAgent,
      workspaceId: params.workspaceId,
      workspaceName: params.workspaceName,
      projectPath: params.projectPath,
      checkpointId: params.checkpointId,
      currentTask: params.currentTask,
      progress: params.progress,
      decisions: params.decisions,
      changedFiles: params.changedFiles,
      knownIssues: params.knownIssues,
      gitState: params.gitState,
      relevantHistory: params.relevantHistory,
      notes: params.notes,
      generatedAt: Date.now(),
      estimatedTokens: 600,
    };
  }

  generateHandoffPreview(
    context: ProjectContext,
    sourceAgentName: string,
    _sourceSessionTitle: string,
    targetAgentName: string,
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

    // Collect all blockers
    const rawBlockers: string[] = distilledBrief?.issues || distilledBrief?.blockers || [];
    const allBlockers = rawBlockers.length > 0
      ? rawBlockers
      : context.issues.map(i => i.title);
    const primaryIssue = allBlockers[0] || "None specified.";

    // Collect all decisions
    const rawDecisions: string[] = distilledBrief?.decisions || [];
    const allDecisions = rawDecisions.length > 0
      ? rawDecisions
      : context.decisions.map((d: any) => d.title);

    const files = selection.includeChangedFiles
      ? (distilledBrief?.filesTouched?.length ? distilledBrief.filesTouched : (gitState?.modifiedFiles.map((f: ChangedFileItem) => f.path) || context.relevantFiles)).slice(0, 10)
      : [];

    const requireConfirm = selection.requireConfirmation !== false;

    // High-signal, uncompromising execution protocol
    const executionGuidance = requireConfirm
      ? `## 🛑 MANDATORY INGESTION PROTOCOL (DO NOT EDIT FILES YET)
1. DO NOT write code, edit files, or execute build/test commands yet.
2. Ingest this handoff brief completely.
3. Respond to the user with a crisp 3-part recap:
   - **Mission Understood**: 1 sentence summary of the active objective.
   - **Past Context & Decisions Ingested**: Key constraints from ${sourceAgentName}.
   - **Proposed Next Action**: Exact step 1 and step 2 you intend to execute.
4. End your message with: *"I am ready. Shall I proceed with Step 1?"* and WAIT for user confirmation.`
      : `## 🚀 DIRECT EXECUTION PROTOCOL
Acknowledge this brief in 1 sentence and immediately proceed with the Next Step without repeating completed work.`;

    const narrative = distilledBrief?.summaryNarrative || distilledBrief?.notes || '';
    const narrativeSection = narrative
      ? `## 🧠 Agent Conversation & Work Summary (From ${sourceAgentName})\n${narrative}\n\n`
      : '';

    const decisionsSection = allDecisions.length > 0
      ? `## ⚡ Architectural Decisions & Rules (DO NOT REVERT)\n${allDecisions.map(d => `• ${d}`).join('\n')}\n\n`
      : '';

    const blockersSection = allBlockers.length > 0 && allBlockers[0] !== 'None specified.'
      ? `## ⚠️ Encountered Blockers & Errors (Avoid repeating these!)\n${allBlockers.map(b => `• ⚠️ ${b}`).join('\n')}\n\n`
      : '';

    const filesSection = files.length > 0
      ? `## 📝 Active Touchpoints / Modified Files\n${files.map((f: string) => `• \`${f}\``).join('\n')}\n\n`
      : '';

    const gitSection = gitState
      ? `## 🌿 Git State\n• **Branch**: \`${gitState.currentBranch}\`\n• **HEAD**: \`${gitState.headCommit}\`\n\n`
      : '';

    const formattedInstruction = `# ORBIT CONTEXT HANDOFF BRIEF
**From**: ${sourceAgentName}  ➔  **To**: ${targetAgentName}
**Project**: ${context.goal || 'Orbit Workspace'}

${executionGuidance}

---

## 🎯 Active Goal & Mission
${distilledBrief?.task || distilledBrief?.goal || context.currentTask || context.goal}

${narrativeSection}${decisionsSection}${blockersSection}${filesSection}${gitSection}## 👉 Immediate Next Action
${distilledBrief?.nextStep || distilledBrief?.nextSteps || 'Inspect the active touchpoints and begin step 1 of the objective.'}

---
*Generated by Orbit Multi-Agent Mesh Engine. Please adhere strictly to the protocol above.*`;

    return {
      task: distilledBrief?.task || distilledBrief?.goal || context.currentTask || `Continue ${context.goal.toLowerCase() || 'active workspace development'}.`,
      progress: selection.includeProgress ? `Implementation is active (~${context.progress}%).` : 'In progress.',
      currentIssue: primaryIssue,
      relevantFiles: files,
      previousAgent: sourceAgentName,
      nextStep: distilledBrief?.nextStep || distilledBrief?.nextSteps || 'Inspect active files and proceed with next task module.',
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
      content: `I have received the context handoff from ${previewSummary.previousAgent}. I have ingested the summary, past architectural decisions, and active files from .orbit/HANDOFF.md and will proceed according to protocol.`,
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
        console.warn('Tauri getHandoffHistory fallback', e);
      }
    }
    return this.fallbackHistory[workspaceId] || [];
  }
}

export const handoffService = new HybridHandoffService();
