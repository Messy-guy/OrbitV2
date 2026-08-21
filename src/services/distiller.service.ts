import { ExtractedSessionData } from './extractor.service';
import { OrbitKnowledgeGraph, GraphNode } from './graph.service';

export interface DistilledSessionBrief {
  goal: string;
  summaryNarrative: string;
  recentUserDirectives: string[];
  filesTouched: string[];
  blockers: string[];
  decisions: string[];
  nextSteps: string;
  estimatedTokens: number;
  graphNodesPacked: number;
}

export class SessionDistillerService {
  /**
   * Transforms raw extracted session data into an optimized Graph and produces a high-signal markdown brief
   */
  public static distillSession(
    sessionData: ExtractedSessionData,
    maxTokenBudget = 3200
  ): DistilledSessionBrief {
    const graph = new OrbitKnowledgeGraph();
    const now = Date.now();

    // 1. Root Task Node (Highest Priority)
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

    // 4. Add File Nodes & Links
    sessionData.filesTouched.forEach((file) => {
      const fileId = `file-${file}`;
      graph.addNode({
        id: fileId,
        type: 'file',
        label: file,
        weight: 70,
        estimatedTokens: 15,
        timestamp: now,
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

    // 7. Compute Centrality and Extract BFS Subgraph
    graph.computeCentralityScores();
    const candidateNodes = graph.extractSubgraph(rootTaskId, 2);

    // 8. Apply 0/1 Knapsack Token Budget Optimization
    const optimalNodes = graph.optimizeTokenBudget(candidateNodes, maxTokenBudget);

    // 9. Generate Synthesized High-Signal Narrative
    const chosenFiles = optimalNodes.filter((n) => n.type === 'file').map((n) => n.label);
    const chosenDecisions = optimalNodes.filter((n) => n.type === 'decision').map((n) => n.label);
    const chosenBlockers = optimalNodes.filter((n) => n.type === 'issue').map((n) => n.label);

    const narrativeParts: string[] = [];
    narrativeParts.push(`**Primary Goal**: ${sessionData.primaryGoal || 'Workspace Task'}`);
    
    if (sessionData.recentUserInstructions.length > 0) {
      narrativeParts.push(`**Recent User Directives (Latest First)**:\n${sessionData.recentUserInstructions.map((inst) => `• "${inst}"`).join('\n')}`);
    }

    if (chosenDecisions.length > 0) {
      narrativeParts.push(`**Decisions & Refactors Accomplished**:\n${chosenDecisions.map((d) => `• ${d}`).join('\n')}`);
    }

    if (chosenBlockers.length > 0) {
      narrativeParts.push(`**Known Blockers / Errors Discovered**:\n${chosenBlockers.map((b) => `• ⚠️ ${b}`).join('\n')}`);
    }

    if (chosenFiles.length > 0) {
      narrativeParts.push(`**Active Touchpoint Files**:\n${chosenFiles.map((f) => `• \`${f}\``).join('\n')}`);
    }

    narrativeParts.push(`**Next Step in Progress**: ${sessionData.lastUnfinishedStep || 'Continue active implementation flow without repeating prior work'}`);

    const summaryNarrative = narrativeParts.join('\n\n');
    const totalTokens = optimalNodes.reduce((acc, n) => acc + n.estimatedTokens, 0) + 50;

    return {
      goal: sessionData.primaryGoal || 'Workspace Task',
      summaryNarrative,
      recentUserDirectives: sessionData.recentUserInstructions,
      filesTouched: chosenFiles.length > 0 ? chosenFiles : sessionData.filesTouched,
      blockers: chosenBlockers.length > 0 ? chosenBlockers : sessionData.blockersFound,
      decisions: chosenDecisions.length > 0 ? chosenDecisions : sessionData.decisionsFormulated,
      nextSteps: sessionData.lastUnfinishedStep || 'Continue active implementation flow without repeating prior work',
      estimatedTokens: totalTokens,
      graphNodesPacked: optimalNodes.length,
    };
  }
}
