# ORBIT DESKTOP — MASTER ARCHITECTURE & AGENT GUIDELINES

## Current State: Phase 3 Completed + Native PTY & Real CLI Runtime Verified

Orbit is an industrial, multi-agent desktop runtime built with Tauri 2, React, TypeScript, Rust, and `@xterm/xterm`. It orchestrates host CLI coding agents (Antigravity `agy`, Claude Code `claude`, Codex, OpenCode, Shell) inside isolated native pseudo-terminals with shared project context handoff.

---

## 1. Core Architecture

```
React 18 Frontend (@xterm/xterm Canvas)
       │
       ▼ (Tauri IPC invoke: 'start_agent_session', 'send_agent_input', 'resize_agent_terminal')
Tauri 2 Rust Backend (src-tauri/src/runtime/pty_manager.rs)
       │
       ▼ (portable_pty native master/slave allocation)
Host Linux PTY Subsystem (/dev/pts/*)
       │
       ▼ (Inherits environment variables: PATH, HOME, USER, LANG, TERM=xterm-256color)
Real CLI Agent Processes:
  • Antigravity CLI: /home/leo/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin/agy
  • Claude Code CLI: /home/leo/.local/bin/claude
  • Shell Terminal: /bin/bash -i
```

---

## 2. Key Modules & Implementations

### Frontend (`src/`)
- **Terminal Emulator (`src/components/agent/AgentTerminal.tsx`)**:
  - Direct `@xterm/xterm` canvas with `@xterm/addon-fit` and `ResizeObserver`.
  - Raw bidirectional I/O keystroke listener (`term.onData`).
  - Automatic history buffer replaying on tile mount.
  - Case-insensitive provider binding.
- **Spatial Agent Grid (`src/components/agent/AgentGrid.tsx`)**:
  - Multi-agent canvas powered by `react-grid-layout`.
  - Grid layout persistence and dynamic tile resizing.
- **Context Engine & Handoff (`src/components/context/`, `src/components/handoff/`)**:
  - Context Package generation with token estimation and diff indexing.
  - Project checkpoints and intelligent agent-to-agent prompt compilation.

### Backend Runtime (`src-tauri/`)
- **PTY Manager (`src-tauri/src/runtime/pty_manager.rs`)**:
  - Native master/slave pseudo-terminal allocation via `portable_pty`.
  - Raw byte streaming over `agent-output` and `agent-status` Tauri events.
  - In-memory scrollback buffer (`output_history`) for instant replay.
  - Native signal dispatching (SIGINT / Ctrl+C, window resize / SIGWINCH, process termination).
- **Agent Discovery (`src-tauri/src/discovery.rs`)**:
  - System `PATH` and flatpak host executable resolution.
  - Live version detection (`agy --version`, `claude --version`).
- **Storage & State (`src-tauri/src/storage.rs`)**:
  - JSON persistence at `~/.config/orbit/orbit_state.json`.

---

## 3. Verified Host Binaries

| Provider | Path | Host Version |
|---|---|---|
| **Antigravity (`agy`)** | `/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin/agy` | `1.1.13` |
| **Claude Code (`claude`)** | `/home/leo/.local/bin/claude` | `2.1.233` |
| **Shell Terminal** | `/bin/bash` | Native Linux Shell |

---

## 4. Operational Instructions

To launch Orbit Desktop:
```bash
# Start Vite development server
npm run dev

# Launch Native Tauri Desktop Application
flatpak-spawn --host bash -l -c 'cd /home/leo/Desktop/personal_projects/OrbitV2/src-tauri && cargo run'
```
