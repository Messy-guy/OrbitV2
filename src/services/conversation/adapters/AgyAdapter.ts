import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent, ConversationTurn, ActivitySummary } from '../../../types/conversation';
import { PtyCaptureSession } from '../../sessionProjection/state/PtyCaptureSession';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class AgyAdapter implements EngineAdapter {
  readonly id = 'antigravity';
  readonly name = 'Antigravity CLI (AGY)';

  private captureSessions: Map<string, PtyCaptureSession> = new Map();
  private subscribers: Map<string, Set<(event: OrbitEngineEvent) => void>> = new Map();
  private commitTimers: Map<string, NodeJS.Timeout> = new Map();

  capabilities(): EngineCapabilities {
    return {
      streaming: true,
      structuredEvents: true,
      structuredToolCalls: true,
      approvals: true,
      sessionResume: true,
      historyRecovery: true,
      fileEvents: true,
      commandEvents: true,
      thinkingEvents: true,
      nativeConversationHistory: true,
    };
  }

  async startSession(options: StartSessionOptions): Promise<void> {
    const { sessionId, projectPath, taskDirective, workspaceId } = options;
    if (!this.captureSessions.has(sessionId)) {
      this.captureSessions.set(sessionId, new PtyCaptureSession(sessionId, 30, 100));
    }

    if (isTauriAvailable()) {
      await tauriService.startAgentSession(
        projectPath,
        sessionId,
        sessionId,
        'antigravity',
        taskDirective,
        workspaceId,
        24,
        80
      ).catch((err) => {
        console.warn(`[AgyAdapter] Failed to start AGY session:`, err);
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
    capture.startTurn(`turn_${Date.now()}`, cleanText);

    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, cleanText).catch((err) => {
        console.warn(`[AgyAdapter] Failed to send input to AGY:`, err);
      });
      await new Promise((r) => setTimeout(r, 30));
      await tauriService.sendAgentInput(sessionId, sessionId, '\r').catch((err) => {
        console.warn(`[AgyAdapter] Failed to send submit key to AGY:`, err);
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
          console.error('[AgyAdapter] Emit error:', err);
        }
      }
    }
  }

  /**
   * Process raw stdout from AGY PTY runtime through stateful differential capture
   */
  processRawOutput(sessionId: string, bytes: string) {
    let capture = this.captureSessions.get(sessionId);
    if (!capture) {
      capture = new PtyCaptureSession(sessionId, 30, 100);
      this.captureSessions.set(sessionId, capture);
    }

    try {
      const result = capture.processPtyBytes(bytes);

      // 1. Emit tool activities
      for (const act of result.activities) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: act.category,
          summary: act.summary,
          detail: act.details?.[0],
          timestamp: Date.now(),
        });
      }

      // 2. Emit compact thinking
      if (result.thought) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: 'other',
          summary: result.thought,
          timestamp: Date.now(),
        });
      }

      // 3. Emit assistant delta only for true newly appeared user-facing text
      const userText = result.userFacingText;
      if (userText && userText.trim().length > 2 && !/^(Plan|Build|Chat|Explore):/i.test(userText.trim())) {
        this.emit(sessionId, {
          type: 'assistant_delta',
          text: userText,
          thought: result.thought,
          timestamp: Date.now(),
        });

        // Debounce commit when AGY output settles for 900ms
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
      console.warn('[AgyAdapter] Passive observation parsing error (terminal unaffected):', err);
    }
  }

  /**
   * Parse native AGY JSONL transcript lines into canonical turns
   */
  static parseNativeJsonl(jsonlContent: string, agentId: string): ConversationTurn[] {
    const lines = jsonlContent.split('\n').filter((l) => l.trim().length > 0);
    const turns: ConversationTurn[] = [];

    for (const rawLine of lines) {
      try {
        const item = JSON.parse(rawLine);
        const timestamp = item.created_at ? new Date(item.created_at).getTime() : Date.now();

        if (item.type === 'USER_INPUT' && item.content) {
          // Clean prompt metadata XML tags
          let prompt = String(item.content)
            .replace(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/g, '$1')
            .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
            .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/g, '')
            .trim();

          if (prompt) {
            turns.push({
              id: `turn_u_${item.step_index || Date.now()}`,
              role: 'user',
              messages: [
                {
                  id: `msg_u_${item.step_index || Date.now()}`,
                  role: 'user',
                  content: [{ type: 'text', text: prompt }],
                  createdAt: timestamp,
                },
              ],
              startedAt: timestamp,
              completedAt: timestamp,
              status: 'complete',
            });
          }
        } else if (item.type === 'PLANNER_RESPONSE') {
          const contentText = item.content || '';
          const activities: ActivitySummary[] = [];

          if (item.thinking) {
            activities.push({
              id: `act_th_${item.step_index || Date.now()}`,
              category: 'other',
              summary: `Thought Process (${item.thinking.slice(0, 50)}...)`,
              startedAt: timestamp,
              completedAt: timestamp,
            });
          }

          if (item.tool_calls && Array.isArray(item.tool_calls)) {
            for (const call of item.tool_calls) {
              const name = call.name || 'tool';
              const cat = name.includes('file') ? 'files' : name.includes('command') ? 'commands' : 'search';
              activities.push({
                id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                category: cat,
                summary: `${call.toolSummary || name}`,
                startedAt: timestamp,
                completedAt: timestamp,
              });
            }
          }

          if (contentText.trim() || activities.length > 0) {
            const lastTurn = turns[turns.length - 1];

            if (lastTurn && lastTurn.role === 'agent') {
              // Merge into existing agent turn
              if (activities.length > 0) {
                lastTurn.activities = [...(lastTurn.activities || []), ...activities];
              }
              if (contentText.trim()) {
                const existingMsg = lastTurn.messages.find((m) => m.role === 'assistant');
                if (existingMsg) {
                  existingMsg.content = [{ type: 'markdown', markdown: contentText }];
                } else {
                  lastTurn.messages.push({
                    id: `msg_a_${item.step_index || Date.now()}`,
                    role: 'assistant',
                    content: [{ type: 'markdown', markdown: contentText }],
                    createdAt: timestamp,
                    streaming: false,
                  });
                }
              }
              lastTurn.completedAt = timestamp;
            } else {
              turns.push({
                id: `turn_a_${item.step_index || Date.now()}`,
                role: 'agent',
                messages: [
                  {
                    id: `msg_a_${item.step_index || Date.now()}`,
                    role: 'assistant',
                    content: [{ type: 'markdown', markdown: contentText }],
                    createdAt: timestamp,
                    streaming: false,
                  },
                ],
                activities: activities.length > 0 ? activities : undefined,
                startedAt: timestamp,
                completedAt: timestamp,
                status: 'complete',
              });
            }
          }
        }
      } catch {
        // Skip malformed JSONL lines
      }
    }

    return turns;
  }
}

export const agyAdapter = new AgyAdapter();
