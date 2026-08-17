# Architecture: Orbit Desktop

## 1. Phase 1 Frontend Architecture
Orbit Desktop Phase 1 is built with:
- **Framework**: Tauri 2 + Vite + React 18/19 + TypeScript
- **Styling**: Tailwind CSS + CSS Variables (`#09090B`, `#13151A`, `#7C8CFF`)
- **State Management**: Zustand Stores
  - `workspaceStore`: Current active workspace, workspace lists, metadata
  - `agentStore`: Grid tiles, active agents, layouts, sessions, chat messages
  - `contextStore`: Project context metrics, architectural decisions, issues, changed files
  - `checkpointStore`: Checkpoint creation & history
  - `handoffStore`: Transfer modal state, context selection, generated previews, animation orchestration
  - `activityStore`: Project-wide event timeline
  - `uiStore`: Modals, bottom panels (Context, Activity, Files, Git, Sessions), notifications
- **Layout Engine**: `react-grid-layout` configured with responsive breakpoints and draggable/resizable tile constraints.

## 2. Service Layer & Abstraction
To keep UI components agnostic of the underlying mock vs real implementations, all operations go through TypeScript interfaces:
- `AgentService` (`MockAgentService`)
- `SessionService` (`MockSessionService`)
- `ContextService` (`MockContextService`)
- `HandoffService` (`MockHandoffService`)
- `WorkspaceService` (`MockWorkspaceService`)

## 3. Future Tauri Engine (Phase 2 Conceptual Architecture)
```
Orbit Desktop
  │
React UI (Zustand + Radix + Grid)
  │ (Tauri IPC Bridge / Events)
Orbit Rust Core
  ├── Agent Engine (PTY Spawner, CLI Process Manager, CLI Adapter protocols)
  ├── Context Engine (Tree-sitter AST, Git diff parser, Vector/LLM summarizer)
  └── Session Store (Local SQLite / RocksDB)
```
In Phase 1, the UI communicates strictly with the TypeScript Mock Service layer.
