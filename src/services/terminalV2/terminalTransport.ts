import {
  tauriService,
  TerminalStreamAttach,
  TerminalStreamFrame,
} from '../tauri.service';

export type TerminalFrameHandler = (frame: TerminalStreamFrame) => void;

/**
 * Owns one session-scoped attach lifecycle. It drops duplicates and performs
 * a bounded replay reattach when a sequence gap is observed. The PTY process
 * is never stopped by this class; detaching only removes the renderer channel.
 */
export class TerminalSessionTransport {
  private attachment: (TerminalStreamAttach & { detach: () => Promise<void> }) | null = null;
  private lastSequence = 0;
  private resyncing = false;

  constructor(
    private readonly sessionId: string,
    private readonly onFrame: TerminalFrameHandler,
    private readonly onError?: (message: string) => void,
  ) {}

  get currentSequence(): number {
    return this.lastSequence;
  }

  async attach(fromSequence = 0): Promise<TerminalStreamAttach> {
    this.lastSequence = fromSequence;
    this.attachment = await tauriService.attachTerminalStream(
      this.sessionId,
      fromSequence,
      (frame) => this.receive(frame),
    );
    return this.attachment;
  }

  private receive(frame: TerminalStreamFrame) {
    if (frame.sequence <= this.lastSequence) return;
    if (this.lastSequence > 0 && frame.sequence > this.lastSequence + 1) {
      void this.resync();
      return;
    }
    this.lastSequence = frame.sequence;
    this.onFrame(frame);
  }

  private async resync() {
    if (this.resyncing) return;
    this.resyncing = true;
    try {
      const previous = this.attachment;
      this.attachment = null;
      if (previous) await previous.detach().catch(() => {});
      this.attachment = await tauriService.attachTerminalStream(
        this.sessionId,
        this.lastSequence,
        (frame) => this.receive(frame),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.onError?.(`Terminal stream resync failed: ${message}`);
    } finally {
      this.resyncing = false;
    }
  }

  async detach(): Promise<void> {
    const attachment = this.attachment;
    this.attachment = null;
    if (attachment) await attachment.detach().catch(() => {});
  }
}
