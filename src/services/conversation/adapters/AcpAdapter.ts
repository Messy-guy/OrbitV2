import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent, EngineManifest } from '../../../types/conversation';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class AcpAdapter implements EngineAdapter {
  readonly id = 'acp';
  readonly name = 'Agent Client Protocol (ACP)';

  private subscribers: Map<string, Set<(event: OrbitEngineEvent) => void>> = new Map();
  private manifests: Map<string, EngineManifest> = new Map();

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

  setManifestForSession(sessionId: string, manifest: EngineManifest) {
    this.manifests.set(sessionId, manifest);
  }

  async startSession(options: StartSessionOptions): Promise<void> {
    const { sessionId, projectPath, provider, taskDirective, workspaceId } = options;
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
        console.warn(`[AcpAdapter] Failed to start ACP session:`, err);
      });
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const cleanText = message.trim();
    if (!cleanText) return;

    // Send ACP JSON-RPC prompt message
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'session/prompt',
      params: { sessionId, message: cleanText },
    });

    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, `${payload}\r\n`).catch((err) => {
        console.warn(`[AcpAdapter] Failed to send ACP prompt:`, err);
      });
    }
  }

  async interrupt(sessionId: string): Promise<void> {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method: 'session/cancel',
      params: { sessionId },
    });

    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, `${payload}\r\n`).catch(() => {});
    }
  }

  async dispose(sessionId: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.stopAgentSession(sessionId).catch(() => {});
    }
    this.subscribers.delete(sessionId);
    this.manifests.delete(sessionId);
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
          console.error('[AcpAdapter] Emit callback error:', err);
        }
      }
    }
  }

  /**
   * Process incoming ACP JSON-RPC notifications and messages
   */
  processAcpMessage(sessionId: string, message: any) {
    const now = Date.now();
    const method = message.method;
    const params = message.params || {};

    switch (method) {
      case 'session/delta':
      case 'text/delta':
        this.emit(sessionId, {
          type: 'assistant_delta',
          text: params.text || params.delta || '',
          thought: params.thought,
          timestamp: now,
        });
        break;

      case 'session/complete':
      case 'message/complete':
        this.emit(sessionId, {
          type: 'assistant_completed',
          text: params.text || params.content || '',
          thought: params.thought,
          timestamp: now,
        });
        break;

      case 'tool/start':
        this.emit(sessionId, {
          type: 'activity_started',
          category: params.category || 'commands',
          summary: params.summary || `Running ${params.toolName}`,
          detail: params.detail,
          timestamp: now,
        });
        break;

      case 'tool/complete':
        this.emit(sessionId, {
          type: 'activity_completed',
          category: params.category || 'commands',
          summary: params.summary || `Completed ${params.toolName}`,
          detail: params.detail,
          timestamp: now,
        });
        break;

      case 'permission/request':
      case 'approval/request':
        this.emit(sessionId, {
          type: 'approval_requested',
          id: params.id || `app_${now}`,
          title: params.title || 'Agent requires permission',
          action: params.action || params.command || '',
          metadata: params.metadata,
          timestamp: now,
        });
        break;

      case 'session/status':
        this.emit(sessionId, {
          type: 'session_status_changed',
          status: params.status,
          timestamp: now,
        });
        break;

      case 'error':
        this.emit(sessionId, {
          type: 'error',
          message: params.message || 'Unknown ACP error',
          timestamp: now,
        });
        break;
    }
  }
}

export const acpAdapter = new AcpAdapter();
