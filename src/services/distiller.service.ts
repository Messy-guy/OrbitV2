import { ExtractedSessionData } from './extractor.service';
import { OrbitKnowledgeGraph, GraphNode } from './graph.service';

export interface DistilledSessionBrief {
  goal: string;
  summaryNarrative: string;
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
    maxTokenBudget = 1200
  ): DistilledSessionBrief {
    const graph = new OrbitKnowledgeGraph();
    const now = Date.now();

    // 1. Root Task Node
    const rootTaskId = `task-${sessionData.sessionId}`;
    graph.addNode({
      id: rootTaskId,
      type: 'task',
      label: sessionData.primaryGoal || 'Workspace Task',
      weight: 100,
      estimatedTokens: 30,
      timestamp: now,
    });

    // 2. Add Turn Nodes & Links
    sessionData.turns.slice(-6).forEach((turn, idx) => {
      const turnId = `turn-${idx}-${turn.id}`;
      const tokenEst = Math.max(10, Math.ceil(turn.content.length / 4));
      graph.addNode({
        id: turnId,
        type: 'turn',
        label: `${turn.role.toUpperCase()}: ${turn.content.slice(0, 100)}...`,
        details: turn.content,
        weight: 30 + idx * 10,
        estimatedTokens: tokenEst,
        timestamp: turn.timestamp || now,
      });
      graph.addEdge(rootTaskId, turnId, 'PRODUCED');
    });

    // 3. Add File Nodes & Links
    sessionData.filesTouched.forEach((file) => {
      const fileId = `file-${file}`;
      graph.addNode({
        id: fileId,
        type: 'file',
        label: file,
        weight: 50,
        estimatedTokens: 15,
        timestamp: now,
      });
      graph.addEdge(rootTaskId, fileId, 'TOUCHED');
    });

    // 4. Add Decision Nodes
    sessionData.decisionsFormulated.forEach((dec, idx) => {
      const decId = `dec-${idx}`;
      graph.addNode({
        id: decId,
        type: 'decision',
        label: dec,
        weight: 80,
        estimatedTokens: 25,
        timestamp: now,
      });
      graph.addEdge(rootTaskId, decId, 'DEPENDS_ON');
    });

    // 5. Add Blocker Nodes
    sessionData.blockersFound.forEach((issue, idx) => {
      const issueId = `issue-${idx}`;
      graph.addNode({
        id: issueId,
        type: 'issue',
        label: issue,
        weight: 90,
        estimatedTokens: 30,
        timestamp: now,
      });
      graph.addEdge(rootTaskId, issueId, 'BLOCKED_BY');
    });

    // 6. Compute Centrality and Extract BFS Subgraph
    graph.computeCentralityScores();
    const candidateNodes = graph.extractSubgraph(rootTaskId, 2);

    // 7. Apply 0/1 Knapsack Token Budget Optimization
    const optimalNodes = graph.optimizeTokenBudget(candidateNodes, maxTokenBudget);

    // 8. Generate Synthesized High-Signal Narrative
    const chosenFiles = optimalNodes.filter((n) => n.type === 'file').map((n) => n.label);
    const chosenDecisions = optimalNodes.filter((n) => n.type === 'decision').map((n) => n.label);
    const chosenBlockers = optimalNodes.filter((n) => n.type === 'issue').map((n) => n.label);

    const narrativeParts: string[] = [];
    narrativeParts.push(`**Goal**: ${sessionData.primaryGoal || 'Workspace Task'}`);
    
    if (chosenFiles.length > 0) {
      narrativeParts.push(`**Active Files**:\n${chosenFiles.map((f) => `• \`${f}\``).join('\n')}`);
    }
    if (chosenDecisions.length > 0) {
      narrativeParts.push(`**Decisions & Refactors**:\n${chosenDecisions.map((d) => `• ${d}`).join('\n')}`);
    }
    if (chosenBlockers.length > 0) {
      narrativeParts.push(`**Known Blockers / Errors**:\n${chosenBlockers.map((b) => `• ⚠️ ${b}`).join('\n')}`);
    }
    narrativeParts.push(`**Next Step**: ${sessionData.lastUnfinishedStep || 'Continue active implementation'}`);

    const summaryNarrative = narrativeParts.join('\n\n');
    const totalTokens = optimalNodes.reduce((acc, n) => acc + n.estimatedTokens, 0) + 50;

    return {
      goal: sessionData.primaryGoal || 'Workspace Task',
      summaryNarrative,
      filesTouched: chosenFiles.length > 0 ? chosenFiles : sessionData.filesTouched,
      blockers: chosenBlockers.length > 0 ? chosenBlockers : sessionData.blockersFound,
      decisions: chosenDecisions.length > 0 ? chosenDecisions : sessionData.decisionsFormulated,
      nextSteps: sessionData.lastUnfinishedStep || 'Continue active implementation',
      estimatedTokens: totalTokens,
      graphNodesPacked: optimalNodes.length,
    };
  }
}
