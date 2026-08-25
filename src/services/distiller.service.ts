import { ExtractedSessionData } from './extractor.service';
import { OrbitKnowledgeGraph, GraphNode } from './graph.service';
import { TimeLensService, TimeLensFileAnalysis } from './timelens.service';

export type ContinuityIntent = 'chat_continue' | 'plan_to_code' | 'security_audit';

export interface DistilledSessionBrief {
  intent: ContinuityIntent;
  goal: string;
  summaryNarrative: string;
  recentUserDirectives: string[];
  filesTouched: string[];
  timeLensReport: string;
  blockers: string[];
  decisions: string[];
  nextSteps: string;
  estimatedTokens: number;
  originalTokensEstimated: number;
  compressionRatioPercent: number;
  graphNodesPacked: number;
  formattedEnvelope: string;
}

export class SessionDistillerService {
  /**
   * Distills session into high-signal Knapsack optimized brief with Tridev & TimeLens integration
   */
  public static distillSession(
    sessionData: ExtractedSessionData,
    intent: ContinuityIntent = 'chat_continue',
    sourceAgentName = 'Agent A',
    targetAgentName = 'Agent B',
    maxTokenBudget = 3200
  ): DistilledSessionBrief {
    const graph = new OrbitKnowledgeGraph();
    const now = Date.now();

    // 1. Root Task Node
    const rootTaskId = `task-${sessionData.sessionId}`;
    graph.addNode({
      id: rootTaskId,
      type: 'task',
      label: sessionData.primaryGoal || 'Active workspace development',
      weight: 150,
      estimatedTokens: 40,
      timestamp: now,
    });

    // 2. Add Recent User Directives Nodes (Critical)
    sessionData.recentUserInstructions.forEach((inst, idx) => {
      const instId = `inst-${idx}`;
      const tokenEst = Math.max(15, Math.ceil(inst.length / 4));
      graph.addNode({
        id: instId,
        type: 'decision',
        label: `User Directive: ${inst}`,
        details: inst,
        weight: 120 + idx * 10,
        estimatedTokens: tokenEst,
        timestamp: now - (5 - idx) * 1000,
      });
      graph.addEdge(rootTaskId, instId, 'DEPENDS_ON');
    });

    // 3. Add Turn Nodes & Links
    sessionData.turns.slice(-8).forEach((turn, idx) => {
      const turnId = `turn-${idx}-${turn.id}`;
      const tokenEst = Math.max(10, Math.ceil(turn.content.length / 4));
      graph.addNode({
        id: turnId,
        type: 'turn',
        label: `${turn.role.toUpperCase()}: ${turn.content.slice(0, 140)}...`,
        details: turn.content,
        weight: 60 + idx * 10,
        estimatedTokens: tokenEst,
        timestamp: turn.timestamp || now,
      });
      graph.addEdge(rootTaskId, turnId, 'PRODUCED');
    });

    // 4. Time-Lens Analysis
    const modifiedFileItems = sessionData.filesTouched.map(path => ({ path }));
    const timeLensAnalysis = TimeLensService.analyzeFiles(modifiedFileItems);
    const timeLensReport = TimeLensService.formatTimeLensReport(timeLensAnalysis);

    timeLensAnalysis.forEach((analysis, idx) => {
      const fileId = `file-${analysis.filePath}`;
      graph.addNode({
        id: fileId,
        type: 'timelens',
        label: `${analysis.filePath} [${analysis.classification}]`,
        details: analysis.note,
        weight: analysis.priorityScore,
        estimatedTokens: 20,
        timestamp: now - idx * 100,
      });
      graph.addEdge(rootTaskId, fileId, 'TOUCHED');
    });

    // 5. Add Decision Nodes
    sessionData.decisionsFormulated.forEach((dec, idx) => {
      const decId = `dec-${idx}`;
      graph.addNode({
        id: decId,
        type: 'decision',
        label: dec,
        weight: 100,
        estimatedTokens: 25,
        timestamp: now,
      });
      graph.addEdge(rootTaskId, decId, 'DEPENDS_ON');
    });

    // 6. Add Blocker Nodes
    sessionData.blockersFound.forEach((issue, idx) => {
      const issueId = `issue-${idx}`;
      graph.addNode({
        id: issueId,
        type: 'issue',
        label: issue,
        weight: 110,
        estimatedTokens: 30,
        timestamp: now,
      });
      graph.addEdge(rootTaskId, issueId, 'BLOCKED_BY');
    });

    // 7. PageRank Centrality Calculation
    graph.computePageRank(15, 0.85);
    const candidateNodes = graph.extractSubgraph(rootTaskId, 2);

    // 8. 0/1 Knapsack DP Optimization
    const optimalNodes = graph.optimizeTokenBudget(candidateNodes, maxTokenBudget);

    const chosenFiles = optimalNodes.filter((n) => n.type === 'timelens' || n.type === 'file').map((n) => n.label);
    const chosenDecisions = optimalNodes.filter((n) => n.type === 'decision').map((n) => n.label);
    const chosenBlockers = optimalNodes.filter((n) => n.type === 'issue').map((n) => n.label);

    const totalPackedTokens = optimalNodes.reduce((acc, n) => acc + n.estimatedTokens, 0) + 60;
    const rawTokensEstimated = sessionData.turns.reduce((acc, t) => acc + Math.ceil(t.content.length / 4), 0) + 800;
    const compressionRatio = Math.max(70, Math.round((1 - totalPackedTokens / Math.max(1000, rawTokensEstimated)) * 100));

    // 9. Generate Tailored Continuity Envelopes (Tridev / Master Formats)
    let formattedEnvelope = '';
    const latestUserPrompt = sessionData.recentUserInstructions[sessionData.recentUserInstructions.length - 1] || 'Proceed with workspace task';
    const nextStep = sessionData.lastUnfinishedStep || 'Continue active implementation flow without repeating prior work';

    if (intent === 'chat_continue') {
      formattedEnvelope = `# 🔄 ORBIT CONTINUITY: RESUMING CONVERSATION (MASTER BOOT)
**From**: ${sourceAgentName}  ➔  **To**: ${targetAgentName}
**Session Memory**: Continuing conversation trajectory.

## 🎯 Active Goal
${sessionData.primaryGoal || 'Workspace Task'}

## 💬 Distilled Conversation Context (PageRank & Knapsack Filtered)
${sessionData.recentUserInstructions.map(u => `• User: "${u}"`).join('\n')}

## ⚡ Active Invariants & Decisions
${chosenDecisions.length > 0 ? chosenDecisions.map(d => `• ${d}`).join('\n') : '• Adhere strictly to project conventions and existing types.'}

## ⏳ TIME-LENS File Map
${timeLensReport}

## 👉 Immediate Next Action
${nextStep}

*Instructions for ${targetAgentName}: Seamlessly continue this exact discussion as if you generated the prior turns.*`;
    } else if (intent === 'plan_to_code') {
      formattedEnvelope = `# ⚡ ORBIT CONTINUITY: BRAHMA TO MAHESH CODE RELAY
**From**: ${sourceAgentName} (Plan Architect)  ➔  **To**: ${targetAgentName} (TDD Builder)
**Objective**: Turn Plan Specification into Green Test Contracts with Zero Bloat.

## 📐 BRAHMA Specification & Invariants
${sessionData.primaryGoal || 'Workspace Implementation Specification'}

## 🛑 MAHESH Guardrails (Zero Bloat Invariants)
• Rule 1: Pass test suite with minimal diff.
• Rule 2: Zero sequential awaits for independent tasks (use Promise.all).
• Rule 3: Zero unapproved npm packages or dependency bloat.
• Rule 4: Absolute file protection (.env, .git, config untouched).

## ⏳ TIME-LENS Active Touchpoints
${timeLensReport}

## 👉 Immediate Action: Step 1
${nextStep}

*Instructions for ${targetAgentName}: Begin implementing the code immediately step by step without re-planning.*`;
    } else {
      // Security & AST Audit (Vishnu)
      formattedEnvelope = `# 🛡️ ORBIT CONTINUITY: VISHNU 15-DIMENSION SECURITY AUDIT
**From**: ${sourceAgentName}  ➔  **To**: ${targetAgentName} (Security Auditor)
**Objective**: Audit git diff and AST for race conditions, security vulnerabilities, and leaks.

## 🛡️ VISHNU 15-Dim Invariants
1. Race condition detection (atomic transactions for state).
2. Input validation & sanitize params.
3. No secrets or environment leakage.
4. Error boundary & crash recovery.

## 📝 Modified Files for Scan:
${timeLensReport}

*Instructions for ${targetAgentName}: Provide a concise bulleted audit report with CRITICAL, WARNING, and CLEAN status.*`;
    }

    return {
      intent,
      goal: sessionData.primaryGoal || 'Workspace Task',
      summaryNarrative: formattedEnvelope,
      recentUserDirectives: sessionData.recentUserInstructions,
      filesTouched: chosenFiles.length > 0 ? chosenFiles : sessionData.filesTouched,
      timeLensReport,
      blockers: chosenBlockers.length > 0 ? chosenBlockers : sessionData.blockersFound,
      decisions: chosenDecisions.length > 0 ? chosenDecisions : sessionData.decisionsFormulated,
      nextSteps: nextStep,
      estimatedTokens: totalPackedTokens,
      originalTokensEstimated: rawTokensEstimated,
      compressionRatioPercent: compressionRatio,
      graphNodesPacked: optimalNodes.length,
      formattedEnvelope,
    };
  }
}
