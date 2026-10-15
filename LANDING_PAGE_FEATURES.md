# Orbit Landing Page: Feature and Content Brief

This document translates the current Orbit repository into landing page content. It is intended as a source of truth for product copy and page planning. Feature descriptions below reflect code and project documentation in this repository; they are not a guarantee that every integration is available on every OS or release channel.

## Product summary

**Orbit is a command center for running and coordinating AI coding agents across software projects.** The desktop app brings agent sessions, terminals, project context, Git state, and handoffs into a workspace. A companion mobile app can connect to the desktop relay to monitor projects and interact with sessions. The Orbit CLI provides terminal-based session and context commands.

### Suggested positioning

> Run your coding agents in one workspace. Keep the project context moving with the work.

Alternate short description:

> Orbit brings multiple coding-agent sessions, project context, and handoffs into one developer workflow.

## Who it is for

- Developers who use more than one AI coding agent or CLI.
- Developers switching between planning, implementation, review, and shell work.
- Developers who want to see concurrent agent sessions and project changes together.
- Developers who want to check on desktop work from a paired mobile device.

## Landing page sections and feature content

### 1. Hero: one workspace for your agents

**Message:** Run and monitor different coding-agent CLIs in project workspaces from one desktop app.

**Show:** The real desktop workspace with multiple agent tiles or terminals, a project name, session status, and a visible context or Git panel. Prefer an actual current app capture over a fabricated product screenshot.

**Suggested headline:** Your AI coding agents, working in one place.

**Suggested supporting copy:** Orbit brings agent sessions, project context, and developer controls together around the codebase you are working on.

**CTA:** Download Orbit (link to the actual release/download page once confirmed). Secondary CTA: Explore the workflow.

### 2. Run agents side by side

- Create project workspaces and launch agent sessions in the selected project.
- View sessions as tiles on a spatial canvas; resize and arrange the workspace.
- Use supported installed agent CLIs or a shell terminal.
- Assign work modes/roles such as architect, implementer, and reviewer where supported by the current runtime.
- Inspect session activity and terminal output, and send input to a session.
- Spawn worker agents from an existing agent through the desktop agent workflow.

**Suggested copy:** Keep planning, implementation, review, and shell sessions visible together while they work on the same project.

**Accuracy note:** Orbit launches local CLI programs; provider accounts, model access, and some CLI setup are separate. Do not imply Orbit includes model usage or subscriptions.

### 3. Bring your own agent CLI

The installer registry and runtime support discovery for a broad set of providers. Names represented in the repository include Claude Code, OpenAI Codex, Google Antigravity (`agy`), OpenCode, KiloCode, Freebuff, Cline, GitHub Copilot CLI, Goose, Kiro, Qwen Code, MiMo Code, Muse, Mistral Vibe, Qoder, and a shell. Project documentation also describes Continue and Aider in provider validation contexts.

- Detect installed agent executables and show their availability/version when discoverable.
- The desktop agent picker has install/uninstall actions for providers represented in the installer registry.
- Agent support depends on the CLI being installed and available to Orbit; provider launch behavior differs.

**Suggested copy:** Use the coding-agent CLIs you already work with. Orbit discovers supported tools on your machine and can help install selected providers from the desktop app.

**Accuracy note:** Verify the current installer list, commands, operating-system support, and integration test status before displaying a provider logo wall. Do not state that every provider is verified or works identically. Some listed installer commands are platform-specific or experimental.

### 4. Keep project context with the work

Orbit's project context model and UI cover:

- Current task, goal, active work, and progress.
- Architectural decisions, notes, and known issues/blockers.
- Relevant/changed files and Git branch/state.
- Saved checkpoints for a point-in-time project state.
- Handoff history between agent sessions.

**Suggested copy:** Give agents a shared project brief: what the task is, what has been decided, what changed, and what still needs attention.

### 5. Hand work from one agent to another

- Select a source and target agent/session in the desktop handoff flow.
- Build a handoff preview from project context, session history, relevant files, and Git state.
- Choose a continuity intent and add a user directive/note.
- Compile a target-oriented brief and deliver it into the target session through the handoff workflow.
- Record handoff information in project state/history.
- The CLI also supports handoff commands between sessions.

**Suggested copy:** Move from one agent to another with a structured brief, so the next session can pick up the task with its decisions and next steps.

**Accuracy note:** The desktop handoff uses extraction/distillation plus project and Git context. Avoid absolute claims such as “zero context loss,” “100% deterministic,” or guarantees that every transcript detail is included. The actual handoff is a selected/compiled context package, not necessarily a full conversation replay.

### 6. See and manage Git changes

- Read the active branch, HEAD, changed/staged/untracked files, and recent commits through the desktop Git integration.
- Inspect diffs, stage/unstage files, discard changes, and commit changes.
- Include Git state and changed files in relevant context/handoff views.
- Import a GitHub repository as a workspace; the import flow also supports signed-in/private repository scenarios through configured GitHub auth or the local GitHub CLI.

**Suggested copy:** Keep the code changes agents are making close to the sessions doing the work.

**Accuracy note:** Do not suggest Orbit replaces GitHub or all Git clients. GitHub import and source-control actions are desktop capabilities.

### 7. Check in from mobile

The companion app is built with Expo/React Native and includes:

- Pairing with Orbit Desktop using a QR payload or six-digit code.
- A workspace/project list with active and issue filters.
- Live connection and project/agent status views.
- Project details grouped into active, ready, and recent/historical sessions.
- A session terminal/detail view for reading activity and sending input.
- Pause/stop controls for agents and a swarm-level emergency control.
- An approvals inbox to authorize or deny pending actions.
- Notification registration and deep-linking support in native mobile builds.
- A sync screen to connect or disconnect a workstation.

**Suggested copy:** Pair your phone with Orbit Desktop to check project and agent status, respond to approval requests, and send input while away from your desk.

**Accuracy notes:** Mobile is a companion to a running desktop/relay, not a standalone environment for running coding CLIs. The app uses a relay service; the implementation defaults to a hosted relay URL unless configured otherwise. Do not describe pairing as local-Wi-Fi-only or promise the desktop can be controlled while it is closed. Push notification behavior depends on native build, permissions, and relay/device configuration.

### 8. Work from the terminal with Orbit CLI

The repository contains an `orbit` CLI with:

- Session listing, launching, switching, and detaching.
- Project context, Git context, health/status commands.
- Skill listing and enable/disable commands.
- Cross-agent/session handoff support.
- Skill projection into provider-specific project configuration files for supported providers.

**Suggested copy:** Prefer the terminal? Use Orbit CLI to switch sessions, inspect project context, manage skills, and hand work between agents.

**Accuracy notes:** The CLI has a local package/build entrypoint in this repository. A public installer or distribution channel was not verified here. Do not publish shell-install, npm, Cargo, or Homebrew commands until those packages and release instructions are real and tested.

### 9. Skills and reusable instructions

- The desktop has a skill browser and agent skill picker.
- The skill aggregation service supports catalog/import paths, including GitHub-based skill import.
- The CLI has a registry and projection logic that writes enabled skill instructions to provider-native configuration locations (including Claude, Codex, Antigravity, and OpenCode paths).

**Suggested copy:** Reuse project instructions across supported agents and project them into the formats those tools understand.

**Accuracy note:** Do not imply every skill source or every provider format is available in every app surface. Keep this as a secondary section unless the skill workflow is a primary product differentiator for the target audience.

### 10. Desktop developer tools

The desktop app also includes:

- Workspace creation, selection, and GitHub import.
- Project file explorer and in-app file viewing/editing, with an option to open in an external editor.
- Activity and session views.
- Theme/accent and settings controls, keyboard shortcuts, and update notification UI.
- Local workspace/session/context persistence through the desktop runtime.

These are useful supporting capabilities but should not crowd the main multi-agent, context, handoff, and mobile story.

## Suggested page flow

1. Hero: multi-agent command center, product visual, download CTA.
2. Problem: agent workflows are split across tools and context must be repeated.
3. Side-by-side sessions: canvas and real terminal UI.
4. Agent compatibility: verified provider list and bring-your-own CLI explanation.
5. Context handoff: show what is included and how source-to-target transfer works.
6. Git/project state: changed files, diffs, and context alongside sessions.
7. Mobile companion: pairing, monitoring, approvals, and remote input.
8. CLI and skills: terminal-oriented workflow and reusable instructions.
9. Setup/how it works: install Orbit, install/sign into desired provider CLIs, open a workspace, launch agents, pair mobile if desired.
10. FAQ, platform/download links, privacy details, and final CTA.

## Short feature list for a compact landing page

- Multi-agent desktop workspace with movable session tiles.
- Native terminal sessions for supported local coding-agent CLIs and shell.
- Agent discovery and in-app install actions for selected providers.
- Shared project task, decisions, issues, files, and Git context.
- Checkpoints and structured agent-to-agent handoffs.
- Git status, diffs, staging, and commits.
- GitHub repository import.
- Mobile pairing, project/session monitoring, agent controls, and approvals.
- CLI session management, context commands, handoffs, and skill controls.
- Skill catalog/import and provider-specific projection paths.

## Claims to avoid until independently verified

- “Air-gapped,” “fully offline,” or “your data never leaves your machine.” The desktop core has local persistence/context behavior, but the app includes auth and a relay service, and mobile uses that relay.
- “Local Wi-Fi relay” as the only mobile transport.
- “Zero lag,” fixed FPS/latency, or memory/performance figures not backed by published measurement.
- “Zero context loss,” “100% deterministic handoff,” or an assertion that every part of the transcript is transferred.
- “Every coding agent works out of the box” or “all providers fully supported.” Availability depends on provider CLI installation, OS/runtime support, and verification.
- “One-click install for every agent and OS.” The UI exposes installer actions for selected providers, but commands and platform support vary.
- “Unlimited agents” or specific subscription/pricing promises without current approved plan details. The UI currently applies a two-agent limit for users not marked Pro; this is not itself a complete pricing specification.
- Public CLI install commands or app-store availability unless the corresponding release channels are live.
- Usage, customer, benchmark, security certification, or uptime statistics absent from repository evidence.

## Release/content checklist before publishing

- Confirm actual desktop release downloads and supported operating systems.
- Confirm mobile release state and official iOS/Android download destinations.
- Verify provider support and installer commands against current OS builds.
- Confirm pricing, plan limits, and whether the non-Pro two-agent UI limit is current.
- Confirm the relay/network architecture and publish an accurate privacy/security explanation.
- Test mobile pairing, remote input, pause/stop, approvals, and notifications in release builds.
- Replace placeholder or synthetic marketing visuals with current product captures or clearly labeled illustrations.
- Confirm CLI packaging/distribution before publishing installation instructions.

## Repository references

- Product overview: `context/project-overview.md`
- Architecture and runtime notes: `agents.md`, `PROJECT_MEMORY.md`, `context/architecture.md`
- Existing landing page: `src/pages/landing/OrbitLanding.tsx`
- Agent installer registry: `src/constants/agentInstallers.ts`
- Agent setup and launch UI: `src/components/agent/AddAgentModal.tsx`
- Project context UI: `src/components/context/ContextPanel.tsx`
- Handoff flow: `src/components/handoff/ShareContextModal.tsx`
- Git UI: `src/components/git/GitPanel.tsx`
- Mobile pairing: `src/components/auth/PairMobileModal.tsx`, `apps/mobile/app/(tabs)/sync.tsx`
- Mobile project/session screen: `apps/mobile/app/project/[id].tsx`
- Mobile approvals: `apps/mobile/src/components/approvals/ApprovalsModal.tsx`
- CLI command router: `apps/cli/src/commands/router.ts`
- CLI skill projection: `apps/cli/src/skills/projector.ts`
