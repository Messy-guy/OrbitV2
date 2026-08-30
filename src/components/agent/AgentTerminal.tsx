import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Agent } from '../../types/orbit';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useUIStore } from '../../stores/ui.store';
import { isTauriAvailable, tauriService } from '../../services/tauri.service';
import { useContextStore } from '../../stores/context.store';
import { Play, RotateCcw, Terminal as TerminalIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface AgentTerminalProps {
  agent: Agent;
}

type Phase = 'booting' | 'active' | 'exited' | 'error' | 'idle';

export const AgentTerminal: React.FC<AgentTerminalProps> = ({ agent }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const isBootedRef = useRef(false);

  const { resizeTerminal, activeSessionIdByAgent } = useAgentStore();
  const { getActiveWorkspace } = useWorkspaceStore();
  const theme = useSettingsStore(s => s.theme);

  const agentRef = useRef(agent);
  agentRef.current = agent;
  const workspaceRef = useRef(getActiveWorkspace());
  workspaceRef.current = getActiveWorkspace();

  const [phase, setPhase] = useState<Phase>('booting');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const cleanupTerminal = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (termRef.current) {
      try {
        termRef.current.dispose();
      } catch {}
      termRef.current = null;
    }
    fitRef.current = null;
    isBootedRef.current = false;
  }, []);

  const startSession = useCallback(async () => {
    if (!hostRef.current || isBootedRef.current) return;
    isBootedRef.current = true;
    setPhase('booting');
    setErrorMsg('');

    // Clean any prior instance
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    if (termRef.current) {
      try {
        termRef.current.dispose();
      } catch {}
      termRef.current = null;
    }

    const host = hostRef.current;
    const settings = useSettingsStore.getState();
    const isLightTheme = settings.theme === 'light';

    // 1. Create standard xterm instance dynamically styled according to active theme
    const term = new Terminal({
      cursorBlink: settings.terminalCursorBlink,
      cursorStyle: settings.terminalCursorStyle || 'block',
      fontSize: settings.terminalFontSize || 12.5,
      fontFamily: settings.terminalFontFamily || 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      lineHeight: settings.terminalLineHeight || 1.25,
      letterSpacing: 0,
      convertEol: false,
      scrollback: settings.terminalScrollback || 2000,
      allowTransparency: false,
      theme: isLightTheme ? {
        background: '#ffffff',
        foreground: '#0f172a',
        cursor: '#0f172a',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(15, 23, 42, 0.18)',
        black: '#0f172a',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0891b2',
        white: '#64748b',
        brightBlack: '#475569',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#0f172a',
      } : {
        background: '#090a0f',
        foreground: '#e4e4e7',
        cursor: '#ffffff',
        cursorAccent: '#090a0f',
        selectionBackground: 'rgba(255, 255, 255, 0.25)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);
    termRef.current = term;
    fitRef.current = fitAddon;

    // Initial fit
    try {
      fitAddon.fit();
    } catch {}

    const containerHeight = host.clientHeight || 400;
    const containerWidth = host.clientWidth || 600;
    const estimatedRows = Math.floor(containerHeight / 14);
    const estimatedCols = Math.floor(containerWidth / 7.5);

    const rows = Math.max(term.rows || 0, estimatedRows, 24);
    const cols = Math.max(term.cols || 0, estimatedCols, 80);

    try {
      if (!isTauriAvailable()) {
        throw new Error('Tauri runtime not available.');
      }

      // 2. Subscribe to output events
      const unlistenOutput = await tauriService.onAgentOutput((payload) => {
        if (payload.agentId === agentRef.current.id && termRef.current) {
          termRef.current.write(payload.text);
        }
      });

      // 3. Forward user input to PTY (only when no modal is open)
      term.onData((data) => {
        const uiState = useUIStore.getState();
        const isAnyModalOpen =
          uiState.isShareContextOpen ||
          uiState.isCreateWorkspaceOpen ||
          uiState.isAddAgentOpen ||
          uiState.isCreateCheckpointOpen ||
          uiState.isShortcutsOpen ||
          uiState.isSettingsOpen ||
          !!uiState.activeDiffFile;

        if (isAnyModalOpen) return;

        const activeSessId =
          activeSessionIdByAgent[agentRef.current.id] ||
          agentRef.current.currentSessionId ||
          'default';

        tauriService.sendAgentInput(agentRef.current.id, activeSessId, data).catch((e) => {
          console.warn('Failed to send terminal input:', e);
        });
      });

      // 4. Track status changes
      const unlistenStatus = await tauriService.onAgentStatus((payload) => {
        if (payload.agentId === agentRef.current.id) {
          if (payload.status === 'error') {
            setErrorMsg(payload.message || 'Process error');
            setPhase('error');
          } else if (payload.status === 'exited' || payload.status === 'stopped') {
            setPhase('exited');
          } else if (payload.status === 'active' || payload.status === 'running') {
            setPhase('active');
          }
        }
      });

      unlistenRef.current = () => {
        unlistenOutput();
        unlistenStatus();
      };

      // 5. Spawn or Reattach PTY session
      const ws = workspaceRef.current;
      const projPath = ws?.projectPath || '';
      const sessionId = agentRef.current.currentSessionId || `sess-${agentRef.current.id}`;

      // Check if session is already running in Rust before starting
      const isAlreadyRunning = await tauriService.isAgentProcessRunning(agentRef.current.id);

      if (!isAlreadyRunning) {
        if (agentRef.current.role) {
          await tauriService.setAgentRole(agentRef.current.id, agentRef.current.role).catch(() => {});
        }

        const effectiveProvider = agentRef.current.provider === 'custom'
          ? (agentRef.current.currentCommand?.trim() || agentRef.current.name?.trim() || 'terminal')
          : agentRef.current.provider;

        await tauriService.startAgentSession(
          projPath,
          agentRef.current.id,
          sessionId,
          effectiveProvider,
          agentRef.current.taskDirective?.trim() || undefined,
          ws?.id || 'ws-orbit',
          rows,
          cols,
          agentRef.current.profileId,
          agentRef.current.role
        );
      }

      setPhase('active');
      resizeTerminal(agentRef.current.id, rows, cols);
      term.focus();

      // 6. Replay history if any (seamless reattach)
      const history = await tauriService.getAgentTerminalHistory(agentRef.current.id);
      if (history && history.length > 0 && termRef.current) {
        termRef.current.write(history);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setPhase('error');
      if (termRef.current) {
        termRef.current.write(`\r\n\x1b[31m[Orbit PTY Error] ${msg}\x1b[0m\r\n`);
      }
    }

    // 7. Responsive auto-resize observer & PTY SIGWINCH synchronization
    let resizeTimer: NodeJS.Timeout | null = null;
    const triggerRefit = () => {
      try {
        fitAddon.fit();
        if (term.rows && term.cols && term.rows >= 4 && term.cols >= 20) {
          resizeTerminal(agentRef.current.id, term.rows, term.cols);
          if (isTauriAvailable()) {
            tauriService.resizeAgentTerminal(agentRef.current.id, term.rows, term.cols).catch(() => {});
          }
        }
      } catch {}
    };

    const handleResize = () => {
      triggerRefit();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(triggerRefit, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(host);

    // Initial refit sequence
    requestAnimationFrame(triggerRefit);
    setTimeout(triggerRefit, 100);
    setTimeout(triggerRefit, 400);
    setTimeout(triggerRefit, 1200);

    const prevUnlisten = unlistenRef.current;
    unlistenRef.current = () => {
      if (prevUnlisten) prevUnlisten();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [resizeTerminal]);

  // Live theme change handler for xterm instance
  useEffect(() => {
    if (termRef.current) {
      const isLight = theme === 'light';
      termRef.current.options.theme = isLight ? {
        background: '#ffffff',
        foreground: '#0f172a',
        cursor: '#0f172a',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(15, 23, 42, 0.18)',
        black: '#0f172a',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0891b2',
        white: '#64748b',
        brightBlack: '#475569',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#0f172a',
      } : {
        background: '#090a0f',
        foreground: '#e4e4e7',
        cursor: '#ffffff',
        cursorAccent: '#090a0f',
        selectionBackground: 'rgba(255, 255, 255, 0.25)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fde047',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      };
    }
  }, [theme]);

  useEffect(() => {
    startSession();
    return () => {
      cleanupTerminal();
    };
  }, [agent.id, startSession, cleanupTerminal]);

  const restart = async () => {
    isBootedRef.current = false;
    if (isTauriAvailable()) {
      await tauriService.stopAgentSession(agent.id).catch(() => {});
    }
    if (termRef.current) {
      termRef.current.reset();
      termRef.current.clear();
    }
    await startSession();
  };

  const providerLabel = agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1).toLowerCase();
  const activeWorkspace = getActiveWorkspace();

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full relative overflow-hidden bg-panel">
      {/* Idle Screen */}
      {phase === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-panel z-20">
          <div className="w-10 h-10 rounded-xl bg-well border border-border flex items-center justify-center shadow-lg">
            <TerminalIcon size={18} className="text-text-primary" />
          </div>
          <div className="text-center">
            <p className="text-xs font-mono font-bold text-text-primary">{providerLabel} Terminal</p>
            <p className="text-[10px] font-mono text-text-muted mt-0.5">Process is stopped</p>
          </div>
          <button
            onClick={startSession}
            className="flex items-center gap-2 px-4 py-2 bg-text-primary text-background rounded-lg text-xs font-mono font-bold hover:opacity-90 transition-all cursor-pointer shadow-md"
          >
            <Play size={11} className="fill-current" />
            <span>Launch {providerLabel}</span>
          </button>
        </div>
      )}

      {/* Booting Loader */}
      {phase === 'booting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel/80 backdrop-blur-sm z-20">
          <div className="flex items-center gap-2 text-xs font-mono text-text-primary">
            <span className="animate-pulse">▋</span>
            <span>Spawning {providerLabel} CLI...</span>
          </div>
        </div>
      )}

      {/* Exited Notification */}
      {phase === 'exited' && (
        <div className="absolute bottom-0 left-0 right-0 px-3.5 py-2 bg-panel-elevated border-t border-border flex items-center justify-between z-20 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
            <span className="w-2 h-2 rounded-full bg-text-dim" />
            <span>Session finished</span>
            <span>·</span>
            <span className="text-text-primary font-medium">Save checkpoint?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (activeWorkspace) {
                  await useContextStore.getState().generateDraft(activeWorkspace.id, activeWorkspace.projectPath);
                  useContextStore.getState().setDraftModalOpen(true);
                }
              }}
              className="px-2.5 py-1 bg-well hover:bg-panel text-text-primary border border-border rounded text-[11px] font-mono font-medium transition-all cursor-pointer"
            >
              Review Draft
            </button>
            <button
              onClick={restart}
              className="px-2.5 py-1 bg-well hover:bg-panel text-text-muted hover:text-text-primary border border-border rounded text-[11px] font-mono transition-colors cursor-pointer"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      {/* Terminal Canvas Container */}
      <div
        ref={hostRef}
        className="w-full h-full p-0 overflow-hidden bg-panel"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
};
