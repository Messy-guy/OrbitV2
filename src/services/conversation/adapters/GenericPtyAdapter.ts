import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent } from '../../../types/conversation';
import { PtyCaptureSession } from '../../sessionProjection/state/PtyCaptureSession';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class GenericPtyAdapter implements EngineAdapter {
  readonly id = 'pty';
  readonly name = 'Generic PTY CLI (Fallback)';
  
  private captureSessions: Map<string, PtyCaptureSession> = new Map();
  private subscribers: Map<string, Set<(event: OrbitEngineEvent) => void>> = new Map();
  private commitTimers: Map<string, NodeJS.Timeout> = new Map();

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

  async startSession(options: StartSessionOptions): Promise<void> {
    const { sessionId, projectPath, provider, taskDirective, workspaceId } = options;
    if (!this.captureSessions.has(sessionId)) {
      this.captureSessions.set(sessionId, new PtyCaptureSession(sessionId, 30, 100));
    }

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

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const cleanText = message.trim();
    if (!cleanText) return;

    let capture = this.captureSessions.get(sessionId);
    if (!capture) {
      capture = new PtyCaptureSession(sessionId, 30, 100);
      this.captureSessions.set(sessionId, capture);
    }
    // Freeze current terminal state into the TurnBaseline before the agent responds
    capture.startTurn(`turn_${Date.now()}`, cleanText);

    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, `${cleanText}\r`).catch((err) => {
        console.warn(`[GenericPtyAdapter] Failed to send input:`, err);
      });
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

  /**
   * Process incoming raw stdout from PTY runtime through stateful differential capture
   */
  processRawOutput(sessionId: string, bytes: string) {
    let capture = this.captureSessions.get(sessionId);
    if (!capture) {
      capture = new PtyCaptureSession(sessionId, 30, 100);
      this.captureSessions.set(sessionId, capture);
    }

    try {
      const result = capture.processPtyBytes(bytes);

      // 1. Emit extracted tool activities
      for (const act of result.activities) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: act.category,
          summary: act.summary,
          detail: act.details?.[0],
          timestamp: Date.now(),
        });
      }

      // 2. Emit compact thinking activity if present
      if (result.thought) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: 'other',
          summary: result.thought,
          timestamp: Date.now(),
        });
      }

      // 3. Emit assistant_delta ONLY for true newly appeared user-facing assistant content
      const userText = result.userFacingText;
      if (userText && userText.trim().length > 0 && !/^(Plan|Build|Chat|Explore):/i.test(userText.trim())) {
        this.emit(sessionId, {
          type: 'assistant_delta',
          text: userText,
          thought: result.thought,
          timestamp: Date.now(),
        });

        // Debounce commit when stream goes quiet for 900ms
        const existingTimer = this.commitTimers.get(sessionId);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          this.commitTimers.delete(sessionId);
          capture?.commitTurn();
          this.emit(sessionId, {
            type: 'assistant_completed',
            text: userText,
            thought: result.thought,
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
