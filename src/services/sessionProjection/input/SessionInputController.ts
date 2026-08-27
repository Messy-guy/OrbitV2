import { isTauriAvailable, tauriService } from '../../tauri.service';

interface QueuedInput {
  agentId: string;
  sessionId: string;
  bytes: string;
  resolve: () => void;
  reject: (err: any) => void;
}

export class SessionInputController {
  private queue: QueuedInput[] = [];
  private isProcessing = false;

  async enqueueInput(agentId: string, sessionId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const bytesWithEnter = text.endsWith('\r') || text.endsWith('\n') ? text : `${text}\r`;
      this.queue.push({
        agentId,
        sessionId,
        bytes: bytesWithEnter,
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
        await tauriService.sendAgentInput(item.agentId, item.sessionId, item.bytes);
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
