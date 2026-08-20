import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Play } from 'lucide-react';
import { Agent } from '../../types/orbit';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useContextStore } from '../../stores/context.store';
import { useUIStore } from '../../stores/ui.store';
import { tauriService, isTauriAvailable } from '../../services';

interface AgentTerminalProps {
  agent: Agent;
}

type Phase = 'idle' | 'booting' | 'active' | 'exited' | 'error';

export const AgentTerminal: React.FC<AgentTerminalProps> = ({ agent }) => {
  const { resizeTerminal } = useAgentStore();
  const { getActiveWorkspace } = useWorkspaceStore();

  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const isBootedRef = useRef<boolean>(false);
  const agentRef = useRef<Agent>(agent);
  const workspaceRef = useRef(getActiveWorkspace());

  agentRef.current = agent;
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

    // 1. Create standard xterm instance with clean dark theme
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace, "JetBrains Mono"',
      lineHeight: 1.15,
      letterSpacing: 0,
      convertEol: false, // Critical: true breaks Ink/readline cursor movements & TUI logos
      scrollback: 10000,
      allowTransparency: false,
      theme: {
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
          uiState.isCreateCheckpointOpen;

        if (isAnyModalOpen) {
          return; // Ignore background terminal inputs while modal is active
        }

        if (isTauriAvailable()) {
          const sessId = agentRef.current.currentSessionId || 'default';
          tauriService.sendAgentInput(agentRef.current.id, sessId, data).catch(() => {});
        }
      });

      // 4. Status listener
      const unlistenStatus = await tauriService.onAgentStatus((payload) => {
        if (payload.agentId === agentRef.current.id) {
          if (payload.status === 'working') {
            setPhase('active');
          } else if (payload.status === 'exited') {
            isBootedRef.current = false;
            setPhase('exited');
          }
        }
      });

      unlistenRef.current = () => {
        unlistenOutput();
        unlistenStatus();
      };

      // 5. Spawn PTY session
      const ws = workspaceRef.current;
      const projPath = ws?.projectPath || '/home/leo/Desktop/personal_projects/OrbitV2';
      const sessionId = agentRef.current.currentSessionId || `sess-${agentRef.current.id}-${Date.now()}`;

      await tauriService.startAgentSession(
        projPath,
        agentRef.current.id,
        sessionId,
        agentRef.current.provider,
        undefined,
        ws?.id || 'ws-orbit',
        rows,
        cols
      );

      setPhase('active');
      resizeTerminal(agentRef.current.id, rows, cols);
      term.focus();

      // 6. Replay history if any
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
    <div className="flex-1 flex flex-col min-h-0 w-full h-full relative overflow-hidden bg-[#090a0f]">
      {/* Idle Screen */}
      {phase === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#090a0f] z-20">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center shadow-lg">
            <TerminalIcon size={18} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-xs font-mono font-bold text-white">{providerLabel} Terminal</p>
            <p className="text-[10px] font-mono text-[#7A7E8F] mt-0.5">Process is stopped</p>
          </div>
          <button
            onClick={startSession}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 rounded-lg text-xs font-mono font-extrabold text-black transition-all cursor-pointer shadow-md active:translate-y-[0.5px]"
          >
            <Play size={11} className="fill-black" />
            <span>Launch {providerLabel}</span>
          </button>
        </div>
      )}

      {/* Booting Loader */}
      {phase === 'booting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060709]/80 backdrop-blur-sm z-20">
          <div className="flex items-center gap-2 text-xs font-mono text-white">
            <span className="animate-pulse">▋</span>
            <span>Spawning {providerLabel} CLI...</span>
          </div>
        </div>
      )}

      {/* Exited Notification */}
      {phase === 'exited' && (
        <div className="absolute bottom-0 left-0 right-0 px-3.5 py-2 bg-[#121318]/95 border-t border-white/[0.08] flex items-center justify-between z-20 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#8e93a0]">
            <span className="w-2 h-2 rounded-full bg-[#71717a]" />
            <span>Session finished</span>
            <span className="text-[#3f3f46]">·</span>
            <span className="text-white font-medium">Save checkpoint?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (activeWorkspace) {
                  await useContextStore.getState().generateDraft(activeWorkspace.id, activeWorkspace.projectPath);
                  useContextStore.getState().setDraftModalOpen(true);
                }
              }}
              className="px-2.5 py-1 bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.15] rounded text-[11px] font-mono font-medium transition-all cursor-pointer"
            >
              Review Draft
            </button>
            <button
              onClick={restart}
              className="px-2.5 py-1 bg-[#20222a] hover:bg-[#282a38] text-[#c0c4d2] border border-[#363948] rounded text-[11px] font-mono transition-colors cursor-pointer"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      {/* Terminal Canvas Container */}
      <div
        ref={hostRef}
        className="w-full h-full p-0 overflow-hidden bg-[#090a0f]"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
};
