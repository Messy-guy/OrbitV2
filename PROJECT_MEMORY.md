# OrbitV2 Project Memory

Last reviewed: 2026-09-13

## What this project is

Orbit is a local-first desktop command center for running and coordinating multiple AI coding agents against software workspaces. A workspace maps to a repository/project. Agents appear as movable tiles in a spatial canvas, each backed by a real native PTY session. Orbit also maintains shared project context, checkpoints, Git state, and auditable handoffs between agents.

The product is designed to remove repeated re-explanation when switching between heterogeneous CLIs such as Antigravity (`agy`), Claude Code, Codex, OpenCode, and a shell.

## Technology and runtime boundaries

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS.
- State: Zustand stores under `src/stores/`.
- Desktop shell/backend: Tauri 2.
- Native runtime: Rust under `src-tauri/src/`.
- Terminal UI: the native terminal path uses Rust `alacritty_terminal`, bounded
  scrollback/screen snapshots, and a frontend Canvas grid renderer. The old raw
  stream and xterm renderer are removed; the legacy PTY manager remains only as
  a non-rendering remote/command fallback.
- Spatial agent layout: `react-grid-layout`; resizable windows also use `react-rnd`.
- Persistence: local JSON at `~/.config/orbit/orbit_state.json` (with a local fallback if `HOME` is unavailable).
- Mobile companion: Expo/React Native app under `apps/mobile/`; it is a separate client surface, not the desktop runtime.
- No cloud/LLM dependency is required for the core context engine.

## Main execution flow

1. `src/App.tsx` loads workspaces, applies theme tokens, connects the desktop relay, then gates the UI through authentication and onboarding.
2. `Home` selects or creates a workspace; `WorkspaceView` hosts the project workspace and agent canvas.
3. `useWorkspaceStore` manages workspaces, spaces, active selection, launcher view mode, and pinned projects.
4. `useAgentStore` loads agents/sessions, initializes Tauri event listeners, batches PTY output into terminal logs, and coordinates agent actions.
5. `AgentTerminal.tsx` starts/attaches the native terminal session, consumes
   Rust screen snapshots/dirty-row patches, polls full snapshots as a packaged
   WebView recovery path, forwards keyboard/paste bytes through the native
   input arbiter, and resizes the PTY when its container changes.
6. `src/services/tauri.service.ts` is the frontend IPC boundary. It safely falls back for browser preview paths when Tauri is unavailable.
7. Rust `PtyManager` remains the V1/remote-compatible PTY runtime. The new
   `src-tauri/src/terminal/` subsystem owns migrated AgentTerminal sessions:
   one worker owns PTY reads, the child, the emulator, serialized writes, and
   screen-state publication.
8. `runtime/provider_specs.rs` owns provider-neutral terminal behavior (direct TUI mode and startup delay); executable resolution remains in `PtyManager`.
9. `runtime/session_supervisor.rs` records lifecycle phase, first/last output, byte counts, terminal-query responses, and reader failures without becoming part of remote input control.
10. Rust commands in `src-tauri/src/commands.rs` expose discovery, storage, Git, context, handoff, native terminal snapshots, and PTY operations through Tauri IPC.

## Terminal reconstruction status

The production blank-panel issue was traced to a renderer attach/transport race,
not to the affected CLIs failing to spawn: installed-build logs showed child
spawn, PTY reads, and `agent-output` emission for Antigravity and the other
affected providers. The new AgentTerminal renderer now consumes canonical Rust
screen snapshots and dirty-row patches through Tauri Channels, with synchronous
full-snapshot polling as a packaged WebView recovery path. Remote-control files
and the `send_agent_input` writer boundary were intentionally not changed.

Known provider launch failures now surface as errors instead of silently
starting Bash. This makes packaged PATH problems diagnosable, but packaged
Linux installation testing is still required before claiming provider-matrix
completion.

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
- `runtime/provider_specs.rs` and `runtime/session_supervisor.rs`: provider-neutral launch behavior and observable PTY lifecycle state.

## Frontend conventions

- Prefer existing service wrappers and Zustand actions over direct `invoke` calls inside components.
- Use `isTauriAvailable()` when adding a desktop-only operation so the Vite/browser preview remains usable.
- Keep terminal output event-driven; avoid adding synthetic banners or simulated process/tool states to the real runtime.
- Keep PTY output as raw terminal data. Capability-query replies may be written back to the PTY, but must not be injected into `agent-output`.
- Treat `src/services/remoteControl/ptyDelivery.ts`, `ptySpawnTracker.ts`, `UniversalRemoteController.ts`, and `tauriService.sendAgentInput` as a protected input boundary. Rendering/lifecycle changes must not change their semantics.
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

## Production PTY troubleshooting memory

The observed Linux production failure was a blank xterm for some full-screen CLIs even though the child process was alive and worked under `script -qec` in a normal terminal. Logs showed successful executable resolution, PTY creation, child spawn, and session insertion. This means “process spawned” is not equivalent to “terminal rendered.” The important production-sensitive layers are:

- packaged GUI environment and augmented `PATH`;
- PTY dimensions and `TERM`/`COLORTERM` capability negotiation;
- output listener attachment and startup scrollback replay;
- native screen-state publication and Canvas grid rendering.

The runtime now uses a stateful bounded terminal-query responder so escape queries split across PTY reads are handled, and emits `ready` only after first output. Reader failures emit `agent-status` with `phase: failed`. These diagnostics are intentionally additive and do not alter remote-control input delivery.

## Native terminal reconstruction status (2026-09-12)

The new runtime is implemented in `src-tauri/src/terminal/`:

- `TerminalService` and `TerminalRegistry` manage session ownership.
- `TerminalSession` owns the PTY child, reader, serialized writer, emulator,
  lifecycle, screen sequence, and renderer subscribers on one worker.
- `alacritty_terminal` is the canonical ANSI/VT state machine. Capability
  replies are generated by the emulator and written through `InputArbiter`.
- `protocol.rs` publishes serializable snapshots, dirty-row patches, cursor
  state, and lifecycle events. `terminal_v2_snapshot` provides synchronous full
  snapshot recovery in addition to the live Tauri Channel.
- `launcher.rs` resolves all supported providers through the augmented GUI PATH
  and fails visibly when a configured CLI is missing; it never silently starts a
  shell for an AI provider.
- `AgentTerminal.tsx` now renders `TerminalGridView`/`TerminalCanvasRenderer`
  including retained scrollback, and no longer gives the browser responsibility
  for ANSI parsing.
- Remote-control source files remain unchanged. Shared Tauri input, resize,
  interrupt, process, and stop commands bridge to a native session when one
  owns the agent and retain the old PTY fallback otherwise.

Validation completed: 26 Rust tests pass, including native remote-input-to-screen
parity; `npm run test:terminal-frontend` validates snapshot/patch ordering,
gap recovery, input encoding, and selection; `npm run build` passes,
`npm run validate:terminal-release` passes, and `git diff --check` passes. A
fresh optimized release binary, Debian/RPM bundles, and an AppImage produced
through the FUSE-independent fallback passed native smoke. The opt-in release
provider matrix passed 15 installed providers, including Antigravity,
OpenCode, KiloCode, Freebuff, Cline, Copilot, Kiro, Claude, Codex, Qwen, Mimo,
Continue, Vibe, Qoder, and shell; Goose, Muse, and Aider were reported as
missing rather than silently mapped to a shell. Normal starts and fresh
handoffs now use the native runtime, while the old runtime remains only as a
non-rendering compatibility fallback. The local environment cannot run the GTK desktop
binary because it has no usable display session; the real installed Linux GUI
interaction matrix remains required before declaring the issue fixed.

## Current repository caveat

The worktree contains the production PTY hardening described above. `AgentTerminal.tsx` also contains a user-owned theme change; preserve it when making further terminal edits. Do not publish a release automatically from a dirty worktree: the release script commits and pushes changes.

The final release rebuild also hardens `AgentTerminal` lifecycle dependencies:
status/output object refreshes no longer cause a live native PTY to be detached
and respawned. The rebuilt binary and Debian/RPM bundles passed the native
provider matrix after this change. CI now also installs Xvfb and runs an
optional bounded packaged-GUI startup smoke, while the real installed desktop
interaction matrix remains a required Linux-desktop acceptance step. The
broader default native matrix currently passes 15 installed providers and
reports Goose, Muse, and Aider as missing rather than silently falling back.
The obsolete raw-byte terminal stream and frontend transport were removed;
only the native screen protocol feeds the local renderer.
The generated `Orbit_0.1.41_amd64.AppImage` passed the affected-provider native
smoke through `--appimage-extract-and-run`; it was also launched on the real
X11 display, where the `Orbit` window and launcher surface rendered without
GTK/WebView startup errors. The latest session/profile/history hardening is
included in the rebuilt ELF and Debian/RPM artifacts, and the AppImage
packaging fallback uses an explicit runtime. The release workflow sets
`APPIMAGE_EXTRACT_AND_RUN=1` for
FUSE-independent AppImage creation and validation. If Tauri's AppImage step
still fails, the workflow invokes `scripts/package-appimage.mjs`; that
repository-owned fallback extracts cached linuxdeploy and creates the image
from `Orbit.AppDir` without requiring FUSE. Full interactive provider and
remote-control GUI coverage remains the final acceptance step.

## Useful starting points

- Release validation and the remaining desktop interaction matrix:
  `TERMINAL_RELEASE_VALIDATION.md`.
- Product/architecture notes: `context/project-overview.md`, `context/architecture.md`, `agents.md`.
- Historical phase/build notes: `context/build-plan.md`, `context/session_summary.md`.
- Core types: `src/types/orbit.ts`.
- Frontend entrypoint: `src/App.tsx`.
- IPC boundary: `src/services/tauri.service.ts`.
- Native entrypoint: `src-tauri/src/lib.rs`.
- Persistence: `src-tauri/src/storage.rs`.
- PTY runtime: `src-tauri/src/runtime/pty_manager.rs`.
- Context engine: `src-tauri/src/context.rs`.

## Project Health Snapshot & Cross-Agent Continuity (2026-09-19)

- **Architectural Decision (DEC-002)**: Project Health Snapshot is designed as a deterministic projection over Orbit's existing `EventReplayEngine` and `EventStore` (`~/.orbit/projects/<slug>/`) combined with live Git working-tree inspection. It reuses the authoritative `repository.scanned` tech stack, active task directives, unresolved issues, and active architectural decisions, ensuring provider-agnostic consistency without introducing a second project-memory system.
- **Error/Debugging Diagnosis**: An initial implementation attempted to extract architectural decisions and unresolved issues from the legacy `readProjectMemory` helper (`cwd/.orbit/DECISIONS.md`), which produced empty collections because Orbit's canonical state lives in the event ledger (`EventStore`). The implementation was corrected to replay from `EventStore` via `EventReplayEngine`, verifying 100% data recovery.
- **Rejected Approach**: Parsing ad-hoc markdown files from `cwd/.orbit/` was rejected because it fragments project memory, bypasses event-sourced verification levels and provenance attribution, and fails when `.orbit/` markdown files are absent or out of sync.
- **Unresolved Issue (ISSUE-042)**: Monorepo multi-target sub-package health isolation. The root `ProjectHealthSnapshot` evaluates root-level manifests (`package.json`, `Cargo.toml`) and directories, but does not yet recursively evaluate independent sub-package git submodules or manifest health graphs in nested monorepo packages (e.g. `apps/mobile`). Safe to defer to future monorepo workspace enhancement.

