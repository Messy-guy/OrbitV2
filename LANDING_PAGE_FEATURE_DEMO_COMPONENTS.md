# Orbit Landing Page: Interactive Feature Demo Components

## Intent

This is a component-level demo plan for the landing page. Each feature gets its own **small interactive demo component** embedded beside its explanation. These are miniature, designed demonstrations of a feature, not app screen recordings and not one continuous animation spanning the website.

Each component should:

- Start in a clear, understandable state without requiring a click.
- Invite one simple interaction (click, toggle, select, or drag) that demonstrates the feature.
- Animate a visible state change in response, so the visitor understands what happened.
- Reset/replay predictably and work without a backend, login, or real agent process.
- Use illustrative sample data and be presented as a product demo/illustration, not a live Orbit session.
- Keep its own controls and state isolated from the other feature demos.

Build these as native landing-page UI with HTML/CSS/SVG/Canvas and the project's motion approach. The animation belongs to the component and is triggered by its interaction, intersection, or an explicit replay control—not by a full-page cinematic.

## Shared component pattern

Suggested component shell:

```text
FeatureDemo
├── DemoHeader       (feature label + illustrative/demo badge)
├── DemoStage        (miniature interface and animated state)
├── DemoControls     (one or two clear interactions)
└── DemoCaption      (short explanation of the result)
```

Guidelines:

- Keep each demo stage around 320–520 px tall on desktop and stack/crop thoughtfully on mobile.
- Use one focal action per component. Avoid building an entire fake Orbit application inside each one.
- Use deliberate motion: 180–500 ms for UI transitions; longer only for a clear multi-step flow. Respect reduced-motion preferences.
- Include a replay/reset button for sequences that reach a completed state.
- Provide a static initial/completed state and useful text labels if animation is disabled.
- Do not use faux cursor movement as the only way to show how to interact; actual controls must work.
- Do not imply real AI inference, code execution, secure transport, provider coverage, performance figures, or completed task outcomes. Use sample content and explain only state changes the product supports.

## Feature demos

### 1. Multi-agent workspace demo

**Component name:** `AgentWorkspaceDemo`

**Purpose:** Show that multiple agent sessions can be arranged and viewed around one project.

**Initial stage:** A project header with two compact agent cards on a canvas. One has a `WORKING` state; one has `READY`. Use generic/sample names and a few decorative terminal lines.

**Visitor interaction:** Click **Add agent** or a `+` tile.

**Demonstration:**

1. A small provider/role chooser opens inside the demo.
2. Visitor selects a sample option (for example, “Code agent · Implementer”).
3. A third card animates onto the workspace and settles into a grid position.
4. Its status changes from `STARTING` to `READY`; a short task label appears.
5. The visitor can drag a card to reorder it, demonstrating spatial organization.

**Controls:** Add agent; optional draggable cards; Reset.

**Caption:** “See multiple agent sessions in one project workspace.”

**Must not imply:** that the demo launches a real process or that agents coordinate automatically.

### 2. Agent install/discovery demo

**Component name:** `AgentSetupDemo`

**Purpose:** Explain installed-agent discovery and the install action available for selected providers.

**Initial stage:** A small agent catalog with rows marked `Detected` and `Not detected`.

**Visitor interaction:** Select a not-detected sample provider, then click **Install**.

**Demonstration:**

1. Selected provider row expands to show its install action.
2. Clicking Install starts a short illustrative progress indicator.
3. Progress completes and the row changes to `Available`.
4. A **Launch in workspace** button appears (it can be disabled with an explanatory note if the demo is purely illustrative).

**Controls:** Provider row selection; Install; Reset.

**Caption:** “Orbit can discover installed CLIs and offers install actions for selected agents.”

**Must not imply:** all providers/platforms are one-click supported or that the demo installed anything on the visitor's computer.

### 3. Shared project context demo

**Component name:** `ProjectContextDemo`

**Purpose:** Show what Orbit's project context contains and how it gives work a shared frame.

**Initial stage:** A compact project brief with sections for `Current task`, `Decisions`, `Known issue`, and `Changed files`.

**Visitor interaction:** Click a section tab/chip (Task, Decisions, Files, Issues).

**Demonstration:**

1. Selected section becomes highlighted.
2. Corresponding sample details slide into the content area.
3. A small `Project context` indicator remains visible beside two agent cards to make the project-level relationship clear.

**Controls:** Section chips; optional progress slider only if the value is clearly demo data; Reset.

**Caption:** “Keep the task, decisions, issues, and changed files together.”

**Must not imply:** every provider automatically receives every context field without a handoff or relevant integration.

### 4. Checkpoint demo

**Component name:** `CheckpointDemo`

**Purpose:** Demonstrate saving a project-progress snapshot for later reference.

**Initial stage:** A small project-state card showing a task, decisions, and a changed-file count, plus a **Save checkpoint** control.

**Visitor interaction:** Click **Save checkpoint**.

**Demonstration:**

1. A compact confirmation card appears, summarizing what the illustrative checkpoint includes.
2. Visitor confirms.
3. The card compresses into a timeline item in `Checkpoint history` with a demo timestamp.
4. Clicking the saved item reopens its summary.

**Controls:** Save checkpoint; open checkpoint; Reset.

**Caption:** “Save a snapshot of project progress and context.”

**Must not imply:** this is a full project backup, Git commit, or filesystem restore point.

### 5. Agent handoff demo

**Component name:** `HandoffDemo`

**Purpose:** Make the handoff differentiator tangible: selected context becomes a brief for another agent.

**Initial stage:** Source agent card on the left, target agent card on the right, and a set of selectable context chips between them: Task, Decisions, Issues, Changed files, Git state.

**Visitor interaction:** Toggle context chips, then click **Preview handoff**.

**Demonstration:**

1. Selected chips animate into a central handoff brief card.
2. The brief displays a sample task, decisions, changed files, and next step.
3. Visitor can add/edit one short note or select a different target.
4. Clicking **Send handoff** moves the brief to the target card.
5. Target card changes to `Brief received` and shows the next-step instruction.
6. A Reset action returns to the initial state.

**Controls:** Context chip toggles; target selector; Preview; Send handoff; Reset.

**Caption:** “Choose what to pass on, preview the brief, and hand work to another agent.”

**Must not imply:** full transcript transfer, guaranteed understanding, zero context loss, or autonomous completion. Keep the included information visible.

### 6. Git changes demo

**Component name:** `GitChangesDemo`

**Purpose:** Show changed files and the basic review/staging flow in Orbit's desktop source-control panel.

**Initial stage:** Branch label plus `Changes` and `Staged` lists with a few safe sample file names.

**Visitor interaction:** Click a changed file, inspect the diff, then click **Stage file**.

**Demonstration:**

1. Selected row expands to show a miniature green/red diff.
2. Clicking Stage animates the file row from `Changes` to `Staged`.
3. An optional **Unstage** action reverses the animation.

**Controls:** File selection; Stage/Unstage; Reset.

**Caption:** “Review and stage project changes alongside agent sessions.”

**Must not imply:** that changes are committed automatically. If adding a commit interaction, make the user click an explicit Commit button.

### 7. GitHub import demo

**Component name:** `RepositoryImportDemo`

**Purpose:** Explain how a repository becomes a workspace.

**Initial stage:** A search/import card with a sample repository name, a search button, and a result row.

**Visitor interaction:** Click the result and then **Import repository**.

**Demonstration:**

1. A repository result is selected.
2. Import progress animates briefly.
3. The result card transforms into a project workspace card with a branch and file-tree illustration.

**Controls:** Search or select sample result; Import; Reset.

**Caption:** “Bring a repository into an Orbit workspace.”

**Must not imply:** the animation accesses GitHub, imports the visitor's repository, or bypasses authentication for private repositories.

### 8. Mobile pairing demo

**Component name:** `MobilePairingDemo`

**Purpose:** Show the pairing relationship between desktop Orbit and the companion mobile app.

**Initial stage:** Desktop pairing card and a phone illustration. Use a decorative QR-like pattern or six-digit sample code that cannot be used to pair a real account.

**Visitor interaction:** Choose **Scan QR** or **Enter code** on the phone mockup.

**Demonstration:**

1. Phone mockup switches between scan and code entry modes.
2. On Scan, animate a scan line over the decorative code; on Code, fill a sample code.
3. Visitor clicks **Pair**.
4. Both sides change to `Connected` and a sample project list appears on the phone.

**Controls:** Scan/Code tabs; Pair; Reset.

**Caption:** “Pair the mobile companion with your Orbit workstation.”

**Must not imply:** local-Wi-Fi-only connectivity, a real QR token, or pairing with a live desktop from the marketing demo.

### 9. Mobile agent control demo

**Component name:** `MobileAgentControlDemo`

**Purpose:** Show how a user can inspect a session and send a supported remote control action from mobile.

**Initial stage:** Phone mockup showing a sample active project and one agent card with `WORKING` status.

**Visitor interaction:** Tap **Pause** or **Stop**.

**Demonstration:**

1. A small confirmation sheet appears for Stop (Pause may act directly in the demo).
2. Visitor confirms the selected action.
3. Card status changes to `PAUSED` or `STOPPED` and its action buttons update.
4. Reset returns it to `WORKING`.

**Controls:** Pause; Stop; confirm/cancel where appropriate; Reset.

**Caption:** “Check in on a connected session and control it from your phone.”

**Must not imply:** the action affects a real agent or works when desktop/relay is offline.

### 10. Mobile approvals demo

**Component name:** `ApprovalDemo`

**Purpose:** Demonstrate reviewing and responding to a pending action request.

**Initial stage:** Phone mockup with a sample approval card: requesting agent, short question, illustrative command snippet, Authorize and Deny buttons.

**Visitor interaction:** Click **Authorize** or **Deny**.

**Demonstration:**

1. Selected button enters a brief processing state.
2. Request card transitions to a clear `Authorized` or `Denied` result state.
3. Replay restores the pending approval.

**Controls:** Authorize; Deny; Replay.

**Caption:** “Review supported agent action requests from the mobile companion.”

**Must not imply:** all agents/actions require approval or that this demo sends a real command.

### 11. Orbit CLI demo

**Component name:** `OrbitCliDemo`

**Purpose:** Show terminal-based session and context controls for developers who prefer a CLI.

**Initial stage:** Designed terminal window with a sample project prompt and two session rows.

**Visitor interaction:** Click a command tab or type/select from a small preset list: `/sessions`, `/context`, `/switch`, `/handoff`.

**Demonstration:**

1. Selected command types or appears at the prompt.
2. Short, illustrative output appears line by line.
3. For `/switch`, highlight the destination session. For `/handoff`, show a compact brief summary.
4. Clear/Replay resets the terminal.

**Controls:** Preset command buttons; optional input that is constrained to demo commands; Clear/Replay.

**Caption:** “Manage sessions and inspect project context from the terminal.”

**Must not imply:** a public install command or distribution channel until the CLI is actually packaged and released for users.

### 12. Skills demo

**Component name:** `SkillsDemo`

**Purpose:** Show reusable skill instructions being enabled and projected to a supported agent configuration.

**Initial stage:** Skill catalog card with one sample skill and an `Off` state; adjacent provider target label.

**Visitor interaction:** Toggle the skill on and select a supported provider target.

**Demonstration:**

1. Toggle changes to `Enabled`.
2. An instruction-file card appears with a provider-specific path only if that path is verified.
3. A few generic instruction lines appear in the file preview.
4. Toggle off removes/marks the projected entry inactive in the demo.

**Controls:** Enable toggle; provider selector; Reset.

**Caption:** “Reuse project instructions across supported agent workflows.”

**Must not imply:** every skill works with every provider or that enabling a skill means an agent has already followed it.

### 13. Project file explorer demo

**Component name:** `ProjectExplorerDemo`

**Purpose:** Show project files remain accessible beside agent work.

**Initial stage:** Compact file tree beside an agent card.

**Visitor interaction:** Expand a folder and click a file.

**Demonstration:**

1. Folder expands with a short, animated height transition.
2. File becomes selected.
3. A small code/markdown preview opens in an adjacent pane.
4. Optional external-editor icon reveals a tooltip on hover/focus.

**Controls:** Expand/collapse folder; select file; Reset.

**Caption:** “Browse project files while keeping agent sessions in view.”

**Must not imply:** Orbit replaces a full IDE or that the external editor exists on every machine.

## Recommended demos for the first landing-page build

Build these first, since they explain the product's identity and differentiators:

1. `AgentWorkspaceDemo` — what Orbit is.
2. `HandoffDemo` — why Orbit is useful across agents.
3. `MobilePairingDemo` plus `MobileAgentControlDemo` — what the companion adds.
4. `GitChangesDemo` — how project work is visible and manageable.
5. `AgentSetupDemo` — how users bring supported agents into the workspace.

Add `CheckpointDemo`, `ApprovalDemo`, `OrbitCliDemo`, `SkillsDemo`, `RepositoryImportDemo`, and `ProjectExplorerDemo` as smaller feature cards or later sections based on page length.

## Suggested implementation interface

Use a consistent interface so demos can be mounted, paused, and reset independently:

```ts
interface FeatureDemoProps {
  autoPlay?: boolean;
  reducedMotion?: boolean;
  onInteraction?: (event: string) => void;
}
```

Each component should own only its illustrative state. Keep transitions local and deterministic; no API, filesystem, relay, or agent calls should be made from the public landing page demo.

## Acceptance checklist

- Each demo has an independent component boundary and reset state.
- The visitor can trigger the main demonstrated outcome.
- The result is visible and explained with a caption.
- No live Orbit process, account, repository, or relay is required.
- Demo data is clearly illustrative and contains no real credentials or personal paths.
- Animation can be paused/reduced and has a meaningful static state.
- The portrayed workflow matches the actual Orbit capability and its limitations.
- Mobile layouts preserve the key interaction rather than reducing the whole component to unreadable miniature UI.
