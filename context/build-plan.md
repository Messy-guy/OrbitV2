# Orbit Desktop — Master Build Plan & Tracking

## Phase 1: Frontend Product Validation
- [x] Application Shell & Slate-Graphite Industrial Design System
- [x] Workspace Management Hub
- [x] Spatial Agent Grid (`react-grid-layout`)
- [x] Agent Tile UI & Dual View (Terminal vs Structured Chat)
- [x] Context & Handoff Modals & Drawers

## Phase 2: Local Desktop Runtime & True PTY
- [x] Native Host Agent Discovery (`agy`, `claude`, `codex`, `opencode`, `bash`)
- [x] True PTY Runtime Layer with `portable-pty`
- [x] Real-time ANSI I/O Streaming over Tauri IPC
- [x] Direct `@xterm/xterm` Canvas Integration with VT100 / ANSI Support
- [x] Terminal Resizing, `SIGINT` (Ctrl+C), and Process Lifecycle Management
- [x] Scrollback Buffer Replay and Host Environment Inheritance
- [x] Local JSON State Persistence (`~/.config/orbit/orbit_state.json`)

## Phase 3: Project Context Engine & Intelligent Agent Handoff
- [x] Structured Project Context Model (`ProjectContext`, `Checkpoint`, `ContextPackage`, `HandoffRecord`)
- [x] Safe Git State Inspector (`branch`, `HEAD`, `modified_files`, `recent_commits`)
- [x] Deterministic Checkpoint Creation & History
- [x] Versioned `ContextPackage` (v1 Schema) with Secret Redaction & Token Estimation
- [x] Provider-Agnostic Context Handoff Execution (AGY → Checkpoint → ContextPackage → Target Agent PTY)
- [x] Context Panel with Live Context, Checkpoints, and Handoff Audit History
- [x] Verified 0 AI/Cloud dependency for core context engine

## Verification Checklist
- [x] Frontend `npm run build`: 0 errors
- [x] Rust backend `cargo check` / `cargo build`: 0 errors
- [x] Real host executable verified: `/home/leo/.var/app/com.visualstudio.code/data/orbit/engines/antigravity/bin/agy` (v1.1.13)
- [x] Real host executable verified: `/home/leo/.local/bin/claude` (v2.1.233)
- [x] Interactive terminal session active on native slave PTY (`/dev/pts/*`)
