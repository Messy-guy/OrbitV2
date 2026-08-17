# ORBIT DESKTOP — MASTER AGENTS GUIDELINE

## Current Phase: PHASE 1 (FRONTEND ONLY)
The goal is to validate Orbit's product UX before building the backend and agent engine.
All agent integration, context generation, and project data are **strictly MOCKED**.

---

## 1. Product Definition
Orbit is a desktop workspace for developers who work with multiple AI coding agents (Antigravity, Codex, Claude Code, OpenCode, Gemini CLI, etc.).
- **Workspace**: Project
- **Agent Tile**: Coding Agent working on the project
- **Session**: One agent's conversation/work history
- **Project Context**: Shared project memory
- **Checkpoint**: Saved project state
- **Handoff**: Context transfer from one agent/session to another

Orbit does NOT replace coding agents — it is the multi-agent workspace around them.

---

## 2. Prohibited in Phase 1 (DO NOT IMPLEMENT)
- Real PTY / shell execution / terminal spawning
- Real Agent CLI / API / LLM connections (Antigravity, Codex, Claude, etc.)
- Database / SQLite / filesystem scanning
- Real Git integration or indexing
- Backend server / cloud synchronization

---

## 3. Technology Stack
- **Framework**: Tauri 2 + React 18/19 + TypeScript + Vite
- **Styling**: Tailwind CSS + CSS Variables (Dark-first UI)
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Grid Layout**: react-grid-layout
- **Component Primitives**: Radix UI / custom developer-grade components

---

## 4. Design & Aesthetic Rules
- **Dark-first**:
  - Background Base: `#09090B`
  - Background Secondary: `#0F1013`
  - Panel: `#13151A`
  - Elevated Panel: `#181A20`
  - Border: `#272A31`
  - Accent (use sparingly): `#7C8CFF`
  - Text Primary: `#F4F4F5`
  - Text Secondary: `#A1A1AA`
  - Text Muted: `#71717A`
  - Status: Success (`#4ADE80`), Warning (`#FBBF24`), Error (`#F87171`), Info (`#60A5FA`)
- **Restrained Radii**: Panels 10–12px, Buttons/Inputs 7–8px, Badges 5–6px.
- **Typography**: Inter (UI), JetBrains Mono (Code/Terminal/Prompts).
- **Tone**: Technical, focused, minimal, sophisticated, developer-centric. No excessive purple glow, no giant AI blobs.

---

## 5. Architecture & Service Abstraction
UI components MUST interact via defined Service Interfaces:
- `AgentService` → `MockAgentService`
- `SessionService` → `MockSessionService`
- `ContextService` → `MockContextService`
- `HandoffService` → `MockHandoffService`
- `WorkspaceService` → `MockWorkspaceService`

This guarantees that when Phase 2 (Tauri Rust IPC / real agent adapters) arrives, frontend components do not need rewrites.
