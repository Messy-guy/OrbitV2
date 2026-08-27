import { HeadlessTerminalInterpreter } from './terminal/HeadlessTerminalInterpreter';
import { rawPtyArchive } from './terminal/RawPtyArchive';
import { StabilityController } from './transcript/StabilityController';
import { sessionEventStore } from './events/SessionEventStore';
import { OrbitInputRouter } from './input/OrbitInputRouter';
import { OrbitSessionEvent, SessionCapabilities } from './events/OrbitSessionEvent';

class SessionProjectionGateway {
  private interpreters: Map<string, HeadlessTerminalInterpreter> = new Map();
  private stabilityControllers: Map<string, StabilityController> = new Map();
  private onSyncCallback?: () => void;

  setSyncCallback(cb: () => void) {
    this.onSyncCallback = cb;
  }

  private triggerSync() {
    if (this.onSyncCallback) {
      this.onSyncCallback();
    }
  }

  getCapabilities(provider: string): SessionCapabilities {
    return {
      universalPtyProjection: true,
      structuredHistory: provider === 'antigravity' || provider === 'claude',
      nativeResume: provider === 'antigravity' || provider === 'claude',
      nativeToolEvents: true,
      nativeSessionId: true,
    };
  }

  handleTerminalResize(agentId: string, rows: number, cols: number) {
    const interpreter = this.interpreters.get(agentId);
    if (interpreter) {
      interpreter.resize(rows, cols);
    }
  }

  processPtyOutput(agentId: string, bytes: string, stream: 'stdout' | 'stderr' = 'stdout') {
    // 1. Permanent Raw PTY byte archival
    rawPtyArchive.append(agentId, bytes, stream);

    // 2. Feed into dynamic Headless Terminal Interpreter
    let interpreter = this.interpreters.get(agentId);
    if (!interpreter) {
      interpreter = new HeadlessTerminalInterpreter(30, 100);
      this.interpreters.set(agentId, interpreter);
    }

    const snapshot = interpreter.processBytes(bytes);

    // 3. Process through Stability Controller (150ms flush / 1000ms commit)
    let controller = this.stabilityControllers.get(agentId);
    if (!controller) {
      controller = new StabilityController(agentId);
      this.stabilityControllers.set(agentId, controller);
    }

    controller.handleScreenUpdate(
      snapshot,
      () => this.triggerSync(), // On fast draft flush
      () => this.triggerSync()  // On permanent event commit
    );
  }

  async handleUserInput(agentId: string, sessionId: string, text: string): Promise<void> {
    let controller = this.stabilityControllers.get(agentId);
    if (!controller) {
      controller = new StabilityController(agentId);
      this.stabilityControllers.set(agentId, controller);
    }

    // Set new turn prompt anchor
    controller.setLatestUserPrompt(text);

    await OrbitInputRouter.submitUserMessage(agentId, sessionId, text);
    this.triggerSync();
  }

  getProjectedConversation(agentId: string): OrbitSessionEvent[] {
    return sessionEventStore.getProjectedEvents(agentId);
  }

  cleanupSession(agentId: string) {
    this.interpreters.delete(agentId);
    this.stabilityControllers.delete(agentId);
    sessionEventStore.clearSession(agentId);
    rawPtyArchive.clear(agentId);
  }
}

export const sessionProjectionGateway = new SessionProjectionGateway();
