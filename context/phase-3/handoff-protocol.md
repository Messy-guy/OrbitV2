# Orbit Desktop — Phase 3 Provider-Agnostic Handoff Protocol

## 1. Protocol Architecture
Orbit handoff is completely **provider-agnostic**. The handoff mechanism does not rely on vendor-specific chatbot memory APIs. Instead, it formats a standardized `ContextPackage` into an initial session prompt or instruction payload delivered directly to the target agent's CLI session.

```
                    ┌─────────────────────────┐
                    │      ContextPackage     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Formatted Instruction │
                    │   + Secret Redaction    │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Antigravity CLI │     │    Codex CLI    │     │ Claude Code CLI │
│  agy -p "..."   │     │  codex "..."    │     │  claude -p "..."│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 2. Injected Prompt Format
```
============================================================
ORBIT CONTEXT HANDOFF
============================================================
You are continuing work on project: Music App
Previous agent context transferred from: ANTIGRAVITY

--- CURRENT TASK ---
Fix playlist synchronization and socket reconnect handshake

--- PROGRESS SO FAR ---
WebSocket reconnect logic implemented with exponential jitter backoff

--- ARCHITECTURAL DECISIONS ---
• Zustand store used for client playlist state slice
• WebSocket protocol version negotiation handshake used

--- RELEVANT / CHANGED FILES ---
• src/store/playlist.store.ts (modified)
• src/socket/playlist.socket.ts (modified)

--- KNOWN ISSUES & BLOCKERS ---
• Reconnect state is not persisted in local storage on page refresh

--- GIT STATE ---
Branch: main
HEAD: a82f31c

============================================================
INSTRUCTIONS:
1. Continue from this exact state.
2. Do not redo completed work.
3. Inspect the listed files and Git state before making changes.
============================================================
```

## 3. Secret Redaction Rules
Before serializing the context package, Orbit sanitizes all output against standard credential regex patterns (`API_KEY=`, `TOKEN=`, `SECRET=`, `PASSWORD=`, `PRIVATE_KEY`).
