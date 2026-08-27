import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent } from '../../../types/conversation';
import { HeadlessTerminalInterpreter } from '../../sessionProjection/terminal/HeadlessTerminalInterpreter';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class GenericPtyAdapter implements EngineAdapter {
  readonly id = 'pty';
  readonly name = 'Generic PTY CLI (Fallback)';
  
  private interpreters: Map<string, HeadlessTerminalInterpreter> = new Map();
  private subscribers: Map<string, Set<(event: OrbitEngineEvent) => void>> = new Map();
  private lastStreamedText: Map<string, string> = new Map();
  private currentTurnPrompt: Map<string, string> = new Map();
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
    if (!this.interpreters.has(sessionId)) {
      this.interpreters.set(sessionId, new HeadlessTerminalInterpreter(30, 100));
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

    this.currentTurnPrompt.set(sessionId, cleanText);
    this.lastStreamedText.set(sessionId, '');

    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, `${cleanText}\r\n`).catch((err) => {
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
    this.interpreters.delete(sessionId);
    this.subscribers.delete(sessionId);
    this.lastStreamedText.delete(sessionId);
    this.currentTurnPrompt.delete(sessionId);
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
   * Process incoming raw stdout from PTY runtime
   */
  processRawOutput(sessionId: string, bytes: string) {
    let interpreter = this.interpreters.get(sessionId);
    if (!interpreter) {
      interpreter = new HeadlessTerminalInterpreter(30, 100);
      this.interpreters.set(sessionId, interpreter);
    }

    const snapshot = interpreter.processBytes(bytes);
    const prompt = this.currentTurnPrompt.get(sessionId);
    const { text, isThinking, thought } = snapshot.getCleanConversationalText(prompt);

    if (thought) {
      this.emit(sessionId, {
        type: 'activity_started',
        category: 'other',
        summary: thought,
        timestamp: Date.now(),
      });
    }

    if (text && text.trim().length > 2 && !/^(Plan|Build|Chat|Explore):/i.test(text.trim())) {
      const last = this.lastStreamedText.get(sessionId) || '';
      if (text !== last) {
        this.lastStreamedText.set(sessionId, text);
        this.emit(sessionId, {
          type: 'assistant_delta',
          text,
          thought,
          timestamp: Date.now(),
        });

        // Debounce commit when stream goes quiet for 900ms
        const existingTimer = this.commitTimers.get(sessionId);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          this.commitTimers.delete(sessionId);
          this.emit(sessionId, {
            type: 'assistant_completed',
            text,
            thought,
            timestamp: Date.now(),
          });
        }, 900);

        this.commitTimers.set(sessionId, timer);
      }
    }
  }
}

export const genericPtyAdapter = new GenericPtyAdapter();
