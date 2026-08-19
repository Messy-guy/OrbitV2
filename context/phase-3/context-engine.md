# Orbit Desktop — Phase 3 Context Engine Specification

## 1. Overview
Orbit acts as the **Project Context Layer** for multi-agent software development. Coding agents (Antigravity, Codex, Claude Code, OpenCode) execute within their own isolated PTY harnesses, while Orbit observes, structures, persists, and orchestrates shared project memory across agents.

---

## 2. Core Entities

### `ProjectContext`
Shared, structured project state for an entire workspace:
- `currentTask`: The immediate active objective
- `goal`: High-level project milestone
- `progress`: 0–100% completion metric
- `activeWork`: Module currently being patched
- `decisions`: Architectural decisions with timestamps and author agents
- `issues`: Known blockers and severity tags
- `architecture`: High-level system structure definition
- `relevantFiles`: List of active/modified project files

### `Checkpoint`
A deterministic snapshot of milestone progress:
- `name`: Checkpoint title (e.g. `Checkpoint #7 — WebSocket Reconnect`)
- `task`: Explicit task description
- `progress`: Summary of completed work
- `decisions`: Architectural choices made during the milestone
- `knownIssues`: Open blockers
- `changedFiles`: Changed files automatically captured from Git worktree
- `agentName`: Originating agent

### `ContextPackage` (v1 Schema)
A compact, serializable, provider-agnostic instruction payload transferred between agents:
```json
{
  "schemaVersion": 1,
  "sourceAgent": "ANTIGRAVITY",
  "sourceSessionId": "sess-agy-04",
  "targetAgent": "CODEX",
  "workspaceId": "ws-music-app",
  "workspaceName": "Music App",
  "projectPath": "/home/leo/projects/music-app",
  "currentTask": "Fix playlist synchronization across connected peers",
  "progress": "WebSocket reconnect logic implemented with exponential backoff",
  "decisions": [
    "Zustand store used for client playlist state slice",
    "WebSocket protocol version negotiation handshake used"
  ],
  "changedFiles": [
    { "path": "src/store/playlist.store.ts", "status": "modified" },
    { "path": "src/socket/playlist.socket.ts", "status": "modified" }
  ],
  "knownIssues": [
    "Reconnect state is not persisted in local storage on page refresh"
  ],
  "gitState": {
    "currentBranch": "main",
    "headCommit": "a82f31c",
    "modifiedFiles": [...]
  },
  "estimatedTokens": 2140
}
```

### `HandoffRecord`
Historical audit trail of context transfers:
- `sourceAgentId` / `targetAgentId`
- `status`: `sent` | `accepted` | `failed`
- `contextPackage`: Full serialized payload
- `createdAt`: Timestamp
