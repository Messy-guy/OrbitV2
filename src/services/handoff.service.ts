import {
  ContextPackage,
  Handoff,
  HandoffRecord,
  HandoffSelection,
  Message,
  ProjectContext,
  GitState,
  ChangedFileItem,
  FileEditSummary,
  ConversationSynthesis,
  HandoffPreviewSummary,
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
    fileSummaries?: FileEditSummary[];
    patterns?: string[];
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
  ): HandoffPreviewSummary;

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
    fileSummaries?: FileEditSummary[];
    patterns?: string[];
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
      fileSummaries: params.fileSummaries,
      patterns: params.patterns,
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
      ? (distilledBrief?.filesTouched?.length ? distilledBrief.filesTouched : (gitState?.modifiedFiles.map((f: ChangedFileItem) => f.path) || context.relevantFiles)).slice(0, 15)
      : [];

    const fileSummaries: FileEditSummary[] = distilledBrief?.fileSummaries || [];

    const requireConfirm = selection.requireConfirmation !== false;

    const projectSlug = (context.workspaceName || 'orbitv2')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'default';

    // High-signal, natural continuity protocol
    const executionGuidance = requireConfirm
      ? `## 🚀 INGESTION & CONTINUITY PROTOCOL
1. Ingest this handoff brief and reference the connected project memory in \`~/.orbit/memory/projects/${projectSlug}/\`.
2. Acknowledge the brief in 1-2 concise sentences summarizing the active mission and your immediate next action.
3. Seamlessly proceed with implementation without repeating completed work.`
      : `## 🚀 DIRECT EXECUTION PROTOCOL
Acknowledge this brief in 1 sentence and immediately proceed with the Next Step without repeating completed work.`;

    const memoryIndexSection = `## 📚 Connected Project Memory Files
• **Session Trajectory & Past Conversations**: \`~/.orbit/memory/projects/${projectSlug}/SESSION.md\`
• **Architectural Decisions & Invariants**: \`~/.orbit/memory/projects/${projectSlug}/DECISIONS.md\`
• **Project Roadmap & Milestone Phases**: \`~/.orbit/memory/projects/${projectSlug}/ROADMAP.md\`
• **Known Bugs, Errors & Blockers**: \`~/.orbit/memory/projects/${projectSlug}/BUGS.md\`
• **Codebase Patterns & Conventions**: \`~/.orbit/memory/projects/${projectSlug}/PATTERNS.md\`
• **Detailed File Diffs & Edit Summaries**: \`~/.orbit/memory/projects/${projectSlug}/CHANGES.md\`\n\n`;

    const narrative = distilledBrief?.conversationSynthesis?.narrativeSummary 
      || distilledBrief?.summaryNarrative 
      || distilledBrief?.notes 
      || '';
    const narrativeSection = narrative
      ? `## 🧠 Agent Conversation & Work Trajectory (From ${sourceAgentName})\n${narrative}\n\n`
      : '';

    const decisionsSection = allDecisions.length > 0
      ? `## ⚡ Architectural Decisions & Rules (DO NOT REVERT)\n${allDecisions.map(d => `• ${d}`).join('\n')}\n\n`
      : '';

    const blockersSection = allBlockers.length > 0 && allBlockers[0] !== 'None specified.'
      ? `## ⚠️ Encountered Blockers & Errors (Avoid repeating these!)\n${allBlockers.map(b => `• ⚠️ ${b}`).join('\n')}\n\n`
      : '';

    const patterns = distilledBrief?.conversationSynthesis?.patterns || [
      'Maintain strict TypeScript typing and preserve existing test contracts.',
      'Single shared PTY delivery funnel via ptyDelivery module with direct TUI pass-through.',
      'All cross-agent memory synchronized in local machine storage (~/.orbit/memory/projects/).',
    ];
    const patternsSection = `## 🧬 Discovered Patterns & Repository Conventions\n${patterns.map((p: string) => `• ${p}`).join('\n')}\n\n`;

    let filesSection = '';
    if (selection.includeChangedFiles) {
      if (fileSummaries.length > 0) {
        filesSection = `## 📝 Modified Files & Detailed Edit Summaries\n` + fileSummaries.map(f => {
          let block = `### \`${f.filePath}\` (${f.status}, +${f.additions}/-${f.deletions} lines)\n**Summary**: ${f.summary}`;
          if (f.diffSnippet && f.diffSnippet.trim().length > 0) {
            block += `\n\`\`\`diff\n${f.diffSnippet}\n\`\`\``;
          }
          return block;
        }).join('\n\n') + '\n\n';
      } else if (files.length > 0) {
        filesSection = `## 📝 Active Touchpoints / Modified Files\n${files.map((f: string) => `• \`${f}\``).join('\n')}\n\n`;
      }
    }

    const gitSection = gitState
      ? `## 🌿 Git State\n• **Branch**: \`${gitState.currentBranch}\`\n• **HEAD**: \`${gitState.headCommit}\`\n\n`
      : '';

    const intent = distilledBrief?.intent || 'chat_continue';
    let intentSubtitle = '**Workflow Intent**: 🔄 Resuming Conversation (Master Boot)';
    let intentSection = '';
    let agentDirective = `*Instructions for ${targetAgentName}: Seamlessly continue this exact discussion as if you generated the prior turns.*`;

    if (intent === 'plan_to_code') {
      intentSubtitle = '**Workflow Intent**: ⚡ Plan ➔ Code Relay (Brahma to Mahesh)';
      intentSection = `## 🛑 MAHESH Guardrails (Zero Bloat Invariants)\n• Rule 1: Pass test suite with minimal diff.\n• Rule 2: Zero sequential awaits for independent tasks (use Promise.all).\n• Rule 3: Zero unapproved npm packages or dependency bloat.\n• Rule 4: Absolute file protection (.env, .git, config untouched).\n\n`;
      agentDirective = `*Instructions for ${targetAgentName}: Begin implementing the code immediately step by step without re-planning.*`;
    } else if (intent === 'security_audit') {
      intentSubtitle = '**Workflow Intent**: 🛡️ Vishnu 15-Dimension Security Audit';
      intentSection = `## 🛡️ VISHNU 15-Dim Invariants & Audit Scope\n1. Race condition detection (atomic transactions for state).\n2. Input validation & sanitize params.\n3. No secrets or environment leakage.\n4. Error boundary & crash recovery.\n\n`;
      agentDirective = `*Instructions for ${targetAgentName}: Provide a concise bulleted audit report with CRITICAL, WARNING, and CLEAN status.*`;
    }

    // Include custom user directive note if present
    let userDirectiveSection = '';
    if (distilledBrief?.notes && distilledBrief.notes.includes('[USER DIRECTIVE]:')) {
      const parts = distilledBrief.notes.split('[USER DIRECTIVE]:');
      if (parts[1]?.trim()) {
        userDirectiveSection = `## 📌 User Directive\n${parts[1].trim()}\n\n`;
      }
    }

    const formattedInstruction = `# ORBIT CONTEXT HANDOFF BRIEF
**From**: ${sourceAgentName}  ➔  **To**: ${targetAgentName}
${intentSubtitle}
**Project**: ${context.goal || 'Orbit Workspace'}

${executionGuidance}

---

${memoryIndexSection}---

## 🎯 Active Goal & Mission
${distilledBrief?.task || distilledBrief?.goal || context.currentTask || context.goal}

${userDirectiveSection}${intentSection}${narrativeSection}${decisionsSection}${blockersSection}${patternsSection}${filesSection}${gitSection}## 👉 Immediate Next Action
${distilledBrief?.nextStep || distilledBrief?.nextSteps || 'Inspect active touched files and continue implementation from prior state.'}

---
${agentDirective}
*Generated by Orbit Multi-Agent Mesh Engine. Please adhere strictly to the protocol above.*`;

    return {
      task: distilledBrief?.task || distilledBrief?.goal || context.currentTask || `Continue ${context.goal.toLowerCase() || 'active workspace development'}.`,
      progress: selection.includeProgress ? `Implementation is active (~${context.progress}%).` : 'In progress.',
      currentIssue: primaryIssue,
      relevantFiles: files,
      fileSummaries: fileSummaries.length > 0 ? fileSummaries : undefined,
      conversationSynthesis: distilledBrief?.conversationSynthesis,
      summaryNarrative: narrative,
      previousAgent: sourceAgentName,
      nextStep: distilledBrief?.nextStep || distilledBrief?.nextSteps || 'Inspect active touched files and proceed with next task module.',
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

    // System handoff banner message with source agent conversation summary
    const conversationNarrative = previewSummary.summaryNarrative
      || previewSummary.conversationSynthesis?.narrativeSummary
      || '';

    const targetMessage: Message = {
      id: `msg-handoff-${Date.now()}`,
      sessionId: targetSessionId,
      role: 'system',
      content: `ORBIT CONTEXT HANDOFF\nContinuing from ${previewSummary.previousAgent}.\n\n`
        + (conversationNarrative ? `### Prior Conversation & Work Trajectory:\n${conversationNarrative}\n\n` : '')
        + `Current task:\n${previewSummary.task}\n\nProgress:\n${previewSummary.progress}\n\nCurrent issue:\n${previewSummary.currentIssue}\n\nRelevant files:\n${previewSummary.relevantFiles.join('\n')}`,
      isHandoffMessage: true,
      handoffData: {
        fromAgent: previewSummary.previousAgent,
        fromSession: sourceSessionId,
        task: previewSummary.task,
        progress: previewSummary.progress,
        issues: previewSummary.currentIssue,
        files: previewSummary.relevantFiles,
        conversationSummary: conversationNarrative,
        tokenCount: previewSummary.estimatedTokens,
      },
      timestamp: Date.now(),
    };

    // Receiving Agent direct acknowledgement
    const agentReply: Message = {
      id: `msg-reply-${Date.now() + 100}`,
      sessionId: targetSessionId,
      role: 'agent',
      content: `I have received the context handoff from ${previewSummary.previousAgent}. I have ingested the conversation summary, past architectural decisions, and active files from ~/.orbit/HANDOFF.md and will proceed according to protocol.`,
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
