# Project Overview: Orbit Desktop

## 1. Executive Summary
Orbit is a desktop workspace designed for developers who collaborate with multiple AI coding agents (such as Google Antigravity, OpenAI Codex, Claude Code, OpenCode, Gemini CLI, etc.). Orbit provides a unified, visual multi-agent command center that manages shared project memory, tracks progress across sessions, and orchestrates seamless context handoffs between different AI agents.

## 2. The Problem
Modern developers frequently combine multiple AI coding agents on the same codebase. However:
- Each agent operates in isolation with separate conversations, memory, and progress states.
- Switching between agents forces the developer to repeatedly re-explain architectures, decisions, progress, and unresolved bugs.
- There is no central spatial layout or structured project memory connecting heterogeneous agent tools.

## 3. Core Concepts & Mental Model
- **Workspace**: Maps 1-to-1 with a software project/repository.
- **Agent Tile**: An active coding agent working inside the project (represented as an interactive tile in a spatial grid).
- **Session**: A single agent's conversation and execution history.
- **Project Context**: Shared, structured project state (goals, progress %, architectural decisions, known issues, modified files).
- **Checkpoint**: A saved snapshot of the project's progress and context at a specific point in time.
- **Handoff**: A structured context package transferred from one agent to another, enabling continuous development without context loss.

## 4. Phase 1 Scope & Constraints
- **Scope**: Frontend Product Validation only. High-fidelity UI, realistic interactive state, and mock agent behaviors.
- **Prohibitions**: No real PTY/terminals, no real API/LLM calls, no filesystem write locks, no database engines.
- **Goal**: Validate spatial organization (Agent Grid), Context handoff workflows, and desktop UX ergonomics before building Phase 2's Rust core.
