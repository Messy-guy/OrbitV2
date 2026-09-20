import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Terminal as TerminalIcon } from 'lucide-react';
import { Agent } from '../../types/orbit';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useSkillStore } from '../../stores/skill.store';
import { ProviderSkillAdapterService } from '../../services/providerSkillAdapter.service';
import { isTauriAvailable, tauriService } from '../../services/tauri.service';
import { TerminalCanvasRenderer, TERMINAL_LINE_HEIGHT } from '../terminal/TerminalCanvasRenderer';
import { TerminalGridView } from '../terminal/TerminalGridView';
import { TerminalSessionStore, createBlankSnapshot, useTerminalSnapshot } from '../../services/terminal/terminalSessionStore';
import { conversationCaptureService } from '../../services/conversation/ConversationCaptureService';

const ESTIMATED_CHAR_WIDTH = 7.82;

interface AgentTerminalProps { agent: Agent; }
type Phase = 'booting' | 'active' | 'exited' | 'error' | 'idle';

export const AgentTerminal: React.FC<AgentTerminalProps> = ({ agent }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(agent.currentSessionId || `sess-${agent.id}`);
  const subscriptionRef = useRef<{ detach: () => Promise<void> } | null>(null);
  const storeRef = useRef<TerminalSessionStore | null>(null);
  const lastDimensionsRef = useRef<{ rows: number; columns: number }>({ rows: 24, columns: 80 });
  const [phase, setPhase] = useState<Phase>('booting');
  const [errorMsg, setErrorMsg] = useState('');
  const [fallbackSnapshot, setFallbackSnapshot] = useState(() => createBlankSnapshot(sessionRef.current, 30, 100));
  const inputBufferRef = useRef<string>('');
  const { resizeTerminal } = useAgentStore();
  const setActiveSession = useAgentStore(s => s.setActiveSession);
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const activeWorkspace = useWorkspaceStore(s => s.getActiveWorkspace());
  const agentWorkspace = workspaces.find(w => w.id === agent.workspaceId) || activeWorkspace;
  const projectPath = agentWorkspace?.projectPath || activeWorkspace?.projectPath || '';
  const activeWorkspaceRef = useRef(agentWorkspace);
  activeWorkspaceRef.current = agentWorkspace;

  // Agent objects are refreshed by status/output updates. Keep the terminal
  // lifecycle keyed to launch-relevant values so those refreshes cannot tear
  // down and respawn an otherwise healthy PTY.
  const agentId = agent.id;
  const agentSessionId = agent.currentSessionId;
  const agentProvider = agent.provider;
  const agentCommand = agent.currentCommand;
  const agentName = agent.name;
  const agentRole = agent.role;
  const agentDirective = agent.taskDirective?.trim() || undefined;
  const agentProfileId = agent.profileId;

  if (!storeRef.current) {
    storeRef.current = new TerminalSessionStore(() => { void reattach(); });
  }

  async function reattach() {
    if (!isTauriAvailable()) return;
    const current = subscriptionRef.current;
    subscriptionRef.current = null;
    await current?.detach().catch(() => {});
    storeRef.current?.reset();
    try {
      subscriptionRef.current = await tauriService.attachNativeTerminal(sessionRef.current, (event) => {
        storeRef.current?.apply(event);
        if (event.type === 'lifecycle') {
          if (event.state === 'exited' || event.state === 'stopped') setPhase('exited');
          if (event.state === 'failed') { setPhase('error'); setErrorMsg(event.message || 'Native terminal session failed'); }
        }
      });
    } catch (error) {
      setPhase('error');
      setErrorMsg(error instanceof Error ? error.message : String(error));
    }
  }

  const computeGridDimensions = useCallback((): { rows: number; columns: number } => {
    const host = hostRef.current;
    const clientHeight = host?.clientHeight && host.clientHeight > 40 ? host.clientHeight : 450;
    const clientWidth = host?.clientWidth && host.clientWidth > 100 ? host.clientWidth : 800;
    const rows = Math.max(8, Math.floor(clientHeight / TERMINAL_LINE_HEIGHT));
    const columns = Math.max(40, Math.floor(clientWidth / ESTIMATED_CHAR_WIDTH));
    return { rows, columns };
  }, []);

  useEffect(() => {
    if (agent.currentSessionId) {
      sessionRef.current = agent.currentSessionId;
    }
  }, [agent.currentSessionId]);

  const startSession = useCallback(async () => {
    if (!hostRef.current || !isTauriAvailable()) {
      setPhase('error'); setErrorMsg('Tauri runtime not available.'); return;
    }
    if (!projectPath) {
      // Waiting for workspace to hydrate before spawning terminal
      return;
    }
    setPhase('booting'); setErrorMsg('');
    const { rows, columns } = computeGridDimensions();
    lastDimensionsRef.current = { rows, columns };
    const provider = agentProvider === 'custom' ? (agentCommand?.trim() || agentName?.trim() || 'terminal') : agentProvider;
    sessionRef.current = agentSessionId || sessionRef.current || `sess-${agentId}`;
    try {
      // Reconcile assigned skills before the CLI starts so native providers
      // discover the bundle on first boot and assisted providers receive a
      // valid path in the same workspace.
      const assignedSkills = useSkillStore.getState().getEquippedSkills(agentId);
      if (projectPath && assignedSkills.length > 0) {
        await ProviderSkillAdapterService.mountSkillsForProvider(projectPath, agentProvider, assignedSkills);
      }
      const isNewAgent = (Date.now() - (agent.createdAt || 0)) < 3500;
      const isResume = !!agentSessionId && !isNewAgent;
      setActiveSession(agentId, sessionRef.current);
      await tauriService.startNativeTerminal(
        sessionRef.current,
        agentId,
        provider,
        projectPath,
        rows,
        columns,
        agentRole,
        agentDirective,
        agentProfileId,
        isResume
      );
      await reattach();
      // Seed the initial display state with one snapshot fetch immediately after
      // the event subscription is live. All further updates arrive as real-time
      // event patches through attachNativeTerminal — no recurring poll needed.
      void tauriService.getNativeTerminalSnapshot(sessionRef.current)
        .then((snapshot) => storeRef.current?.apply({ type: 'snapshot', snapshot }))
        .catch(() => {});
      setPhase('active');
      resizeTerminal(agentId, rows, columns);

      // Re-verify grid dimensions immediately post-boot to catch any layout expansion
      // that occurred while the process was starting.
      const postBootDims = computeGridDimensions();
      if (postBootDims.rows !== rows || postBootDims.columns !== columns) {
        lastDimensionsRef.current = postBootDims;
        resizeTerminal(agentId, postBootDims.rows, postBootDims.columns);
        void tauriService.resizeNativeTerminal(sessionRef.current, postBootDims.rows, postBootDims.columns).catch(() => {
          void tauriService.resizeAgentTerminal(agentId, postBootDims.rows, postBootDims.columns).catch(() => {});
        });
      }
    } catch (error) {
      setPhase('error'); setErrorMsg(error instanceof Error ? error.message : String(error));
    }
  }, [agentCommand, agentDirective, agentId, agentName, agentProfileId, agentProvider, agentRole, agentSessionId, projectPath, computeGridDimensions, resizeTerminal, setActiveSession]);

  useEffect(() => {
    if (!projectPath) return;
    void startSession();

    const onVisibility = () => {
      if (!document.hidden && sessionRef.current) {
        void tauriService.getNativeTerminalSnapshot(sessionRef.current)
          .then((snapshot) => storeRef.current?.apply({ type: 'snapshot', snapshot }))
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      const subscription = subscriptionRef.current;
      subscriptionRef.current = null;
      void subscription?.detach().catch(() => {});
    };
  }, [agentId, projectPath, startSession]);

  useEffect(() => {
    if (!hostRef.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const { rows, columns } = computeGridDimensions();
        if (rows === lastDimensionsRef.current.rows && columns === lastDimensionsRef.current.columns) {
          return;
        }
        resizeTerminal(agentId, rows, columns);
        try {
          await tauriService.resizeNativeTerminal(sessionRef.current, rows, columns);
          lastDimensionsRef.current = { rows, columns };
        } catch {
          try {
            await tauriService.resizeAgentTerminal(agentId, rows, columns);
            lastDimensionsRef.current = { rows, columns };
          } catch {
            // Keep lastDimensionsRef unchanged so next resize cycle retries
          }
        }
      }, 50);
    });
    observer.observe(hostRef.current);
    return () => { observer.disconnect(); if (timer) clearTimeout(timer); };
  }, [agentId, computeGridDimensions, resizeTerminal]);

  const snapshot = useTerminalSnapshot(storeRef.current);
  const renderedSnapshot = snapshot || fallbackSnapshot;
  const providerLabel = agent.provider.charAt(0).toUpperCase() + agent.provider.slice(1).toLowerCase();
  const sendInput = (bytes: Uint8Array) => {
    try {
      if (bytes.length === 1 && bytes[0] === 127) {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
      } else if (bytes.length === 1 && bytes[0] === 13) {
        const line = inputBufferRef.current.trim();
        inputBufferRef.current = '';
        if (line) {
          try {
            conversationCaptureService.recordDirectUserMessage(sessionRef.current, line);
            useAgentStore.getState().addDirectMessage(sessionRef.current, {
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sessionId: sessionRef.current,
              role: 'user',
              content: line,
              timestamp: Date.now(),
            });
          } catch {}
        }
      } else {
        const decoded = new TextDecoder().decode(bytes);
        const cleanDecoded = decoded.replace(/\x1b\[20[01]~/g, '');
        if (cleanDecoded.includes('\r') || cleanDecoded.includes('\n')) {
          const fullText = (inputBufferRef.current + cleanDecoded).trim();
          inputBufferRef.current = '';
          const parts = fullText.split(/[\r\n]+/).map((p) => p.trim()).filter(Boolean);
          for (const line of parts) {
            try {
              conversationCaptureService.recordDirectUserMessage(sessionRef.current, line);
              useAgentStore.getState().addDirectMessage(sessionRef.current, {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                sessionId: sessionRef.current,
                role: 'user',
                content: line,
                timestamp: Date.now(),
              });
            } catch {}
          }
        } else if (!cleanDecoded.startsWith('\x1b')) {
          inputBufferRef.current += cleanDecoded;
        }
      }
    } catch {}

    void tauriService.sendNativeTerminalInput(sessionRef.current, bytes).catch((error) => {
      setPhase('error'); setErrorMsg(error instanceof Error ? error.message : String(error));
    });
  };
  const restart = async () => {
    await tauriService.stopNativeTerminal(sessionRef.current).catch(() => {});
    storeRef.current?.reset();
    setFallbackSnapshot(createBlankSnapshot(sessionRef.current, 30, 100));
    await startSession();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full relative overflow-hidden bg-panel">
      {phase === 'booting' && <div className="absolute inset-0 flex items-center justify-center bg-panel/80 backdrop-blur-sm z-20"><div className="flex items-center gap-2 text-xs font-mono text-text-primary"><span className="animate-pulse">▋</span><span>Spawning {providerLabel} CLI...</span></div></div>}
      {phase === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-panel/95 backdrop-blur-md z-20"><div className="max-w-md w-full p-5 rounded-2xl bg-well border border-rose-500/30 flex flex-col gap-3.5 shadow-xl"><div className="flex items-center gap-2.5 text-rose-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /><h3 className="font-mono font-bold text-xs">Could not start {providerLabel}</h3></div><div className="p-3 rounded-xl bg-black/50 border border-border font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">{errorMsg || 'Native terminal session failed.'}</div><div className="flex items-center justify-end"><button onClick={restart} className="px-3.5 py-1.5 rounded-xl bg-text-primary text-background text-xs font-mono font-bold cursor-pointer">Retry</button></div></div></div>}
      {phase === 'exited' && <div className="absolute bottom-0 left-0 right-0 px-3.5 py-2 bg-panel-elevated border-t border-border flex items-center justify-between z-20"><div className="flex items-center gap-2 text-[11px] font-mono text-text-muted"><span className="w-2 h-2 rounded-full bg-text-dim" /><span>Session finished</span></div><button onClick={restart} className="px-2.5 py-1 bg-well border border-border rounded text-[11px] font-mono cursor-pointer"><RotateCcw size={11} className="inline mr-1" />Restart</button></div>}
      <div ref={hostRef} className="w-full h-full p-0 overflow-hidden bg-[#090a0f]"><TerminalGridView snapshot={renderedSnapshot} onInput={sendInput} projectPath={projectPath} /></div>
      {phase === 'idle' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-panel z-20"><TerminalIcon size={18} className="text-text-primary" /><button onClick={startSession} className="flex items-center gap-2 px-4 py-2 bg-text-primary text-background rounded-lg text-xs font-mono font-bold cursor-pointer"><Play size={11} />Launch {providerLabel}</button></div>}
    </div>
  );
};
