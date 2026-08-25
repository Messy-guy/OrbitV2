/**
 * Orbit Knowledge Graph & DSA Optimization Engine V2
 * Models workspace activities as an Adjacency List graph with:
 * 1. TF-IDF Symbol Scoring & Stop-word filtering
 * 2. PageRank Centrality with exponential time decay
 * 3. 0/1 Knapsack Dynamic Programming ($O(N \times W)$) Token Budget Optimizer
 */

export type NodeType = 'task' | 'file' | 'decision' | 'issue' | 'turn' | 'timelens';

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

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Bounded Breadth-First Search (BFS) Subgraph Extraction
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
   * PageRank Power Iteration with Exponential Time Decay
   * PR(u) = (1-d)/N + d * sum(PR(v) / Out(v) * e^(-lambda * dt))
   */
  public computePageRank(iterations = 15, damping = 0.85, decayLambda = 0.0000001): void {
    const N = this.nodes.size;
    if (N === 0) return;

    const nodeIds = Array.from(this.nodes.keys());
    let pr: Map<string, number> = new Map();
    nodeIds.forEach((id) => pr.set(id, 1.0 / N));

    const now = Date.now();
    const inEdges: Map<string, string[]> = new Map();
    const outDegrees: Map<string, number> = new Map();

    nodeIds.forEach((id) => {
      inEdges.set(id, []);
      outDegrees.set(id, 0);
    });

    for (const [from, edges] of this.adjacencyList.entries()) {
      outDegrees.set(from, edges.length);
      for (const edge of edges) {
        const ins = inEdges.get(edge.to) || [];
        ins.push(from);
        inEdges.set(edge.to, ins);
      }
    }

    // Power Iteration
    for (let iter = 0; iter < iterations; iter++) {
      const nextPr: Map<string, number> = new Map();
      let sinkSum = 0;

      nodeIds.forEach((id) => {
        if ((outDegrees.get(id) || 0) === 0) {
          sinkSum += pr.get(id) || 0;
        }
      });

      for (const id of nodeIds) {
        const node = this.nodes.get(id)!;
        const deltaMs = Math.max(0, now - node.timestamp);
        const timeDecay = Math.exp(-decayLambda * deltaMs);

        let incomingPr = 0;
        const ins = inEdges.get(id) || [];
        for (const inId of ins) {
          const inOutDeg = outDegrees.get(inId) || 1;
          incomingPr += (pr.get(inId) || 0) / inOutDeg;
        }

        const calculated = ((1 - damping) / N) + damping * (incomingPr + sinkSum / N) * timeDecay;
        nextPr.set(id, calculated);
      }

      pr = nextPr;
    }

    // Update node weights based on converged PageRank
    for (const [id, node] of this.nodes.entries()) {
      const rankScore = pr.get(id) || 0.01;
      node.weight = Math.max(1, rankScore * N * 50);
    }
  }

  /**
   * 0/1 Knapsack Dynamic Programming Token Budget Optimizer
   * Maximize information value under maxTokenBudget ceiling: O(N * W)
   */
  public optimizeTokenBudget(candidateNodes: GraphNode[], maxTokenBudget: number): GraphNode[] {
    const n = candidateNodes.length;
    if (n === 0 || maxTokenBudget <= 0) return [];

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

    // Backtrack optimal solution
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
