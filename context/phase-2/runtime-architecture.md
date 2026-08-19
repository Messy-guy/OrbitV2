# Orbit Desktop — Phase 2/2B Runtime Architecture

## 1. Overview
Orbit Desktop Phase 2B implements a **native pseudo-terminal (PTY) execution engine** using `portable-pty`. Instead of standard piped standard I/O (`Stdio::piped()`), each agent tile connects to an isolated, true pseudo-terminal pair (Master/Slave).

```
                         ORBIT DESKTOP
                              │
                              ▼
                       React / TypeScript
                              │
                         Tauri IPC (`invoke` / `listen`)
                              │
                              ▼
                       ORBIT RUNTIME
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
      Session Manager    PTY Manager      Discovery Engine
      (Orbit State)     (portable-pty)   (Host CLI Binaries)
             │                │                │
             │         ┌──────┴──────┐         │
             ▼         ▼             ▼         ▼
           AGY      CLAUDE         CODEX     SHELL
            │         │              │         │
           PTY       PTY            PTY       PTY
            │         │              │         │
            └─────────┴──────────────┴─────────┘
                              │
                       Agent Grid UI
```

---

## 2. Core Modules

### 1. PTY Manager (`src-tauri/src/runtime/pty_manager.rs`)
- Allocates native PTY pairs via `portable_pty::native_pty_system().openpty(PtySize { rows, cols, ... })`.
- Sets standard terminal environment variables (`TERM=xterm-256color`, `COLORTERM=truecolor`).
- Spawns agent CLI child processes inside slave PTYs (`pair.slave.spawn_command(cmd)`).
- Takes master PTY writer for keystrokes, commands, and interactive input.
- Reads raw chunks from master PTY reader and streams them via `orbit://agent-output` events, preserving ANSI escape codes, cursor positioning, and spinners.
- Exposes `resize` to update terminal window dimensions (`master.resize`).
- Exposes `interrupt` to write `\x03` (`Ctrl+C`) to the running process.
- Exposes `terminate` to kill the child and close the PTY pair.

### 2. PTY Session Model (`src-tauri/src/runtime/session.rs`)
- Encapsulates:
  - `session_id`: Unique identifier for the agent session
  - `workspace_id`: Attached project workspace
  - `agent_id`: Agent tile identifier
  - `pid`: Real OS process ID
  - `writer`: Thread-safe PTY writer
  - `master`: Thread-safe PTY master
  - `child`: Thread-safe child process handle
  - `rows`, `cols`: Terminal dimensions

### 3. Agent Discovery Engine (`src-tauri/src/discovery.rs`)
- Proactively scans host system paths and standard locations:
  - `agy` (Google Antigravity CLI v2.4.0)
  - `claude` (Claude Code CLI v2.1.x)
  - `codex` (OpenAI Codex CLI)
  - `opencode` (OpenCode CLI)
  - `bash` (Interactive host shell)
- Retrieves version strings and dynamically badges availability in the Add Agent modal.

### 4. Local Storage Manager (`src-tauri/src/storage.rs`)
- Persists workspace definitions, agent configurations, and session records to `~/.config/orbit/orbit_state.json`.

### 5. Frontend IPC Layer (`src/services/tauri.service.ts` & `agent.service.ts`)
- TypeScript IPC wrappers with error handling and fallback capabilities for browser testing.
- `useAgentStore` listens reactively to `orbit://agent-output` and updates terminal line buffers.
- `AgentTerminal.tsx` provides the interactive user-facing developer terminal UI with ANSI rendering, command history, and shortcuts.
