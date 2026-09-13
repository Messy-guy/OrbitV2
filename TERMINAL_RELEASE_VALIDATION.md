# Orbit Terminal Release Validation

This is the acceptance procedure for the native terminal reconstruction. It is
intentionally separate from unit tests: a CLI can spawn successfully while a
packaged desktop renderer is still broken.

## Source checks

Run from the repository root:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:terminal-frontend
npm run build
git diff --check
```

The Rust suite covers the canonical emulator, byte-preserving input, PTY EOF
classification, resize, scrollback, snapshots/patches, session replacement,
serialized writes, strict provider resolution, and remote session/agent
identity resolution. The frontend suite covers snapshot/patch ordering,
duplicate suppression, sequence-gap resync, input encoding, and selection.

## Release artifact checks

Build the Linux artifacts, then run the display-independent validation:

```bash
npx tauri build --bundles deb,rpm
npx tauri bundle --bundles appimage || ORBIT_REPACKAGE_APPIMAGE=1 npm run package:appimage

ORBIT_REQUIRE_APPIMAGE=1 \
ORBIT_VALIDATE_NATIVE_SMOKE=1 \
ORBIT_VALIDATE_APPIMAGE_SMOKE=1 \
ORBIT_VALIDATE_PROVIDER_MATRIX=1 \
npm run validate:terminal-release
```

The provider matrix must report every installed provider as `passed`; missing
providers must be explicit `skip` entries and must never become a shell.

## Packaged GUI gate

On CI, install `xvfb` and `xauth` first. The repository workflow already does
this on Ubuntu. Then run:

```bash
ORBIT_REQUIRE_APPIMAGE=1 \
ORBIT_VALIDATE_NATIVE_SMOKE=1 \
ORBIT_VALIDATE_APPIMAGE_SMOKE=1 \
ORBIT_VALIDATE_PROVIDER_MATRIX=1 \
ORBIT_VALIDATE_GUI_SMOKE=1 \
npm run validate:terminal-release
```

The GUI gate launches the release AppImage under Xvfb and fails on GTK/WebView
startup panics or an unexpected early exit. It is a startup gate, not a
substitute for the manual interaction matrix below.

## Manual Linux interaction matrix

Install the exact generated AppImage or Debian package on a Linux desktop with
the provider CLIs installed. For each supported provider—Antigravity, Codex,
OpenCode, KiloCode, Freebuff, Cline, GitHub Copilot, Kiro CLI, Claude, and
shell—verify:

1. Launch from the desktop menu.
2. Open a project workspace and launch the provider.
3. Observe its banner or prompt in the Canvas terminal.
4. Type a command and verify the response.
5. Resize the terminal and verify the CLI redraws correctly.
6. Use Ctrl-C and verify the process responds.
7. Detach/reopen the agent and verify the screen/scrollback reattaches.
8. Send a remote-control message and verify it arrives exactly once.
9. Stop and restart the agent.
10. Temporarily remove the executable from PATH and verify Orbit shows the
    resolved PATH/missing-provider diagnostic instead of starting Bash.

Remote-control verification must use the existing
`tauriService.sendAgentInput` boundary. It must not be implemented by reading
Canvas state, DOM contents, raw renderer events, or snapshot timing.

## Evidence to record

Record the Orbit version, Linux distribution, provider executable path, package
type, display backend, and pass/fail result for every provider. Attach the
native diagnostics output from `terminal_v2_diagnostics` for failures. Do not
declare the release accepted from Rust tests or the headless provider matrix
alone.
