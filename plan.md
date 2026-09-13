# Orbit Terminal Reconstruction Plan

Status: Source implementation complete; native release provider matrix passed on this host; CI now has a FUSE-independent AppImage fallback; packaged GUI matrix remains the final acceptance gate

Release acceptance procedure: `TERMINAL_RELEASE_VALIDATION.md`.

## Objective

Reconstruct Orbit's terminal subsystem with a native terminal architecture instead of continuing to patch the current PTY/event/xterm path. The new system must reliably render Antigravity, Codex, OpenCode, KiloCode, Freebuff, Cline, GitHub Copilot, Kiro CLI, Claude, and shell terminals in development and packaged Linux builds.

Remote control must remain functional throughout the reconstruction.

## Why the current architecture is being replaced

The current implementation combines PTY allocation, provider discovery, process lifecycle, startup delays, role prompt injection, terminal capability replies, output history, Tauri event broadcasting, frontend output matching, xterm.js parsing/rendering, and remote-control compatibility.

Production logs prove that affected CLIs can spawn and emit PTY output while the packaged terminal remains blank. The current system therefore lacks reliable ownership boundaries between process output, terminal state, IPC, and rendering.

The replacement establishes this model:

```text
AI CLI process
   │
   ▼
Native PTY session
   │ raw bytes
   ▼
Rust TerminalSession
   ├── terminal parser/state model
   ├── cursor, modes, scrollback
   ├── capability responses
   ├── input arbiter
   └── screen snapshots/patches
          │
          ▼
Tauri control IPC
          │
          ▼
Orbit Canvas/Grid Renderer
```

The frontend receives terminal state, not raw ANSI and not arbitrary global output events.

## Library decisions

### Rust

- `portable-pty` for native PTY allocation, resize, reader, writer, process groups, and child lifecycle. It is already a sound primitive and should not be replaced merely because the surrounding architecture is weak.
- `alacritty_terminal` as the canonical terminal emulator and VT parser. It provides terminal grid state, cursor state, modes, selection, scrollback, and parser integration in Rust.
- Dedicated Rust worker threads and `std::sync` channels for session scheduling
  and serialized input handling. Tauri's async runtime is used only to keep
  blocking command calls off the UI thread; a second async runtime is not
  needed inside the terminal subsystem.
- `parking_lot` for high-frequency terminal state synchronization.
- `tracing` and `thiserror` for structured lifecycle diagnostics.
- `serde` with a compact snapshot/patch representation for IPC.

`libghostty-vt` should be evaluated later for maximum terminal fidelity, but not made the first production dependency because its public API is still evolving.

### Frontend

Remove terminal-emulation responsibility from:

- `@xterm/xterm`
- `@xterm/addon-fit`
- frontend ANSI parsing
- frontend terminal capability responses
- React components that directly consume raw PTY output

Add:

- `TerminalGridView`
- Canvas or WebGL cell rendering
- `TerminalSessionStore`
- `useSyncExternalStore` for screen updates
- `ResizeObserver` for geometry only

The renderer paints glyphs, colors, attributes, wide characters, cursor, and selection. The browser must not parse ANSI escape sequences.

## Backend modules

Create an isolated subsystem:

```text
src-tauri/src/terminal/
  mod.rs
  service.rs          // global TerminalService
  session.rs          // one TerminalSession
  registry.rs         // session_id -> session
  pty.rs              // PTY allocation and process lifecycle
  launcher.rs         // typed provider launch specifications
  emulator.rs         // alacritty_terminal integration
  input.rs            // serialized local/remote input
  snapshots.rs        // screen snapshots and dirty patches
  protocol.rs         // attach, patch, exit, resync messages
  diagnostics.rs      // structured lifecycle metrics
```

The existing `PtyManager` should be retired after migration. It currently owns too many unrelated responsibilities.

Each `TerminalSession` owns:

- `session_id`, `agent_id`, provider, and workspace;
- child process and PTY master;
- one serialized input writer;
- canonical terminal emulator state;
- scrollback, cursor, modes, and exit metadata;
- monotonically increasing screen sequence;
- lifecycle state and renderer subscribers.

No component outside `TerminalSession` may write directly to the PTY.

## Session lifecycle protocol

```text
create_session(session_id)
  → create PTY
  → launch exact executable
  → start reader
  → start emulator
  → publish initial screen state

attach(session_id)
  → register subscriber
  → send complete screen snapshot
  → send future screen patches

input(session_id, bytes)
  → serialized input arbiter
  → PTY writer

resize(session_id, rows, cols)
  → resize PTY
  → resize emulator
  → publish screen snapshot

detach(session_id)
  → remove renderer subscriber
  → keep process alive

exit(session_id)
  → publish final state
  → retain scrollback and exit metadata
```

Attach must register the subscriber before returning the initial snapshot. This removes the startup race.

## Screen protocol

The frontend receives complete snapshots and dirty-row patches:

```ts
type ScreenPatch = {
  sessionId: string;
  sequence: number;
  rows: number;
  cols: number;
  dirtyRows: Array<{
    row: number;
    cells: TerminalCell[];
  }>;
  cursor: CursorState;
};
```

The protocol must support initial snapshots, ordered patches, duplicate suppression, sequence-gap resync, full snapshot recovery, exit/failure, resize, detach without termination, and reattach after frontend recreation.

PTY reads may be frequent, but screen updates should be batched at approximately 30–60 FPS. React must not repaint for every PTY read.

## Terminal emulator responsibilities

`alacritty_terminal` becomes the canonical terminal state owner for:

- ANSI/VT parsing;
- cursor movement;
- alternate screen;
- scroll regions;
- colors and attributes;
- Unicode and wide characters;
- bracketed paste;
- mouse reporting;
- keyboard modes;
- terminal title changes;
- device and mode queries;
- scrollback.

Terminal capability responses must be generated from emulator state and written through the session input arbiter. There must be no regex-based terminal query responder in `pty_manager.rs`.

## Provider launcher

Create a typed launcher:

```rust
struct LaunchSpec {
    executable: PathBuf,
    args: Vec<OsString>,
    cwd: PathBuf,
    env: Vec<(OsString, OsString)>,
    rows: u16,
    cols: u16,
}
```

Rules:

- never silently fall back to Bash;
- never infer a provider from a display name;
- log the resolved executable path;
- show searched PATH directories on failure;
- validate executable existence before opening the PTY;
- keep aliases in one registry;
- remove generic startup sleeps;
- allow only explicit, tested provider startup policies;
- keep terminal environment setup provider-neutral.

## Input architecture

All input passes through one serialized arbiter:

```text
local keyboard input ─┐
capability responses ──┼──> InputArbiter ──> PTY writer
remote control input ─┘
```

This preserves plain text, multiline input, control characters, Ctrl-C, paste data, remote input during startup, and simultaneous local/remote input.

## Remote-control protection

These boundaries must remain stable:

- `src/services/remoteControl/UniversalRemoteController.ts`
- `src/services/remoteControl/ptyDelivery.ts`
- `src/services/remoteControl/ptySpawnTracker.ts`
- `tauriService.sendAgentInput`
- existing remote session IDs
- existing remote message formats

Remote control must never depend on xterm DOM, React terminal state, canvas internals, renderer subscriptions, or screen-patch timing.

The eventual adapter should expose:

```ts
sessionHandle.write(bytes)
sessionHandle.resize(rows, cols)
sessionHandle.interrupt()
```

Remote-control migration happens only after parity tests pass.

## Frontend modules

Create:

```text
src/services/terminal/
  terminalTypes.ts
  terminalSessionStore.ts
  terminalProtocol.ts
  terminalInput.ts

src/components/terminal/
  TerminalGridView.tsx
  TerminalCanvasRenderer.ts
  TerminalSelection.ts
  TerminalCursor.ts
```

`AgentTerminal` becomes a small session host that creates/attaches a session, passes screen patches to the store, renders `TerminalGridView`, forwards input, sends resize events, and detaches without killing the process. It must not own PTY lifecycle, ANSI parsing, replay logic, capability responses, or provider logic.

## Migration phases

### Phase 0 — Freeze and measure

- Do not add more patches to the current renderer.
- Keep the current release as baseline.
- Capture normal-terminal output for every affected CLI.
- Create a deterministic fake TUI/echo process.
- Record PTY launch, read, parse, screen-update, attach, and render timings.

### Phase 1 — Native emulator prototype

Implement one isolated Rust session using `portable-pty`, `alacritty_terminal`, a fake TUI process, screen snapshots, resize, and an input arbiter. Do not route production UI yet.

### Phase 2 — Grid renderer

Build `TerminalGridView` for the fake TUI. Prove colors, cursor movement, alternate screen, Unicode, wide characters, resize, scrolling, hidden cursor, selection, and mouse reporting.

### Phase 3 — One real provider

Route only Antigravity through the new runtime and compare it with a normal terminal for banner, prompt, input, terminal queries, resize, Ctrl-C, exit, and reattach.

### Phase 4 — Provider matrix

Add Codex, OpenCode, KiloCode, Freebuff, Cline, GitHub Copilot, Kiro, Claude, and shell one at a time. All providers use the same PTY, emulator, input, snapshot, and renderer architecture.

### Phase 5 — Remote-control parity

Test plain text, multiline input, Ctrl-C, startup input, detach/reattach, concurrent local/remote writes, stale-process replacement, exit, and restart before changing remote-control internals.

### Phase 6 — Default and removal

Make the native runtime the default, remove the V1 renderer/stream and
frontend ANSI responsibilities, and retain only the legacy `PtyManager` as an
explicitly non-rendering PTY fallback for remote-control compatibility until a
real desktop parity run authorizes its removal. The native path no longer
depends on `agent-output`, the raw stream broker, xterm.js, or the legacy
renderer query bridge.

## Required tests

### Rust

- exact byte preservation, including invalid UTF-8;
- monotonic screen sequences;
- snapshot/patch ordering;
- duplicate suppression;
- sequence-gap resync;
- scrollback limits;
- attach before and after process output;
- detach without process termination;
- reattach without duplicate state;
- PTY resize;
- normal Linux PTY `EIO` exit;
- real reader failure;
- serialized concurrent writes;
- terminal capability responses;
- process-group interrupt and termination.

### Frontend

- full snapshot rendering;
- dirty-row patch rendering;
- duplicate patch suppression;
- gap detection/resync;
- cursor position;
- alternate screen;
- Unicode/wide characters;
- selection;
- resize;
- detach without killing the process;
- input delivered exactly once.

### Packaged Linux smoke matrix

For every provider:

1. Fresh desktop-menu launch.
2. Launch from a project workspace.
3. First visible banner/prompt.
4. Keyboard input.
5. Resize.
6. Ctrl-C and exit.
7. Close/reopen and reattach.
8. Remote-control input.
9. Missing executable diagnostics.
10. Release-build behavior compared with a normal terminal.

## Acceptance criteria

The rewrite is complete only when every supported CLI launches in the packaged desktop app, displays its prompt/banner, accepts input, renders full-screen TUI updates, survives resize, supports Ctrl-C, reattaches without losing state, works through remote control, reports launch failures visibly, and behaves the same in development and packaged Linux builds.

## Explicit non-goals

- Do not wrap every CLI in `script` permanently.
- Do not parse or strip ANSI in the transport layer.
- Do not silently fall back to a shell for a configured provider.
- Do not make remote control depend on the renderer or browser DOM.
- Do not maintain two independent terminal emulators without a synchronization contract.
- Do not claim success from Rust unit tests alone.
- Do not release until the packaged Linux matrix passes.

## Implementation record (2026-09-12)

Implemented in the repository:

- `src-tauri/src/terminal/` contains a native `TerminalService`, session
  registry, per-session PTY worker, strict provider launcher, serialized input
  arbiter, `alacritty_terminal` emulator, screen snapshot/dirty-row patch
  protocol, diagnostics counters, resize/interrupt/stop, and attach/detach.
- The Rust emulator parses ANSI/VT bytes, owns cursor/mode/color state, emits
  capability replies through the same session writer, and never requires the
  frontend to parse ANSI.
- `terminal_v2_*` Tauri commands provide start, attach, snapshot, input, resize,
  interrupt, stop, and detach. A synchronous snapshot command is included as a
  packaged-WebView recovery path in addition to the live Channel.
- `AgentTerminal` now uses the native screen protocol and Canvas grid renderer;
  xterm.js and its frontend capability bridge are no longer dependencies.
  It performs full-snapshot polling as a transport recovery path and resyncs on
  patch sequence gaps.
- Existing remote-control files were not edited. Existing Tauri input, resize,
  interrupt, process, and stop commands route to the native session when that
  session owns the agent and otherwise preserve the V1 behavior.
- Strict launch resolution produces an actionable missing-provider error with
  the augmented PATH and never silently becomes Bash.
- 26 Rust unit tests, including native remote-input-to-screen parity, the optimized Rust release binary, Debian/RPM bundle stages,
  TypeScript, Vite production build, and `git diff --check` pass.
- `npm run test:terminal-frontend` validates full snapshot/dirty-row patching,
  duplicate suppression, sequence-gap resync, input encoding, and scrollback
  selection behavior without requiring a browser or display server.

Remaining acceptance work:

- The current AppImage was packaged with the repository fallback using the
  extracted linuxdeploy/appimagetool runtime and passed the packaged native
  smoke/provider matrix through `--appimage-extract-and-run`. The full
  interactive provider/remote-control matrix still belongs on the real Linux
  desktop or CI runner.
- The V1 raw renderer/stream compatibility layer has now been removed. The
  legacy PTY manager remains only for non-rendering command fallback and is not
  used by `AgentTerminal`; removing that final fallback requires interactive
  remote-control parity on a real desktop.

## Implementation record (2026-09-13)

- Added bounded scrollback rows to full snapshots so a renderer reattach can
  recover terminal state without replaying raw PTY bytes.
- Classified PTY reader termination: Linux `EIO`/Windows broken-pipe is normal
  PTY EOF; all other reader errors terminate the session as `failed` and are
  counted separately.
- Added `terminal_v2_diagnostics` for packaged troubleshooting of launches,
  output bytes, screen updates, attaches, launch failures, and reader failures.
- Migrated the normal `start_agent_session` path and fresh handoff launches to
  `TerminalService`, so the UI and compatibility input/status paths share one
  native PTY session instead of spawning competing V1/native children.
- Preserved compatibility `agent-output`/`agent-status` emissions from the
  native session for existing conversation and relay consumers, while keeping
  the terminal renderer snapshot-driven and independent of raw output events.
- Restored per-profile `HOME`, XDG, Antigravity/Jetski, keyring, and
  `ORBIT_PROFILE_ID` isolation in the native launcher.
- Added a display-independent release smoke mode that starts a real native PTY,
  types into it, verifies rendered screen state, and verifies strict missing
  provider failure before GTK initialization.
- Added retained final snapshots/history so an exited session can still be
  reattached and inspected without depending on a live reader.
- Added an opt-in release provider matrix (`ORBIT_TERMINAL_PROVIDER_MATRIX=1`)
  that launches each configured provider through the real release binary,
  verifies rendered screen output, and stops the PTY cleanly. On this Linux
  host it passed Antigravity, OpenCode, Kilo, Freebuff, Cline, Copilot, Kiro,
  Claude, Codex, and shell.
- Removed the unused xterm.js packages and frontend capability bridge; the
  native Rust emulator is now the only terminal parser used by the renderer.
- Removed the unused raw-byte `terminal_stream` broker, attach/detach commands,
  and old frontend `TerminalSessionTransport`; the legacy PTY manager remains
  only as a remote/command fallback and no longer feeds a local renderer.
- The Canvas grid now paints retained scrollback above the live grid, keeps the
  viewport pinned to the newest output unless the user scrolls away, and maps
  selection/cursor coordinates across the combined display.
- Rebuilt the production target from the current tree. The optimized binary,
  Debian, RPM, and AppImage artifacts were produced/tested through the
  FUSE-independent packaging path.
- Stabilized `AgentTerminal` lifecycle dependencies so ordinary agent
  status/output refreshes cannot tear down and respawn a live native PTY.
- Rebuilt and revalidated the final release binary after that fix: the native
  provider matrix passed Antigravity, OpenCode, Kilo, Freebuff, Cline, Copilot,
  Kiro, Claude, Codex, and shell, and the release validator passed.
- The broader default provider matrix then exercised 15 installed providers,
  including Qwen, Mimo, Continue, Vibe, and Qoder; only uninstalled Goose,
  Muse, and Aider were reported as explicit skips.
- Added a CI-only packaged GUI smoke gate using `xvfb-run`; it checks that the
  release desktop binary initializes without GTK/WebView startup panic before
  the bounded probe exits. The full interactive installed-desktop matrix still
  belongs on a real Linux desktop.
- Added AppImage-native smoke validation using
  `--appimage-extract-and-run`; an earlier locally generated
  `Orbit_0.1.41_amd64.AppImage` passed the affected-provider matrix as its own
  packaged runtime and rendered its launcher surface on the real X11 session.
- The release workflow sets
  `APPIMAGE_EXTRACT_AND_RUN=1` and, if Tauri's AppImage bundle step still
  fails, runs `scripts/package-appimage.mjs`. That repository-owned fallback
  extracts the cached linuxdeploy AppImage and invokes the extracted binary,
  with an explicit AppImage runtime, so AppImage creation does not depend on
  FUSE on the runner.
- Added a native remote-control parity test that resolves a remote request by
  agent identity, writes through the same serialized PTY arbiter used by local
  input, and verifies the resulting text in the canonical rendered snapshot.

## Industry references

- [portable-pty](https://docs.rs/portable-pty/latest/portable_pty/)
- [portable-pty MasterPty API](https://docs.rs/portable-pty/latest/portable_pty/trait.MasterPty.html)
- [alacritty_terminal](https://docs.rs/alacritty_terminal/latest/alacritty_terminal/)
- [xterm.js parser hooks](https://xtermjs.org/docs/guides/hooks/)
- [xterm.js supported sequences](https://xtermjs.org/docs/api/vtfeatures/)
- [Tauri frontend communication](https://v2.tauri.app/develop/calling-frontend/)
- [Tauri Channel API](https://docs.rs/tauri/latest/tauri/ipc/struct.Channel.html)
- [Ghostty and libghostty-vt](https://github.com/ghostty-org/ghostty)
- [WezTerm PTY/multiplexer flow](https://github.com/wezterm/wezterm/blob/main/mux/src/lib.rs)
