import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent, ConversationTurn, ActivitySummary } from '../../../types/conversation';
import { genericPtyAdapter } from './GenericPtyAdapter';
import { PtyCaptureSession } from '../../sessionProjection/state/PtyCaptureSession';

export class AgyAdapter implements EngineAdapter {
  readonly id = 'antigravity';
  readonly name = 'Antigravity CLI (AGY)';

  capabilities(): EngineCapabilities {
    return genericPtyAdapter.capabilities();
  }

  ensureSessionPrimed(sessionId: string) {
    genericPtyAdapter.ensureSessionPrimed(sessionId);
  }

  getCaptureSession(sessionId: string): PtyCaptureSession | undefined {
    return genericPtyAdapter.getCaptureSession(sessionId);
  }

  startTurn(sessionId: string, userPrompt: string, turnId?: string, userMessageId?: string): void {
    genericPtyAdapter.startTurn(sessionId, userPrompt, turnId, userMessageId);
  }

  commitTurn(sessionId: string, turnId?: string): void {
    genericPtyAdapter.commitTurn(sessionId, turnId);
  }

  async startSession(options: StartSessionOptions): Promise<void> {
    return genericPtyAdapter.startSession(options);
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    return genericPtyAdapter.sendMessage(sessionId, message);
  }

  async interrupt(sessionId: string): Promise<void> {
    return genericPtyAdapter.interrupt(sessionId);
  }

  async dispose(sessionId: string): Promise<void> {
    return genericPtyAdapter.dispose(sessionId);
  }

  subscribe(sessionId: string, callback: (event: OrbitEngineEvent) => void): Unsubscribe {
    return genericPtyAdapter.subscribe(sessionId, callback);
  }

  processRawOutput(sessionId: string, bytes: string) {
    genericPtyAdapter.processRawOutput(sessionId, bytes);
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
