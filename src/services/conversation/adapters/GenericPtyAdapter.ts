import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent } from '../../../types/conversation';
import { PtyCaptureSession } from '../../sessionProjection/state/PtyCaptureSession';
import { isTauriAvailable, tauriService } from '../../tauri.service';
import { useAgentStore } from '../../../stores/agent.store';
import { conversationStore } from '../ConversationStore';
import { agentProfileRegistry } from '../../remoteControl/AgentInteractionProfileRegistry';
import { deliverMessageToPty } from '../../remoteControl/ptyDelivery';
import { normalizeAssistantContent } from '../../sessionProjection/transcript/normalizeAssistant';

export class GenericPtyAdapter implements EngineAdapter {
  readonly id = 'pty';
  readonly name = 'Generic PTY CLI (Fallback)';

  private captureSessions: Map<string, PtyCaptureSession> = new Map();
  private subscribers: Map<string, Set<(event: OrbitEngineEvent) => void>> = new Map();
  private commitTimers: Map<string, NodeJS.Timeout> = new Map();
  // Priming state: a freshly-attached capture session must be primed with the
  // agent's authoritative PTY history BEFORE live bytes are classified, or the
  // agent's first full-screen repaint dumps the entire prior conversation into
  // the chat as "new" content (stale replies leaking into the reply bubble).
  private primingSessions: Set<string> = new Set();
  private pendingRawWhilePriming: Map<string, string> = new Map();

  capabilities(): EngineCapabilities {
    return {
      streaming: true,
      structuredEvents: false,
      structuredToolCalls: false,
      approvals: false,
      sessionResume: true,
      historyRecovery: false,
      fileEvents: false,
      commandEvents: false,
      thinkingEvents: false,
      nativeConversationHistory: false,
    };
  }

  private createCapture(sessionId: string): PtyCaptureSession {
    let capture = this.captureSessions.get(sessionId);
    if (!capture) {
      capture = new PtyCaptureSession(sessionId, 30, 100);
      this.captureSessions.set(sessionId, capture);
    }
    return capture;
  }

  /**
   * Prime a capture session with the agent's PTY history (fire-and-forget).
   * Raw output arriving while the history fetch is in flight is buffered and
   * replayed after the baseline freeze, so no live content is lost or leaked.
   */
  ensureSessionPrimed(sessionId: string) {
    if (!isTauriAvailable()) return;
    const capture = this.captureSessions.get(sessionId);
    if (capture?.isPrimed()) return;
    if (this.primingSessions.has(sessionId)) return;

    this.primingSessions.add(sessionId);
    (async () => {
      try {
        const history = await tauriService.getAgentTerminalHistory(sessionId).catch(() => '');
        const target = this.createCapture(sessionId);
        if (history && history.trim()) {
          target.primeFromHistory(history);
        } else {
          target.markPrimed();
        }
        // Seed the prompt ledger from the canonical conversation store so past
        // user prompts re-rendered by the TUI on resume are never prose.
        try {
          const canonical = conversationStore.getSession(sessionId);
          const pastPrompts: string[] = [];
          for (const turn of canonical?.conversation.turns || []) {
            if (turn.role !== 'user') continue;
            for (const msg of turn.messages) {
              for (const c of msg.content) {
                if (c.type === 'text' && c.text?.trim()) pastPrompts.push(c.text);
              }
            }
          }
          if (pastPrompts.length) target.seedPromptFingerprints(pastPrompts);
        } catch {}
      } catch {
        this.createCapture(sessionId).markPrimed();
      } finally {
        this.primingSessions.delete(sessionId);
        const buffered = this.pendingRawWhilePriming.get(sessionId);
        this.pendingRawWhilePriming.delete(sessionId);
        if (buffered) this.processRawOutput(sessionId, buffered);
      }
    })();
  }

  async startSession(options: StartSessionOptions): Promise<void> {
    const { sessionId, projectPath, provider, taskDirective, workspaceId } = options;
    this.createCapture(sessionId);
    this.ensureSessionPrimed(sessionId);

    if (isTauriAvailable()) {
      await tauriService.startAgentSession(
        projectPath,
        sessionId,
        sessionId,
        provider,
        taskDirective,
        workspaceId,
        24,
        80
      ).catch((err) => {
        console.warn(`[GenericPtyAdapter] Failed to start session:`, err);
      });
    }
  }

  /** INV-22 — expose the capture session for prompt-ledger seeding. */
  getCaptureSession(sessionId: string): PtyCaptureSession | undefined {
    return this.captureSessions.get(sessionId);
  }

  startTurn(sessionId: string, userPrompt: string, turnId?: string, userMessageId?: string): void {
    const cleanText = (userPrompt || '').trim();
    const capture = this.createCapture(sessionId);
    this.ensureSessionPrimed(sessionId);
    const resolvedTurnId = turnId || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    capture.startTurn(resolvedTurnId, cleanText, userMessageId);
  }

  commitTurn(sessionId: string, turnId?: string): void {
    const flushTimer = this.bufferFlushTimers.get(sessionId);
    if (flushTimer) {
      clearTimeout(flushTimer);
      this.bufferFlushTimers.delete(sessionId);
      const buffered = this.pendingByteBuffers.get(sessionId);
      this.pendingByteBuffers.delete(sessionId);
      if (buffered) {
        this.executeProcessRawOutput(sessionId, buffered);
      }
    }

    const capture = this.captureSessions.get(sessionId);
    if (capture) {
      capture.commitTurn(turnId);
    }
    const timer = this.commitTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.commitTimers.delete(sessionId);
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const cleanText = message.trim();
    if (!cleanText) return;

    this.startTurn(sessionId, cleanText);

    if (isTauriAvailable()) {
      const agents = useAgentStore.getState().agents;
      let agent =
        agents.find((a) => a.id === sessionId || a.currentSessionId === sessionId) ||
        agents.find((a) => {
          const activeSess = useAgentStore.getState().activeSessionIdByAgent[a.id];
          return activeSess === sessionId;
        });

      let agentId = agent ? agent.id : sessionId;
      if (!agent && (agentId === sessionId || agentId.startsWith('sess-'))) {
        try {
          const { conversationCaptureService } = await import('../ConversationCaptureService');
          const boundAgentId = conversationCaptureService.getAgentIdForSession(sessionId);
          if (boundAgentId) {
            agentId = boundAgentId;
            agent = agents.find((a) => a.id === boundAgentId);
          }
        } catch {}
      }

      const profile = agentProfileRegistry.getProfile(agent?.provider || 'terminal');

      // Profile-aware delivery: wait for the TUI input surface (Mimo/Vibe/etc.), type
      // per-char when required, and ALWAYS send the submit key — a bare payload with
      // no `\r` leaves the text unsubmitted in the agent's input box (frozen agent).
      // Rethrow so callers (agent.store) can run their dead-session restart fallback.
      await deliverMessageToPty(agentId, sessionId, cleanText, profile);
    }
  }

  async interrupt(sessionId: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, '\x03').catch(() => {});
    }
  }

  async dispose(sessionId: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.stopAgentSession(sessionId).catch(() => {});
    }
    const flushTimer = this.bufferFlushTimers.get(sessionId);
    if (flushTimer) {
      clearTimeout(flushTimer);
      this.bufferFlushTimers.delete(sessionId);
    }
    this.pendingByteBuffers.delete(sessionId);
    const capture = this.captureSessions.get(sessionId);
    if (capture) {
      capture.dispose();
      this.captureSessions.delete(sessionId);
    }
    this.subscribers.delete(sessionId);
    const timer = this.commitTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.commitTimers.delete(sessionId);
    }
  }

  subscribe(sessionId: string, callback: (event: OrbitEngineEvent) => void): Unsubscribe {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(callback);
    return () => {
      this.subscribers.get(sessionId)?.delete(callback);
    };
  }

  private emit(sessionId: string, event: OrbitEngineEvent) {
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      for (const cb of subs) {
        try {
          cb(event);
        } catch (err) {
          console.error('[GenericPtyAdapter] Emit callback error:', err);
        }
      }
    }
  }

  private pendingByteBuffers: Map<string, string> = new Map();
  private bufferFlushTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Process incoming raw stdout from PTY runtime through stateful differential capture
   */
  processRawOutput(sessionId: string, bytes: string) {
    // Buffer raw bytes while the history prime is in flight — classifying them
    // against an unprimed baseline would leak the stale on-screen conversation.
    if (this.primingSessions.has(sessionId)) {
      const existing = this.pendingRawWhilePriming.get(sessionId) || '';
      this.pendingRawWhilePriming.set(sessionId, existing + bytes);
      return;
    }

    this.ensureSessionPrimed(sessionId);

    const existing = this.pendingByteBuffers.get(sessionId) || '';
    this.pendingByteBuffers.set(sessionId, existing + bytes);

    if (!this.bufferFlushTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.bufferFlushTimers.delete(sessionId);
        const buffered = this.pendingByteBuffers.get(sessionId);
        this.pendingByteBuffers.delete(sessionId);
        if (buffered) {
          this.executeProcessRawOutput(sessionId, buffered);
        }
      }, 40);
      this.bufferFlushTimers.set(sessionId, timer);
    }
  }

  private executeProcessRawOutput(sessionId: string, bytes: string) {
    const capture = this.createCapture(sessionId);

    try {
      const result = capture.processPtyBytes(bytes);
      // INV-7 — every emitted event carries the turn that owns it. The capture
      // session returns turnId: null when no turn is active, in which case the
      // lifecycle gate already suppressed all conversational output.
      const activeTurnId = result.turnId || undefined;

      // 1. Emit extracted tool activities
      for (const act of result.activities) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: act.category,
          summary: act.summary,
          detail: act.details?.[0],
          turnId: activeTurnId,
          timestamp: Date.now(),
        });
      }

      // 2. Emit compact thinking activity if present
      if (result.thought) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: 'other',
          summary: result.thought,
          turnId: activeTurnId,
          timestamp: Date.now(),
        });
      }

      // 3. Emit assistant_delta ONLY for true newly appeared user-facing assistant content
      const userText = normalizeAssistantContent(result.userFacingText);
      if (userText && userText.trim().length > 0 && !/^(Plan|Build|Chat|Explore):/i.test(userText.trim())) {
        this.emit(sessionId, {
          type: 'assistant_delta',
          text: userText,
          thought: result.thought,
          turnId: activeTurnId,
          timestamp: Date.now(),
        });

        // Debounce commit when stream goes quiet for 900ms
        const existingTimer = this.commitTimers.get(sessionId);
        if (existingTimer) clearTimeout(existingTimer);

        const committedTurnId = activeTurnId;
        const timer = setTimeout(() => {
          this.commitTimers.delete(sessionId);
          capture?.commitTurn();
          this.emit(sessionId, {
            type: 'assistant_completed',
            text: userText,
            thought: result.thought,
            turnId: committedTurnId,
            timestamp: Date.now(),
          });
        }, 900);

        this.commitTimers.set(sessionId, timer);
      }
    } catch (err) {
      console.warn('[GenericPtyAdapter] Passive observation parsing error (terminal unaffected):', err);
    }
  }
}

export const genericPtyAdapter = new GenericPtyAdapter();
