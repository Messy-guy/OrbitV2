# Orbit CLI Rendering Investigation Handoff (Historical)

> Current source of truth: [`plan.md`](./plan.md) and
> [`PROJECT_MEMORY.md`](./PROJECT_MEMORY.md). This handoff records the
> original production investigation and earlier xterm/V2 transport attempts;
> the current renderer is the Rust `alacritty_terminal` snapshot/patch path.

Last updated: 2026-09-11

This document is the handoff for the production Linux CLI rendering problem. It records what was observed, what changed, what was released, and where the next agent should continue.

## User-visible issue

In development mode, Orbit can spawn interactive CLI agents and display their terminal UI. In the packaged Linux desktop application, some agents open an Orbit terminal panel but show a blank black xterm area with only a cursor or no visible CLI UI.

Initially this was reported for Antigravity (`agy`), OpenCode, Kiro CLI, and similar TUIs. The user later confirmed that OpenCode, KiloCode, Freebuff, Cline, and GitHub Copilot were also not visibly spawning in release `v0.1.38`.

The same CLI works in a normal terminal. For example, `agy` renders its banner and prompt when run through `script` in a regular terminal.

## Important distinction

The issue is not currently proven to be executable discovery or process creation.

Production logs from `v0.1.38` show that the affected providers created live child processes and that Orbit received PTY output:

| Provider | Example PID | First PTY output |
|---|---:|---:|
| OpenCode | 15168 | 205 bytes |
| KiloCode | 16715 | 205 bytes |
| Freebuff | 16799 | 7 bytes |
| Cline | 18155 | 205 bytes |
| GitHub Copilot | 18377 | 11 bytes |
| Antigravity | 10324 | 18 bytes |

The affected processes stayed alive or were reattached. This means “spawned” and “rendered” are separate states. The current leading hypotheses are:

1. Provider-specific terminal environment detection or capability negotiation stalls after initial control sequences.
2. PTY output is emitted by Rust but is not reaching or painting in the frontend xterm instance.
3. A provider emits only initial screen-control bytes and waits for a capability response not covered by Orbit’s responder.

Do not assume the process failed merely because the xterm is blank.

## Architecture that must be preserved

Orbit uses the standard desktop terminal shape:

```text
CLI process <-> native PTY slave/master <-> Rust reader/writer <-> Tauri events <-> xterm.js
```

- Rust uses `portable-pty`.
- `AgentTerminal.tsx` owns the xterm renderer.
- PTY output is emitted through `agent-output`.
- User keyboard input goes through `tauriService.sendAgentInput` to the PTY.
- Resize, interrupt, stop, and reattach are handled by `PtyManager`.
- Remote control sends input through the same PTY input boundary.

Protected remote-control files and semantics:

- `src/services/remoteControl/UniversalRemoteController.ts`
- `src/services/remoteControl/ptyDelivery.ts`
- `src/services/remoteControl/ptySpawnTracker.ts`
- `tauriService.sendAgentInput`
- `PtyManager::write_with_fallback`

Do not replace or bypass the PTY input path while fixing rendering. Rendering diagnostics and provider environment changes are safe; changing input routing can break remote control.

## Changes already implemented

### Provider runtime specifications

`src-tauri/src/runtime/provider_specs.rs` now centralizes provider-neutral behavior:

- Whether the provider is a direct interactive CLI/TUI.
- Startup delay before sending an initial prompt.
- Whether multiplexer variables should be removed.
- `TERM_PROGRAM` compatibility value.

Current special cases include:

- `opencode`: direct CLI, 2200 ms startup delay.
- `antigravity`/`agy`: direct CLI, 800 ms startup delay, `TERM_PROGRAM=alacritty`.
- `codex`, `claude`: direct CLI, 800 ms delay.
- `mimo`: 5000 ms delay.
- `vibe`: 1800 ms delay.
- KiloCode, Freebuff, Cline, Copilot, Goose, Kiro, Qwen, Muse, Qoder: direct TUI behavior with 2000 ms delay.

For interactive providers, `TMUX` and `STY` are removed before spawn. `TERM=xterm-256color`, `COLORTERM=truecolor`, and the provider-specific `TERM_PROGRAM` are set.

The Antigravity terminal metadata change was motivated by a known community workaround where clearing multiplexer state and setting a compatible terminal program helped Antigravity terminal detection. This is a hypothesis-driven compatibility fix, not yet proven on the user’s installed `v0.1.39` build.

### PTY lifecycle and diagnostics

`src-tauri/src/runtime/session_supervisor.rs` records:

- Session phase.
- Creation and first/last output timestamps.
- Output byte count.
- Terminal capability response count.
- Reader errors.

`AgentStatusEvent` now supports an optional `phase` field. The frontend understands booting, ready, failed, exited, and reattached states.

The reader now:

- Detects first PTY output and emits `phase=ready`.
- Handles terminal queries split across arbitrary PTY reads using a bounded rolling buffer.
- Answers several DSR, Kitty, OSC color, XTGETTCAP, DECRQM, device-attribute, and window-size queries.
- Treats Linux PTY `EIO` on slave close as normal shutdown instead of a reader failure.
- Emits a frontend-visible failed status for non-normal reader errors.

The latest local diagnostics also log, without logging terminal contents:

- First eight PTY read chunk sizes and escape counts.
- First eight coalesced `agent-output` event sizes.
- Terminal capability response byte counts.

Relevant log markers:

```text
[ORBIT PTY] Read output ...
[ORBIT PTY] Emitting output event ...
[ORBIT PTY] Responding to terminal capability query ...
[ORBIT PTY] First output received ...
```

### Frontend behavior

`src/components/agent/AgentTerminal.tsx`:

- Subscribes to output before spawning/reattaching the session.
- Writes live output directly to xterm.
- Replays backend scrollback during startup if live output has not arrived.
- Converts backend `phase=failed` into a visible terminal error.

The existing user-owned theme modification in this file must be preserved.

## Releases and current git state

### `desktop-v0.1.37`

Included earlier frontend scrollback/startup replay work and `PROJECT_MEMORY.md`.

### `desktop-v0.1.38`

Commit: `a9606e0`

Included the first PTY lifecycle, capability responder, provider spec, and failure diagnostics implementation. The user installed this version and confirmed the blank/absent UI issue remained.

### `desktop-v0.1.39`

Commit: `6500ca5`

Tag and `origin/main` currently point to this release. It includes the latest provider environment normalization and PTY output diagnostics. GitHub Actions release build was triggered and the worktree was clean after publishing.

Important: `v0.1.39` has not yet been confirmed by the user on the device. Do not claim the issue is solved until it is installed and tested.

After the user’s latest `v0.1.39` reproduction, the new diagnostics showed that Antigravity read and emitted eight chunks, including a 1,201-byte chunk. This confirms the Rust PTY reader and Tauri output emission are active in production. The remaining suspected boundary is xterm startup hydration/rendering.

A local follow-up change in `AgentTerminal.tsx` now hydrates xterm once from authoritative backend scrollback before user input. It resets the startup xterm buffer and writes the history with a render callback, so an initial control-only event cannot permanently disable replay. Live output and PTY input continue unchanged. `npm run build` passes for this follow-up; it has not yet been released.

## Known production evidence

The user’s Linux environment included:

- `DISPLAY=:1`
- `WAYLAND_DISPLAY` empty
- `XDG_SESSION_TYPE=x11`
- Antigravity at `/home/leo/.local/bin/agy`
- OpenCode under the NVM bin directory
- KiloCode executable as `kilo`
- Freebuff executable as `freebuff`
- Cline executable as `cline`
- GitHub Copilot executable as `copilot`

The resolver mappings in `PtyManager` cover these names. The `v0.1.38` logs showed successful PTY creation, child spawn, writer acquisition, session insertion, and first output for the affected providers.

There was also a `Failed to initialize GTK` panic when `/usr/bin/orbit-desktop --version` was manually invoked from a shell context. Do not use that alone as the rendering root cause: it may be a second launch with a different GUI environment, and the user’s desktop-launched application was visible. Reproduce with the actual desktop launcher environment before changing GTK/Tauri initialization.

The local `npm run tauri:build` wrapper cannot run on this machine because `flatpak-spawn` is unavailable. Running `npx tauri build` directly successfully compiled the optimized binary and staged bundles, but final AppImage bundling failed because `linuxdeploy` was unavailable. GitHub Actions is the intended package builder.

## Next debugging procedure

After the user installs `v0.1.39`:

1. Clear the old log before launching Orbit:

   ```bash
   : > /tmp/orbit-debug.log
   ```

2. Launch Orbit from the normal desktop launcher, not with `--version`.

3. Spawn one affected provider at a time: OpenCode, KiloCode, Freebuff, Cline, GitHub Copilot, then Antigravity.

4. While the blank panel is visible, collect:

   ```bash
   tail -300 /tmp/orbit-debug.log
   ps -eo pid,ppid,stat,cmd | rg 'orbit|agy|opencode|kilo|freebuff|cline|copilot'
   ```

5. Classify each provider:

   - `Child spawned` but no `Read output`: PTY child startup/environment issue.
   - `Read output` but no `Emitting output event`: Rust coalescer issue.
   - `Emitting output event` but blank UI: Tauri event delivery, AgentTerminal matching, or xterm painting issue.
   - Repeated `Responding to terminal capability query` with no later output: incomplete or incorrect provider terminal negotiation.
   - Visible `PTY reader failed`: inspect the exact error; ignore normal Linux `EIO` only when the child is exiting.

6. Compare a working Codex session and a failing provider in the same installed build. This is more useful than comparing development and production without equivalent logs.

## Likely next code areas

If logs show output events are emitted but the UI remains blank:

- Instrument `AgentTerminal.tsx` to count matching `agent-output` callbacks and xterm writes.
- Verify the event payload’s `agentId` and `sessionId` against the current agent/session.
- Verify startup replay is not being disabled by a control-only first chunk.
- Check whether the xterm instance is disposed/recreated after the listener attaches.

If logs show providers stop after terminal queries:

- Capture control-sequence classifications, not user content.
- Compare the provider’s expected terminal responses with xterm.js behavior.
- Prefer a tested capability-response module over adding more ad hoc patterns in `pty_manager.rs`.

If logs show command resolution failure:

- Log the resolved executable path, provider, and whether the fallback shell was selected.
- Keep executable discovery separate from PTY rendering.
- Do not silently fall back to a shell for a configured CLI without emitting a clear error; that can look like a spawn failure.

## Verification already completed

The following passed before `desktop-v0.1.39` was released:

```text
cargo test --manifest-path src-tauri/Cargo.toml runtime::
5 tests passed

npm run build
passed
```

These tests validate provider specs, lifecycle bookkeeping, split terminal queries, and duplicate-query suppression. They do not replace an installed-device test of the actual third-party TUIs.

## V2 transport implementation in the current worktree

The reconstruction is now wired into the local terminal path:

- `src-tauri/src/runtime/terminal_stream.rs` provides a session-keyed raw-byte
  broker with monotonic sequence numbers, bounded replay, live subscribers,
  exit frames, and a clear error when a requested replay point fell out of the
  ring buffer.
- `src-tauri/src/commands.rs` exposes `attach_terminal_stream` and
  `detach_terminal_stream` through Tauri 2 Channels.
- `src/components/agent/AgentTerminal.tsx` attaches before starting the PTY and
  renders only the session stream. `src/services/terminalV2/terminalTransport.ts`
  ignores duplicates and reattaches on sequence gaps.
- `src/services/terminalV2/terminalCapabilities.ts` moves local capability
  replies to xterm parser hooks. The legacy Rust responder remains a fallback
  only when no local renderer is subscribed, protecting headless/remote-only
  sessions.
- Known AI providers no longer silently become an interactive Bash fallback if
  their executable is absent from the packaged PATH; the launch error is now
  visible in the terminal error panel.

Validation after this change:

```text
cargo test --manifest-path src-tauri/Cargo.toml runtime::   6 passed
npm run build                                               passed
```

The next required proof is a packaged Linux build installed on the target
device. A source build passing cannot prove the GitHub-produced package has the
same desktop environment or that every third-party CLI is installed and
discoverable there.

## Safety rules for the next agent

- Do not modify remote-control input delivery while fixing terminal rendering.
- Do not run `npm run release:desktop` again without explicit user authorization.
- Do not use a destructive git reset or discard user changes.
- Preserve the user-owned `AgentTerminal.tsx` theme changes.
- Do not claim 100% resolution until `v0.1.39` or a later build is installed and the affected providers visibly render.
- Keep terminal contents out of persistent debug logs; log sizes, phases, provider names, and control-sequence categories instead.
