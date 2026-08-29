import { isTauriAvailable, tauriService } from '../../tauri.service';
import { useAgentStore } from '../../../stores/agent.store';
import { agentProfileRegistry } from '../../remoteControl/AgentInteractionProfileRegistry';

interface QueuedInput {
  agentId: string;
  sessionId: string;
  payload: string;
  submitKey: string;
  preSubmitDelayMs?: number;
  resolve: () => void;
  reject: (err: any) => void;
}

export class SessionInputController {
  private queue: QueuedInput[] = [];
  private isProcessing = false;

  async enqueueInput(agentId: string, sessionId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const agent = useAgentStore.getState().agents.find((a) => a.id === agentId || a.currentSessionId === sessionId);
      const profile = agentProfileRegistry.getProfile(agent?.provider || 'terminal');
      const submission = profile.formatSubmission(text);

      this.queue.push({
        agentId,
        sessionId,
        payload: submission.payload,
        submitKey: submission.submitKey,
        preSubmitDelayMs: submission.preSubmitDelayMs,
        resolve,
        reject,
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const item = this.queue.shift()!;
    try {
      if (isTauriAvailable()) {
        await tauriService.sendAgentInput(item.agentId, item.sessionId, item.payload);
        if (item.preSubmitDelayMs && item.preSubmitDelayMs > 0) {
          await new Promise((r) => setTimeout(r, item.preSubmitDelayMs));
        }
        await tauriService.sendAgentInput(item.agentId, item.sessionId, item.submitKey);
      }
      item.resolve();
    } catch (err) {
      item.reject(err);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }
}

export const sessionInputController = new SessionInputController();
