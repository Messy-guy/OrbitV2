# OrbitV2 Project Memory

Last reviewed: 2026-09-10

## What this project is

Orbit is a local-first desktop command center for running and coordinating multiple AI coding agents against software workspaces. A workspace maps to a repository/project. Agents appear as movable tiles in a spatial canvas, each backed by a real native PTY session. Orbit also maintains shared project context, checkpoints, Git state, and auditable handoffs between agents.

The product is designed to remove repeated re-explanation when switching between heterogeneous CLIs such as Antigravity (`agy`), Claude Code, Codex, OpenCode, and a shell.

## Technology and runtime boundaries

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS.
- State: Zustand stores under `src/stores/`.
- Desktop shell/backend: Tauri 2.
- Native runtime: Rust under `src-tauri/src/`.
- Terminal UI: `@xterm/xterm` with `@xterm/addon-fit`.
- Spatial agent layout: `react-grid-layout`; resizable windows also use `react-rnd`.
- Persistence: local JSON at `~/.config/orbit/orbit_state.json` (with a local fallback if `HOME` is unavailable).
- Mobile companion: Expo/React Native app under `apps/mobile/`; it is a separate client surface, not the desktop runtime.
- No cloud/LLM dependency is required for the core context engine.

## Main execution flow

1. `src/App.tsx` loads workspaces, applies theme tokens, connects the desktop relay, then gates the UI through authentication and onboarding.
2. `Home` selects or creates a workspace; `WorkspaceView` hosts the project workspace and agent canvas.
3. `useWorkspaceStore` manages workspaces, spaces, active selection, launcher view mode, and pinned projects.
4. `useAgentStore` loads agents/sessions, initializes Tauri event listeners, batches PTY output into terminal logs, and coordinates agent actions.
5. `AgentTerminal.tsx` renders the live xterm canvas, forwards keystrokes to the backend, restores scrollback, and resizes the PTY when its container changes.
6. `src/services/tauri.service.ts` is the frontend IPC boundary. It safely falls back for browser preview paths when Tauri is unavailable.
7. Rust `PtyManager` allocates a native PTY, resolves the provider executable, starts the child process in the workspace directory, streams `agent-output` and `agent-status`, tracks scrollback, and handles input, resize, interrupt, stop, and reattach.
8. Rust commands in `src-tauri/src/commands.rs` expose discovery, storage, Git, context, handoff, and PTY operations through Tauri IPC.

## Important domain model

The canonical shared-memory entities are defined in `src/types/orbit.ts`:

- `Workspace` / `Space`: project container and optional working canvases.
- `Agent`: provider, model/profile, role, operational mode, status, current session, and optional parent/worker relationship.
- `Session` and `Message`: persisted conversation/session metadata; terminal output is kept separately as `TerminalLine` history.
- `ProjectContext`: current task, goal, progress, active work, decisions, issues, notes, architecture, and relevant files.
- `Checkpoint`: deterministic progress snapshot including decisions, issues, changed files, and originating agent.
- `ContextPackage`: schema-versioned, provider-agnostic handoff payload with Git state, relevant history, estimated tokens, and a formatted instruction.
- `HandoffRecord`: durable audit record linking source/target agents and the full context package.

Agent roles are operational constraints, not merely labels: architect is plan-only, reviewer is audit-only, and implementer/code is intended for TDD implementation. The Rust PTY launcher injects role directives and the frontend also tracks operational modes (`plan`, `code`, `audit`).

## Context and handoff behavior

`src-tauri/src/context.rs` builds ContextPackage v1 deterministically. It formats current task, progress, decisions, changed files, known issues, Git state, and relevant history; estimates tokens at roughly four characters per token; and applies simple line-based secret redaction for common API key, secret, token, and password assignments.

The expected handoff chain is:

`source agent -> checkpoint/Git inspection -> ContextPackage -> target PTY -> HandoffRecord`

The context engine should remain provider-agnostic and local. When changing its schema, update the Rust models, TypeScript types, formatting/serialization, UI preview, persistence, and tests together.

## Rust backend responsibilities

- `runtime/pty_manager.rs`: PTY lifecycle, process reattachment, native signals, output history, role-aware command startup, and event emission.
- `discovery.rs`: executable discovery and version detection.
- `git.rs`: branch, HEAD, changed files, and recent commits.
- `context.rs`: redaction, token estimation, formatted handoff instructions, and package construction.
- `storage.rs`: in-memory mutex-protected state mirrored to JSON; deleting a workspace also deletes its agents, sessions, checkpoints, contexts, and handoffs.
- `commands.rs`: Tauri command façade.
- `runtime/activity_detector.rs` and `session_events.rs`: runtime activity/session projection support.

## Frontend conventions

- Prefer existing service wrappers and Zustand actions over direct `invoke` calls inside components.
- Use `isTauriAvailable()` when adding a desktop-only operation so the Vite/browser preview remains usable.
- Keep terminal output event-driven; avoid adding synthetic banners or simulated process/tool states to the real runtime.
- Preserve the distinction between terminal mode and structured chat mode.
- New persisted fields must be compatible with existing JSON state and legacy data.
- UI components are grouped by feature under `src/components/`; shared primitives live under `src/components/ui/`.

## Verification and development

Typical checks:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Desktop development is normally launched with the Tauri host wrapper from `package.json` (`npm run dev:desktop` / `npm run tauri:host`), while `npm run dev` starts the Vite frontend. The project’s documented verified host CLIs are Antigravity `agy` and Claude Code `claude`; executable resolution should remain environment-aware rather than hard-coding only those paths.

## Current repository caveat

At the time of this review, Git reports one pre-existing modified file: `src/components/agent/AgentTerminal.tsx`. It was not changed while creating this memory. Treat that worktree change as user-owned and inspect it before modifying terminal behavior.

## Useful starting points

- Product/architecture notes: `context/project-overview.md`, `context/architecture.md`, `agents.md`.
- Historical phase/build notes: `context/build-plan.md`, `context/session_summary.md`.
- Core types: `src/types/orbit.ts`.
- Frontend entrypoint: `src/App.tsx`.
- IPC boundary: `src/services/tauri.service.ts`.
- Native entrypoint: `src-tauri/src/lib.rs`.
- Persistence: `src-tauri/src/storage.rs`.
- PTY runtime: `src-tauri/src/runtime/pty_manager.rs`.
- Context engine: `src-tauri/src/context.rs`.

