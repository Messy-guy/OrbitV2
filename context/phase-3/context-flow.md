# Orbit Desktop — Phase 3 Context Flow

## End-to-End Workflow

```
┌─────────────────────────┐
│   Agent Session (AGY)   │  Developer works in Antigravity PTY harness
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│     Save Checkpoint     │  User clicks [Save Checkpoint]; Orbit captures task,
└────────────┬────────────┘  decisions, blockers, and Git modified files.
             │
             ▼
┌─────────────────────────┐
│   Project Context Layer │  Deterministic state saved to ~/.config/orbit/orbit_state.json
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│      Share Context      │  User selects Target Agent (e.g. Codex) and context categories:
└────────────┬────────────┘  ☑ Task ☑ Progress ☑ Decisions ☑ Files ☑ Issues ☑ Git
             │
             ▼
┌─────────────────────────┐
│   ContextPackage (v1)   │  Orbit structures a compact payload & estimates tokens (~2.1k),
└────────────┬────────────┘  redacting secrets and sensitive credentials.
             │
             ▼
┌─────────────────────────┐
│     Context Handoff     │  Orbit spawns target agent PTY session and injects the
└────────────┬────────────┘  formatted context package instruction.
             │
             ▼
┌─────────────────────────┐
│   Target Session (CODEX)│  Codex begins work with complete context without requiring
└─────────────────────────┘  the developer to re-explain architectures or past work.
```
