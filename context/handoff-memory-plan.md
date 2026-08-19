# Orbit Universal Agent Context Extraction & Session Memory Plan
*Architectural Blueprint & Execution Roadmap: Turning raw multi-agent terminal/chat streams into token-efficient knowledge graphs and distilled handoff context for any AI CLI.*

---

## 1. Vision & Objectives

Inspired by the core strengths of the `leo-Agent` architecture (`MASTER.md`, `BOOT.md`, `SESSION.md`, `PARAM.md`), Orbit will provide **universal conversation extraction, intelligent distillation, and cross-agent memory persistence** for any CLI or chat-based AI engine (`Antigravity`, `OpenCode`, `Claude Code`, `Codex`, `Gemini`, etc.).

### Primary Goals:
1. **Universal Extraction**: Automatically extract rich context from both **TUI/PTY terminal streams** (xterm/raw ANSI) and **structured Chat sessions** regardless of the underlying CLI tool.
2. **Deterministic Token-Efficient Distillation**: Synthesize raw terminal logs and chat threads into compact, high-signal narrative summaries (Goal, Actions Taken, Errors Encountered, Decisions, and Concrete Next Steps) — reducing token consumption by ~70-85%.
3. **Persistent Project Memory (`.orbit/memory/`)**:
   - `SESSION.md` — Continuous running narrative of all agent sessions.
   - `DECISIONS.md` — Architectural choices and technical rationales made across sessions.
   - `BUGS.md` — Active & resolved issues tracked across agent iterations.
   - `HANDOFF.md` — Active handoff package delivered directly to target agents.
4. **Universal Handoff Delivery**: Generic zero-friction delivery mechanism that works seamlessly with any interactive CLI/TUI without crashing readline buffers (`ENAMETOOLONG`) or terminating live sessions.

---

## 2. Core Architecture & Graph DSA Model

### 2.1 The Project Knowledge Graph ($G = (V, E)$)
Instead of treating context as a flat text dump, Orbit models the workspace as a directed, attributed Knowledge Graph:

- **Vertices ($V$)**:
  - $V_{task}$: Tasks / Goals (`id`, `title`, `status`, `timestamp`)
  - $V_{file}$: Modified & Referenced Code Files (`path`, `imports`, `modCount`)
  - $V_{decision}$: Architectural & Technical Decisions (`rationale`, `author`)
  - $V_{issue}$: Bugs & Blockers (`errorTrace`, `severity`, `status`)
  - $V_{turn}$: Dialogue & Terminal Turn Artifacts (`prompt`, `toolCalls`, `summary`)

- **Edges ($E$) with Weights ($w \in [0, 1]$)**:
  - `TOUCHED` ($V_{task} \to V_{file}$): Weight proportional to edit recency and diff size.
  - `DEPENDS_ON` ($V_{task} \to V_{decision}$): Causal relationship.
  - `BLOCKED_BY` ($V_{task} \to V_{issue}$): Active obstacle link.
  - `PRODUCED` ($V_{turn} \to V_{task} \mid V_{decision} \mid V_{issue}$).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SOURCE AGENT (Agent A)                          │
│     (Antigravity / OpenCode / Claude Code / Codex / Custom CLI / Chat)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                        Capture Raw Session Stream
                    (xterm output history / chat messages)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL SESSION EXTRACTOR & GRAPH BUILDER              │
│                        (src/services/distiller.service.ts)                  │
│                                                                             │
│  1. ANSI Strip & Stream Sanitizer                                           │
│  2. Key Turn & Intent Parser (Regex / AST / Token Stream)                   │
│  3. Incremental Graph Ingestion (Add Nodes & Edges to Adjacency List)       │
│  4. Graph Algorithms Engine (BFS Traversal, PageRank Scoring, Knapsack)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PERSISTENT MEMORY MANAGER                             │
│                  (.orbit/memory/ & Rust Storage Engine)                     │
│                                                                             │
│  • .orbit/memory/SESSION.md   <- Appends structured session summary         │
│  • .orbit/memory/DECISIONS.md <- Appends extracted/confirmed decisions     │
│  • .orbit/memory/BUGS.md      <- Tracks open vs resolved issues             │
│  • .orbit/HANDOFF.md          <- Writes optimal subgraph briefing           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                       Single-Line Prompt Delivery
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TARGET AGENT (Agent B)                          │
│     "Orbit Handoff from Agent A: Continue task. See .orbit/HANDOFF.md"      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Concrete DSA & Graph Algorithms Applied

| Algorithm / DSA Structure | Complexity | Purpose in Orbit Handoff | Token & Speed Impact |
|---|---|---|---|
| **Adjacency List Graph Representation** | $O(V + E)$ space, $O(1)$ edge check | Lightweight in-memory representation of project relationships | Instant graph queries with minimal RAM footprint. |
| **Bounded Breadth-First Search (BFS Subgraph Extraction)** | $O(V + E)$ where depth $d \le 2$ | Starting from the current active task node, traverses only immediate dependencies (files touched, related bugs, active decisions). | **Cuts context noise by 75%** by pruning disconnected history. |
| **Degree Centrality & Decay Scoring** | $O(V)$ | Weights nodes by connection count + exponential time decay: $Score(n) = deg(n) \cdot e^{-\lambda \Delta t}$. | Prioritizes the most crucial files/issues touched in the last session. |
| **Topological Sort on Task Dependencies** | $O(V + E)$ with Kahn's Algorithm / DFS | Resolves order of execution for multi-step tasks without circular dependencies. | Delivers clear, non-conflicting chronological steps to Agent B. |
| **0/1 Knapsack (Dynamic Programming Token Budget Optimizer)** | $O(N \cdot W)$ where $W = \text{Max Token Budget}$ | Given a token ceiling (e.g. 1,500 tokens), greedily/optimally selects the subset of nodes/summaries that maximize total information value. | **Guarantees zero token waste and avoids window overflow.** |
| **Rolling Hash (Rabin-Karp / MinHash) for Delta Diffing** | $O(L)$ linear string matching | Compares current session terminal logs with previous session logs to extract only NEW events. | Avoids redundant re-processing of already summarized turns. |

---

## 4. Step-by-Step Implementation Roadmap

### Phase 1: Universal Conversation & Terminal Stream Extraction
- [ ] Create `UniversalSessionExtractor` in `src/services/extractor.service.ts`:
  - **Terminal Mode**: Ingests raw PTY history from `tauriService.getAgentTerminalHistory(agentId)`, strips ANSI escape codes, applies rolling hash to filter repetitive redraws/spinners, and reconstructs clean prompt-response turns.
  - **Chat Mode**: Ingests messages array from `agent.store.ts` (`useAgentStore.getState().messages[sessionId]`).
- [ ] Implement Regex / Heuristic detectors for common AI CLI markers across tools (Antigravity, OpenCode, Claude Code, Codex, bash).

### Phase 2: In-Memory Knowledge Graph & Subgraph Distillation Engine
- [ ] Build `ContextGraph` data structure (`src/services/graph.service.ts`):
  - Adjacency list representation with typed nodes (`Task`, `File`, `Decision`, `Issue`, `Turn`).
  - Graph insertion methods: `addTurn()`, `linkFile()`, `linkDecision()`, `linkIssue()`.
- [ ] Implement Subgraph Extraction & Knapsack Budget Optimizer (`src/services/distiller.service.ts`):
  - Run depth-2 BFS from the current active task.
  - Calculate centrality scores for all visited nodes.
  - Apply 0/1 Knapsack to pack highest-signal items into the target token budget (~1,200 - 2,000 tokens).
  - Format the resulting subgraph into markdown.

### Phase 3: Persistent Memory Engine (`.orbit/memory/`)
- [ ] Extend Rust backend (`src-tauri/src/commands.rs` & `src-tauri/src/storage/`):
  - On every handoff or manual session wrap, automatically write/update:
    - `.orbit/memory/SESSION.md`: Chronological log of agent iterations.
    - `.orbit/memory/DECISIONS.md`: Cumulative list of architectural decisions.
    - `.orbit/memory/BUGS.md`: Discovered bugs and their resolution status.
    - `.orbit/HANDOFF.md`: Dedicated active briefing for the receiving agent.
- [ ] Add a `Wrap Session` / `Save Checkpoint` button in the UI for instant manual synchronization to disk.

### Phase 4: UI Enhancements & Modal Context Preview
- [ ] Update `ShareContextModal.tsx`:
  - Show the distilled conversation summary alongside file diffs and decisions.
  - Allow user to review, edit, or toggle inclusion of the conversation summary.
  - Display accurate token breakdown: `[Files: 420 tokens] [Decisions: 180 tokens] [Conversation Summary: 350 tokens]`.
- [ ] Update `ContextPanel.tsx` to visualize the persistent memory state (`SESSION.md`, `DECISIONS.md`, `BUGS.md`).

### Phase 5: Verification & End-to-End Testing
- [ ] Test cross-agent handoffs across all engine combinations:
  - **Antigravity → OpenCode**
  - **OpenCode → Claude Code / Antigravity**
  - **Terminal / Shell → OpenCode / Antigravity**
- [ ] Verify that receiving agents read `.orbit/HANDOFF.md`, accurately pick up where the previous agent left off, and avoid repeating completed steps.
