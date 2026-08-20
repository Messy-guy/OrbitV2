# Orbit Settings & Preferences Architecture Plan

## 1. Overview & Objective
Build a professional, ultra-clean Settings & Preferences System (`Ctrl+,` or `Cmd+,`) for Orbit. The system provides unified state management with local persistence, hot-theme swapping (Obsidian, Tokyo Night, Vercel Midnight, Catppuccin Mocha), custom accents, AI agent binary configuration, handoff behaviors, and terminal customizations.

---

## 2. Architecture & Modules

```
                    ┌──────────────────────────────────────────────┐
                    │              useSettingsStore                │
                    │   (Persistent Zustand + LocalStorage/Tauri)  │
                    └──────────────────────────────────────────────┘
                                           │
       ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
       ▼                   ▼                               ▼                   ▼
1. Appearance       2. AI Agents                    3. Handoff          4. Terminal & Docks
   - Theme Switcher    - Custom Binary Paths           - Default Mode      - Font Family / Size
   - Accent Colors     - Default Engine Models         - Token Budget      - Scrollback Buffer
   - Canvas Dots/Grid  - Auto-Restart Crash Recovery   - Auto-Git Stash    - Copy-on-Select
```

---

## 3. Implementation Steps

### Phase 1: Settings Data Model & Persistent Store
- **File:** `src/types/settings.ts` & `src/stores/settings.store.ts`
- Define full types for `ThemeId`, `AccentId`, `SettingsState`, and persistent defaults.
- Implement theme CSS variable injector that dynamically updates CSS tokens (`--bg-canvas`, `--border-base`, `--accent-primary`, etc.) in real time.

### Phase 2: Theme Definitions & CSS Variables
- **File:** `src/styles/themes.css` or `src/styles/index.css`
- Configure color palettes for:
  - **Obsidian Dark** (Default Graphite/Black)
  - **Tokyo Night** (Midnight Navy / Purple)
  - **Vercel Midnight** (Monochrome High Contrast)
  - **Catppuccin Mocha** (Warm Soft Charcoal)

### Phase 3: Settings Modal UI (`SettingsModal.tsx`)
- **File:** `src/components/settings/SettingsModal.tsx`
- Build a multi-tab sidebar modal:
  1. **Appearance**: Theme picker, Accent pills, Canvas style, Glassmorphism blur toggle.
  2. **AI Agents**: Binary paths for Antigravity, Claude Code, OpenCode, and default models.
  3. **Handoff**: Safe Mode vs Autonomous Mode default, Token budget slider, Auto-diff inclusion.
  4. **Terminal**: Font family selector (`JetBrains Mono`, `Fira Code`, `Geist Mono`), Font size slider, Cursor style.
  5. **Notifications & Alerts**: OS background task completion alerts toggle.
  6. **Git & Workspace**: Default clone path, Auto-checkpointing.
  7. **Diagnostics & Updates**: System information, PTY status, Check for updates.

### Phase 4: Integration with Existing Components
- Connect `AgentTerminal.tsx` to dynamically apply configured font family, size, and cursor style.
- Connect `AgentCanvas.tsx` to dynamically switch canvas grid styles (Dots vs Grid vs Plain).
- Connect `ShareContextModal.tsx` to respect default handoff mode and token budgets.
- Add `Settings` gear icon button in `Sidebar.tsx` / `AppHeader.tsx` and register `Ctrl+,` global shortcut in `ShortcutsModal.tsx`.

---

## 4. Verification & Testing
1. Test real-time theme and accent switching with instant UI re-render.
2. Verify terminal font resizing and family changes in active xterm.js terminals.
3. Validate persistence across page reloads using localStorage.
4. Verify complete TypeScript build with `npm run build`.
