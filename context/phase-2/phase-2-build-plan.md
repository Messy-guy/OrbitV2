# Orbit Desktop — Phase 2/2B Build Plan & Verification

## Phase 2A: Local Runtime & Discovery
- [x] Host Agent Binary Discovery (`agy`, `claude`, `codex`, `opencode`, `bash`)
- [x] Local JSON State Persistence (`~/.config/orbit/orbit_state.json`)
- [x] Tauri IPC Commands Registration (`detect_agents`, `get_workspaces`, `create_workspace`, etc.)
- [x] Frontend Hybrid Service Abstraction (`TauriAgentService`, `TauriWorkspaceService`, `TauriSessionService`)

## Phase 2B: True PTY Runtime
- [x] Integrated `portable-pty = "0.8"` dependency in `src-tauri/Cargo.toml`
- [x] Implemented `PtySession` runtime model (`src-tauri/src/runtime/session.rs`)
- [x] Implemented `PtyManager` with native pseudo-terminal allocation (`src-tauri/src/runtime/pty_manager.rs`)
- [x] Replaced piped stdio execution with true PTY master/slave pairs
- [x] Real-time ANSI stream preservation over `orbit://agent-output`
- [x] Dynamic terminal window resizing (`resize_agent_terminal`)
- [x] Interactive keystrokes and command execution via PTY master writer (`send_agent_input`)
- [x] True `SIGINT` / `Ctrl+C` interrupt handling via PTY writer (`interrupt_agent_session`)
- [x] Process lifecycle monitoring and termination (`stop_agent_session`)
- [x] Dynamic host detection badges in Add Agent modal
- [x] Multi-agent spatial canvas with interactive terminal buffers in Agent Tiles

## Verification Checklist
- [x] `npm run build` succeeds (0 errors)
- [x] `cargo build` succeeds (0 errors)
- [x] Native app boots and connects to host PTY runtime
