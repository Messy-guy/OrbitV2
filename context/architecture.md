# Architecture: Orbit Desktop

## 1. System Architecture

```
                         ORBIT DESKTOP
                              │
               ┌──────────────┴──────────────┐
               │                             │
          Agent Grid                    Context Layer
               │                             │
        ┌──────┼──────┐              ┌───────┼────────┐
        ▼      ▼      ▼              ▼       ▼        ▼
       AGY    CODEX  CLAUDE       Project  Session  Checkpoint
        │      │      │           Context  Context
        │      │      │               │
       PTY    PTY    PTY              │
        │      │      │               ▼
        └──────┴──────┘         Context Package (v1)
                                      │
                                      ▼
                                Handoff Service
                                      │
                              ┌───────┼────────┐
                              ▼       ▼        ▼
                             AGY    CODEX    CLAUDE
```

---

## 2. Frontend Layer (React 18 + TypeScript + Zustand)
- **Agent Grid Engine:** Spatial canvas hosting multiple interactive agent tiles (`react-grid-layout`).
- **Interactive Terminal UI:** Live ANSI-highlighted developer terminal (`AgentTerminal.tsx`) with command history, shortcuts, and PID badges.
- **Context Layer:** Project context panel, deterministic checkpoint creation, and context sharing modal with preview.
- **Hybrid Service Abstraction:** Seamlessly switches between native Tauri IPC and web preview fallback.

---

## 3. Rust Core Runtime (`src-tauri/src/`)
- **PTY Manager (`runtime/pty_manager.rs`):** Allocates pseudo-terminals with `portable-pty`, managing interactive child sessions (`agy`, `claude`, `codex`, `opencode`, `bash`).
- **Git Inspector (`git.rs`):** Safely extracts current branch, HEAD hash, modified/staged/untracked files, and recent commits.
- **Deterministic Context Engine (`context.rs`):** Constructs versioned `ContextPackage` objects with secret redaction and token estimation (~4 chars/token).
- **Local Storage (`storage.rs`):** Durable local state persistence in `~/.config/orbit/orbit_state.json`.
- **Tauri IPC Command Layer (`commands.rs` & `lib.rs`):** Exposes all discovery, PTY control, checkpoint, and handoff commands.
