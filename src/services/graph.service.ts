/**
 * Orbit Knowledge Graph DSA Engine
 * Models workspace activities as an Adjacency List graph with BFS traversal,
 * Degree Centrality scoring, Topological ordering, and 0/1 Knapsack token budget optimization.
 */

export type NodeType = 'task' | 'file' | 'decision' | 'issue' | 'turn';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  details?: string;
  weight: number;      // Importance / relevance score
  estimatedTokens: number;
  timestamp: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: 'TOUCHED' | 'DEPENDS_ON' | 'BLOCKED_BY' | 'PRODUCED' | 'REFERENCES';
  weight: number;
}

export class OrbitKnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private adjacencyList: Map<string, GraphEdge[]> = new Map();

  public addNode(node: GraphNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    }
  }

  public addEdge(from: string, to: string, relation: GraphEdge['relation'], weight = 1.0): void {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return;

    const edges = this.adjacencyList.get(from) || [];
    if (!edges.some((e) => e.to === to && e.relation === relation)) {
      edges.push({ from, to, relation, weight });
      this.adjacencyList.set(from, edges);
    }
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Bounded Breadth-First Search (BFS) Subgraph Extraction
   * Traverses outward from rootTaskId up to maxDepth and collects all reachable vertices
   */
  public extractSubgraph(rootId: string, maxDepth = 2): GraphNode[] {
    if (!this.nodes.has(rootId)) {
      return Array.from(this.nodes.values());
    }

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
    const result: GraphNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;

      visited.add(current.id);
      const node = this.nodes.get(current.id);
      if (node) result.push(node);

      if (current.depth < maxDepth) {
        const edges = this.adjacencyList.get(current.id) || [];
        for (const edge of edges) {
          if (!visited.has(edge.to)) {
            queue.push({ id: edge.to, depth: current.depth + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Calculates Degree Centrality with exponential time decay
   * Score(n) = degree(n) * e^(-lambda * dt)
   */
  public computeCentralityScores(decayLambda = 0.0000001): void {
    const inDegree: Map<string, number> = new Map();
    const outDegree: Map<string, number> = new Map();
    const now = Date.now();

    for (const [from, edges] of this.adjacencyList.entries()) {
      outDegree.set(from, edges.length);
      for (const edge of edges) {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      }
    }

    for (const [id, node] of this.nodes.entries()) {
      const degree = (inDegree.get(id) || 0) * 1.5 + (outDegree.get(id) || 0);
      const deltaMs = Math.max(0, now - node.timestamp);
      const timeDecay = Math.exp(-decayLambda * deltaMs);

      // Node base weight modulated by connectivity and recency
      node.weight = Math.max(1, (10 + degree * 15) * timeDecay);
    }
  }

  /**
   * 0/1 Knapsack Dynamic Programming Token Budget Optimizer
   * Optimally selects items to pack into maxTokenBudget with maximum information value.
   */
  public optimizeTokenBudget(candidateNodes: GraphNode[], maxTokenBudget: number): GraphNode[] {
    const n = candidateNodes.length;
    if (n === 0 || maxTokenBudget <= 0) return [];

    // DP Table: dp[i][w] = max value using first i items with token budget w
    // Scale token budget down by chunk of 10 to keep DP grid compact & instant
    const SCALE = 10;
    const W = Math.floor(maxTokenBudget / SCALE);
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

    const weights = candidateNodes.map((node) => Math.max(1, Math.ceil(node.estimatedTokens / SCALE)));
    const values = candidateNodes.map((node) => Math.round(node.weight * 10));

    for (let i = 1; i <= n; i++) {
      const wt = weights[i - 1];
      const val = values[i - 1];
      for (let w = 0; w <= W; w++) {
        if (wt <= w) {
          dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - wt] + val);
        } else {
          dp[i][w] = dp[i - 1][w];
        }
      }
    }

    // Backtrack to extract chosen nodes
    const chosen: GraphNode[] = [];
    let currW = W;
    for (let i = n; i > 0 && currW > 0; i--) {
      if (dp[i][currW] !== dp[i - 1][currW]) {
        chosen.push(candidateNodes[i - 1]);
        currW -= weights[i - 1];
      }
    }

    return chosen.reverse();
  }
}
