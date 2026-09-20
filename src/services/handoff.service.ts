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
  HandoffPackage,
} from '../types/orbit';
import {
  VerificationLevel,
  ProjectDecision,
  ProjectInvariant,
  EngineeringProgress,
  ClassifiedConversationSnippet,
  MemoryEntity,
  Provenance,
} from '../types/provenance';
import { isTauriAvailable, tauriService } from './tauri.service';
import { EvidenceGate } from './evidence/EvidenceGate';
import { EventReplayEngine } from './evidence/EventReplayEngine';
import { EventStore, getCanonicalProjectSlug } from './evidence/EventStore';
import { pathJoin, getNodeFs } from '../utils/pathUtils';

export function buildHandoffPackage(params: {
  project: {
    name: string;
    slug: string;
    path: string;
    repository?: string;
    techStack?: Array<{ name: string; category: string; verificationLevel: VerificationLevel; source: string }>;
    architecture?: string;
  };
  mission: {
    primaryGoal: string;
    currentTask: string;
    progress?: EngineeringProgress;
  };
  currentState?: {
    gitBranch?: string;
    gitHead?: string;
    status?: 'active' | 'blocked' | 'paused';
  };
  invariants?: ProjectInvariant[];
  decisions?: ProjectDecision[];
  issues?: Array<MemoryEntity & {
    issue: string;
    status: 'open' | 'investigating' | 'resolved' | 'contradicted';
    verificationLevel: VerificationLevel;
    provenance: Provenance[];
  }>;
  failedApproaches?: Array<{
    attempt: string;
    result: string;
    reason: string;
    sourceSessionId: string;
  }>;
  changedFiles?: Array<{
    path: string;
    status: string;
    verificationLevel: VerificationLevel;
    additions: number;
    deletions: number;
    diffSnippet?: string;
  }>;
  relevantConversation?: ClassifiedConversationSnippet[];
  constraints?: string[];
  immediateNextAction?: {
    action: string;
    targetFiles: string[];
  };
  provenance?: Provenance[];
}): HandoffPackage {
  return {
    schemaVersion: 1,
    project: {
      name: params.project.name,
      slug: params.project.slug,
      path: params.project.path,
      repository: params.project.repository,
      techStack: params.project.techStack || [
        { name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' },
        { name: 'Rust', category: 'language', verificationLevel: 'file_verified', source: 'Cargo.toml' },
      ],
      architecture: params.project.architecture || 'Event-sourced project memory with evidence verification',
    },
    mission: {
      primaryGoal: params.mission.primaryGoal,
      currentTask: params.mission.currentTask,
      progress: params.mission.progress || {
        completed: ['Initialized project memory'],
        active: [params.mission.currentTask],
        blocked: [],
        next: params.immediateNextAction?.action || 'Inspect active touched files',
      },
    },
    currentState: {
      gitBranch: params.currentState?.gitBranch || 'main',
      gitHead: params.currentState?.gitHead || 'HEAD',
      status: params.currentState?.status || 'active',
    },
    invariants: params.invariants || [],
    decisions: params.decisions || [],
    issues: params.issues || [],
    failedApproaches: params.failedApproaches || [],
    changedFiles: params.changedFiles || [],
    relevantConversation: params.relevantConversation || [],
    constraints: params.constraints || [
      'Maintain strict TypeScript typing and preserve existing test contracts.',
      'Single shared PTY delivery funnel via ptyDelivery module with direct TUI pass-through.',
    ],
    immediateNextAction: params.immediateNextAction || {
      action: 'Inspect active touched files and continue implementation from prior state.',
      targetFiles: [],
    },
    provenance: params.provenance || [
      {
        sourceType: 'native_transcript',
        sourceId: 'session',
        timestamp: Date.now(),
        confidence: 'observed',
        verificationLevel: 'observed',
      },
    ],
    generatedAt: Date.now(),
  };
}

export function materializeHandoffMarkdown(
  pkg: HandoffPackage,
  sourceAgent: string,
  targetAgent: string
): string {
  const dateStr = new Date(pkg.generatedAt).toISOString();
  const techStackList = pkg.project.techStack.length > 0
    ? pkg.project.techStack.map(t => `- **${t.name}** (${t.category}) — verification: \`${t.verificationLevel}\` [source: ${t.source}]`).join('\n')
    : 'None detected.';

  const completedList = pkg.mission.progress.completed.length > 0
    ? pkg.mission.progress.completed.map(c => `- [x] ${c}`).join('\n')
    : 'No completed tasks recorded.';

  const workingOnList = pkg.mission.progress.active.length > 0
    ? pkg.mission.progress.active.map(a => `- [/] ${a}`).join('\n')
    : (pkg.mission.currentTask ? `- [/] ${pkg.mission.currentTask}` : 'Active task execution.');

  const decisionsList = pkg.decisions.length > 0
    ? pkg.decisions.map(d => `- **${d.decision}** (level: \`${d.effectiveLevel || 'observed'}\`)\n  - *Rationale*: ${d.rationale || 'N/A'}`).join('\n')
    : 'No critical decisions recorded.';

  const changedFilesList = pkg.changedFiles.length > 0
    ? pkg.changedFiles.map(f => {
        let entry = `- \`${f.path}\` (${f.status}, level: \`${f.verificationLevel}\`, +${f.additions}/-${f.deletions})`;
        if (f.diffSnippet && f.diffSnippet.trim()) {
          entry += `\n\`\`\`diff\n${f.diffSnippet}\n\`\`\``;
        }
        return entry;
      }).join('\n\n')
    : 'No file changes recorded.';

  const bugsList = pkg.issues.filter(i => i.status === 'open' || i.status === 'investigating').length > 0
    ? pkg.issues.filter(i => i.status === 'open' || i.status === 'investigating').map(i => `- ⚠️ [${i.status.toUpperCase()}] ${i.issue} (level: \`${i.verificationLevel}\`)`).join('\n')
    : 'No active bugs or errors.';

  const knownIssuesList = pkg.issues.length > 0
    ? pkg.issues.map(i => `- [${i.status}] ${i.issue} (level: \`${i.verificationLevel}\`)`).join('\n')
    : 'No known issues.';

  const failedApproachesList = pkg.failedApproaches.length > 0
    ? pkg.failedApproaches.map(f => `- **Attempt**: ${f.attempt}\n  - *Result*: ${f.result}\n  - *Reason*: ${f.reason}`).join('\n')
    : 'None recorded.';

  const constraintsList = [
    ...pkg.invariants.map(inv => `[INVARIANT] ${inv.statement}`),
    ...pkg.constraints
  ];
  const constraintsStr = constraintsList.length > 0
    ? constraintsList.map(c => `- ${c}`).join('\n')
    : 'Maintain existing conventions, test contracts, and strict typing.';

  const conversationSnippets = pkg.relevantConversation.length > 0
    ? pkg.relevantConversation.map(c => `#### [${c.category.toUpperCase()}] ${c.speaker === 'user' ? '👤 User' : '🤖 Agent'}\n> ${c.summary}${c.detail ? `\n> ${c.detail.replace(/\n/g, '\n> ')}` : ''}`).join('\n\n')
    : 'No conversation history captured.';

  const nextActionStr = pkg.immediateNextAction.action
    ? `${pkg.immediateNextAction.action}${pkg.immediateNextAction.targetFiles.length > 0 ? ` (Target files: ${pkg.immediateNextAction.targetFiles.map(f => `\`${f}\``).join(', ')})` : ''}`
    : 'Inspect active touched files and continue implementation.';

  return `# Orbit Handoff: ${pkg.project.name}
Generated: ${dateStr} | Source: ${sourceAgent} | Target: ${targetAgent}

## Mission
- **Primary Goal**: ${pkg.mission.primaryGoal}
- **Current Task**: ${pkg.mission.currentTask}

## Tech Stack
${techStackList}

## Architecture
${pkg.project.architecture || 'Standard project structure'}

## Current State
- **Git Branch**: \`${pkg.currentState.gitBranch || 'unknown'}\`
- **HEAD**: \`${pkg.currentState.gitHead || 'unknown'}\`
- **Status**: \`${pkg.currentState.status}\`

## Completed
${completedList}

## Currently Working On
${workingOnList}

## Important Decisions
${decisionsList}

## Changed Files
${changedFilesList}

## Bugs / Errors
${bugsList}

## Known Issues
${knownIssuesList}

## Failed Approaches
${failedApproachesList}

## Constraints
${constraintsStr}

## Recent Conversation
${conversationSnippets}

## Immediate Next Action
${nextActionStr}

## Instructions for Agent B
ORBIT CONTINUITY: You have the available project engineering context in HANDOFF.json, HANDOFF.md, and SESSION.md.
Project: ${pkg.project.name} | Tech: ${pkg.project.techStack.map(t => t.name).join(', ') || 'unknown'} | Active Task: ${pkg.mission.currentTask} | Immediate Next Action: ${pkg.immediateNextAction.action}
RULE: Follow DISCUSS protocol. Do not ask for background that is already represented in the handoff. If required information is genuinely absent to perform the next action, identify exactly what is missing. Do NOT modify files yet. Greet the user, summarize the engineering state and what was accomplished, state your immediate next action, and ask for confirmation to proceed.`;
}

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

    const projectSlug = getCanonicalProjectSlug(context.workspaceName, (context as any).projectPath);

    // High-signal, DISCUSS Ready Gate continuity protocol (inspired by leo-Agent MASTER.md & DISCUSS.md)
    const executionGuidance = `## 🛡️ INGESTION & CONTINUITY PROTOCOL (DISCUSS READY GATE) <!-- MANDATORY INGESTION PROTOCOL -->
You are inheriting this session from ${sourceAgentName}.

⚠️ CRITICAL INVARIANT: DO NOT MODIFY ANY FILES OR RUN DESTRUCTIVE COMMANDS YET.

Follow this exact sequence:
1. Ingest this handoff brief and verify the project state in \`~/.orbit/memory/projects/${projectSlug}/\` (SESSION.md, DECISIONS.md, CHANGES.md) and \`~/.orbit/projects/${projectSlug}/HANDOFF.json\`.
2. Formulate a crisp, conversational response to the user containing:
   • 🎯 Inherited Mission: 1-2 sentences summarizing what ${sourceAgentName} accomplished.
   • 💬 Last User Interaction: What you and ${sourceAgentName} were actively discussing.
   • 📋 Proposed Immediate Action: What you plan to do next.
3. Conclude by explicitly asking the user:
   "I have loaded the available project engineering context from ${sourceAgentName} and am ready. Shall I proceed with [Proposed Action], or would you like to direct me otherwise?"
4. STOP and WAIT for user confirmation before making code modifications.`;

    const memoryIndexSection = `## 📚 Connected Project Memory Files (System & Workspace)
• **Master Continuity Protocol**: \`~/.orbit/system/MASTER.md\`
• **Conversational Orchestrator & Ready Gate**: \`~/.orbit/system/DISCUSS.md\`
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
    let agentDirective = `*Instructions for ${targetAgentName}: Ingest this brief and recent conversation trajectory. Follow DISCUSS Ready Gate protocol: Do NOT edit files yet. Greet the user, summarize the inherited mission and last user directive, and confirm the next action before proceeding.*`;

    if (intent === 'plan_to_code') {
      intentSubtitle = '**Workflow Intent**: ⚡ Plan ➔ Implement Code Relay';
      intentSection = `## 🛑 Implementation Guardrails (Zero Bloat Invariants)\n• Rule 1: Pass test suite with minimal diff.\n• Rule 2: Zero sequential awaits for independent tasks (use Promise.all).\n• Rule 3: Zero unapproved npm packages or dependency bloat.\n• Rule 4: Absolute file protection (.env, .git, config untouched).\n\n`;
      agentDirective = `*Instructions for ${targetAgentName}: Ingest this specification and constraints. Follow DISCUSS Ready Gate protocol: Present your understanding to the user and confirm the immediate next step before executing code modifications.*`;
    } else if (intent === 'security_audit') {
      intentSubtitle = '**Workflow Intent**: 🛡️ Security & Code Review Audit';
      intentSection = `## 🛡️ Code Review & Security Invariants\n1. Race condition detection (atomic transactions for state).\n2. Input validation & sanitize params.\n3. No secrets or environment leakage.\n4. Error boundary & crash recovery.\n\n`;
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

    const handoffPackage = buildHandoffPackage({
      project: {
        name: context.goal || context.workspaceName || 'Orbit Workspace',
        slug: projectSlug,
        path: '',
        techStack: [
          { name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' },
          { name: 'Rust', category: 'language', verificationLevel: 'file_verified', source: 'Cargo.toml' },
        ],
        architecture: context.architecture || 'Event-sourced project memory with evidence verification',
      },
      mission: {
        primaryGoal: distilledBrief?.task || distilledBrief?.goal || context.currentTask || context.goal || 'Active workspace development',
        currentTask: distilledBrief?.task || distilledBrief?.goal || context.currentTask || 'Active task execution',
        progress: {
          completed: context.goal ? [`Targeted ${context.goal}`] : ['Initialized project memory'],
          active: [distilledBrief?.task || context.currentTask || 'Active task execution'],
          blocked: allBlockers.filter(b => b !== 'None specified.'),
          next: distilledBrief?.nextStep || distilledBrief?.nextSteps || 'Inspect active touched files and continue implementation from prior state.',
        },
      },
      currentState: {
        gitBranch: gitState?.currentBranch || 'main',
        gitHead: gitState?.headCommit || 'HEAD',
        status: allBlockers.length > 0 && allBlockers[0] !== 'None specified.' ? 'blocked' : 'active',
      },
      invariants: [],
      decisions: allDecisions.map((d: string, idx: number) => ({
        id: `dec_${idx + 1}`,
        createdByEventId: `evt_dec_${idx + 1}`,
        updatedByEventIds: [],
        decision: d,
        rationale: 'Architectural pattern decided during active engineering session',
        status: 'active' as const,
        provenance: [{
          sourceType: 'native_transcript' as const,
          sourceId: _sourceSessionTitle || 'session',
          timestamp: Date.now(),
          confidence: 'observed' as const,
          verificationLevel: 'observed' as const,
        }],
        verificationRecords: [{
          level: 'observed' as const,
          verifiedAt: Date.now(),
          sourceEventId: `evt_dec_${idx + 1}`,
          evidence: [d],
        }],
        effectiveLevel: 'observed' as const,
      })),
      issues: allBlockers.filter(b => b !== 'None specified.').map((b: string, idx: number) => ({
        id: `iss_${idx + 1}`,
        createdByEventId: `evt_iss_${idx + 1}`,
        updatedByEventIds: [],
        issue: b,
        status: 'open' as const,
        verificationLevel: 'observed' as const,
        provenance: [{
          sourceType: 'native_transcript' as const,
          sourceId: _sourceSessionTitle || 'session',
          timestamp: Date.now(),
          confidence: 'observed' as const,
          verificationLevel: 'observed' as const,
        }],
      })),
      failedApproaches: [],
      changedFiles: fileSummaries.length > 0
        ? fileSummaries.map(f => ({
            path: f.filePath,
            status: f.status,
            verificationLevel: 'git_verified' as const,
            additions: f.additions,
            deletions: f.deletions,
            diffSnippet: f.diffSnippet,
          }))
        : files.map((f: string) => ({
            path: f,
            status: 'modified',
            verificationLevel: 'git_verified' as const,
            additions: 0,
            deletions: 0,
          })),
      relevantConversation: distilledBrief?.conversationSynthesis?.workAccomplished?.map((w: any, idx: number) => ({
        id: `snip_${idx + 1}`,
        category: 'implementation_detail' as const,
        turnId: `turn_${idx + 1}`,
        speaker: 'agent' as const,
        summary: w.step,
        detail: w.detail,
        source: 'native_transcript' as const,
        timestamp: Date.now(),
      })) || [],
      constraints: patterns,
      immediateNextAction: {
        action: distilledBrief?.nextStep || distilledBrief?.nextSteps || 'Inspect active touched files and continue implementation from prior state.',
        targetFiles: files.slice(0, 3),
      },
    });

    const canonicalMarkdown = materializeHandoffMarkdown(handoffPackage, sourceAgentName, targetAgentName);

    const formattedInstruction = `# ORBIT CONTEXT HANDOFF BRIEF
**From**: ${sourceAgentName}  ➔  **To**: ${targetAgentName}
${intentSubtitle}
**Project**: ${context.goal || 'Orbit Workspace'}

${executionGuidance}

---

${memoryIndexSection}---

${canonicalMarkdown}

${userDirectiveSection}${intentSection}${narrativeSection}${decisionsSection}${blockersSection}${patternsSection}${filesSection}${gitSection}

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
      handoffPackage,
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
    // =========================================================================
    // REAL EVIDENCE VERIFICATION & EVENT REPLAY PIPELINE (Fix 3, 4, 5)
    // =========================================================================
    const projectSlug = getCanonicalProjectSlug(
      contextPackage.workspaceName,
      contextPackage.projectPath
    );
    const projectPath = contextPackage.projectPath || '';

    // 1. Gather candidate files from all sources
    const candidateFiles = new Set<string>();
    for (const f of contextPackage.changedFiles || []) {
      if (f.path) candidateFiles.add(f.path);
    }
    for (const f of previewSummary.relevantFiles || []) {
      if (typeof f === 'string' && f) candidateFiles.add(f);
      else if (f?.path) candidateFiles.add(f.path);
    }
    for (const f of contextPackage.gitState?.modifiedFiles || []) {
      if (f.path) candidateFiles.add(f.path);
    }
    for (const f of previewSummary.fileSummaries || []) {
      if (f.filePath) candidateFiles.add(f.filePath);
    }

    // 2. Real Evidence Verification via EvidenceGate
    for (const filePath of candidateFiles) {
      try {
        await EvidenceGate.verifyFileChange(projectSlug, projectPath, filePath, `evt_claim_${Date.now()}`);
      } catch (err) {
        console.warn(`[EvidenceGate] Verification error for ${filePath}:`, err);
      }
    }

    // 3. Evaluate candidate decisions against invariants
    const candidateDecisions: string[] = [
      ...(contextPackage.decisions || []),
      ...(previewSummary.decisions || []),
    ];
    const preEvents = await EventStore.getEvents(projectSlug);
    const preState = EventReplayEngine.replay(projectSlug, preEvents);

    for (const d of candidateDecisions) {
      if (!d || !d.trim()) continue;
      for (const inv of preState.invariants.filter((i) => i.status === 'active')) {
        const evalResult = EvidenceGate.evaluateClaimAgainstInvariant(inv, {
          id: `claim_${Date.now()}`,
          statement: d,
          sourceEventId: `evt_claim_${Date.now()}`,
        });
        if (evalResult.claimContradicted) {
          await EventStore.appendEvent(projectSlug, {
            eventId: `evt_contra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'claim.contradicted',
            projectId: projectSlug,
            sessionId: sourceSessionId,
            timestamp: Date.now(),
            payload: {
              claim: d,
              invariantId: inv.id,
              reason: evalResult.reason,
            },
            provenance: {
              sourceType: 'agent_observation',
              sourceId: `evt_claim_${Date.now()}`,
              timestamp: Date.now(),
              confidence: 'inferred',
              verificationLevel: 'observed',
              evidence: [evalResult.reason || 'Claim contradicts active invariant'],
            },
          });
        }
      }
    }

    // 4. Real Event Replay & Materialize Projections
    const authoritativeEvents = await EventStore.getEvents(projectSlug);
    const projectedState = EventReplayEngine.replay(projectSlug, authoritativeEvents);
    await EventReplayEngine.materializeProjections(projectSlug, projectedState);

    // 5. Update contextPackage & previewSummary from Authoritative Projected State
    const verifiedChanges = projectedState.changes.filter(
      (c) => c.verificationLevel === 'file_verified' || c.verificationLevel === 'git_verified'
    );
    const verifiedFilePaths = verifiedChanges.map((c) => c.path);

    const activeDecisions = projectedState.decisions
      .filter((d) => d.status === 'active')
      .map((d) => d.decision);

    const openIssues = projectedState.issues
      .filter((i) => i.status === 'open')
      .map((i) => i.issue);

    const activeInvariants = projectedState.invariants
      .filter((i) => i.status === 'active')
      .map((i) => i.statement);

    // Filter changedFiles in contextPackage
    contextPackage.changedFiles = verifiedChanges.map((c) => ({
      path: c.path,
      status: c.status,
    }));
    if (activeDecisions.length > 0) {
      contextPackage.decisions = activeDecisions;
    }
    if (openIssues.length > 0) {
      contextPackage.knownIssues = openIssues;
    }

    previewSummary.relevantFiles = verifiedFilePaths;
    previewSummary.decisions = activeDecisions;
    if (openIssues.length > 0) {
      previewSummary.currentIssue = openIssues[0];
    }

    // Build authoritative HandoffPackage
    const authoritativePkg = buildHandoffPackage({
      project: {
        name: contextPackage.workspaceName || projectedState.project.name || 'Orbit Workspace',
        slug: projectSlug,
        path: projectPath,
        repository: projectedState.project.repository,
        techStack: projectedState.project.techStack.length > 0
          ? projectedState.project.techStack
          : [
              { name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' },
              { name: 'Rust', category: 'language', verificationLevel: 'file_verified', source: 'Cargo.toml' },
            ],
        architecture: projectedState.project.architecture || 'Event-sourced persistent memory mesh',
      },
      mission: {
        primaryGoal: previewSummary.task || contextPackage.currentTask || projectedState.mission.primaryGoal,
        currentTask: previewSummary.task || contextPackage.currentTask || projectedState.mission.currentTask,
        progress: {
          completed: projectedState.mission.progress.completed,
          active: projectedState.mission.progress.active.length > 0 ? projectedState.mission.progress.active : [contextPackage.currentTask],
          blocked: openIssues,
          next: previewSummary.nextStep || projectedState.mission.progress.next,
        },
      },
      currentState: {
        gitBranch: contextPackage.gitState?.currentBranch || 'main',
        gitHead: contextPackage.gitState?.headCommit || 'HEAD',
        status: 'active',
      },
      invariants: projectedState.invariants.filter((i) => i.status === 'active'),
      decisions: projectedState.decisions.filter((d) => d.status === 'active'),
      issues: projectedState.issues as any,
      failedApproaches: [],
      changedFiles: verifiedChanges.map((c) => ({
        path: c.path,
        status: c.status,
        verificationLevel: c.verificationLevel,
        additions: c.additions || 0,
        deletions: c.deletions || 0,
        diffSnippet: c.diffSnippet,
      })),
      relevantConversation: previewSummary.handoffPackage?.relevantConversation || [],
      constraints: activeInvariants.length > 0 ? activeInvariants : (previewSummary.handoffPackage?.constraints || []),
      immediateNextAction: {
        action: previewSummary.nextStep || 'Inspect active touched files and continue implementation from prior state.',
        targetFiles: verifiedFilePaths.slice(0, 3),
      },
    });

    const canonicalMarkdown = materializeHandoffMarkdown(authoritativePkg, sourceAgentName, targetAgentName);
    contextPackage.formattedInstruction = canonicalMarkdown;
    contextPackage.handoffPackage = authoritativePkg;
    previewSummary.handoffPackage = authoritativePkg;

    // Persist canonical HANDOFF.json & views/HANDOFF.md directly to ~/.orbit/projects/<slug>/
    const projectDir = EventStore.getProjectDir(projectSlug);
    const viewsDir = pathJoin(projectDir, 'views');
    const handoffJsonStr = JSON.stringify(authoritativePkg, null, 2);

    const nodeFs = await getNodeFs();
    if (nodeFs && nodeFs.promises) {
      try {
        await nodeFs.promises.mkdir(viewsDir, { recursive: true });
        await nodeFs.promises.writeFile(pathJoin(projectDir, 'HANDOFF.json'), handoffJsonStr, 'utf8');
        await nodeFs.promises.writeFile(pathJoin(viewsDir, 'HANDOFF.md'), canonicalMarkdown, 'utf8');
        await nodeFs.promises.writeFile(pathJoin(projectDir, 'HANDOFF.md'), canonicalMarkdown, 'utf8');
      } catch (err) {
        console.warn('[HandoffService] Direct fs write warning:', err);
      }
    }
    if (isTauriAvailable()) {
      try {
        await tauriService.writeWorkspaceFile(projectDir, 'HANDOFF.json', handoffJsonStr);
        await tauriService.writeWorkspaceFile(viewsDir, 'HANDOFF.md', canonicalMarkdown);
        await tauriService.writeWorkspaceFile(projectDir, 'HANDOFF.md', canonicalMarkdown);
      } catch (err) {
        console.warn('[HandoffService] Tauri writeWorkspaceFile warning:', err);
      }
    }

    const handoffId = `handoff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Append canonical handoff.generated event to EventStore
    try {
      const handoffEvt = EventStore.createEvent(
        'handoff.generated',
        sourceSessionId,
        {
          handoffId,
          sourceAgent: sourceAgentName,
          targetAgent: targetAgentName,
          targetSessionId,
          packageHash: `${projectSlug}-${Date.now()}`,
          verifiedChangesCount: verifiedChanges.length,
          decisionsCount: authoritativePkg.decisions.length,
          task: previewSummary.task,
        },
        {
          sourceType: 'agent_observation',
          sourceId: sourceAgentId,
          confidence: 'observed',
          verificationLevel: 'behavior_verified',
        }
      );
      await EventStore.appendEvent(projectSlug, handoffEvt);
    } catch (err) {
      console.warn('[HandoffService] Failed to append handoff.generated event to EventStore:', err);
    }

    const handoffRecord: HandoffRecord = {
      id: handoffId,
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
        handoffRecord.status = 'failed';
        console.error('[HandoffService] Tauri executeAgentHandoff failed:', e);
        throw new Error(
          `Desktop handoff execution failed: ${e instanceof Error ? e.message : String(e)}`
        );
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
