import { conversationStore } from './ConversationStore';
import { genericPtyAdapter } from './adapters/GenericPtyAdapter';
import { agyAdapter, AgyAdapter } from './adapters/AgyAdapter';
import { jsonlAdapter, JsonlAdapter } from './adapters/JsonlAdapter';
import { acpAdapter, AcpAdapter } from './adapters/AcpAdapter';
import { EngineAdapter } from './adapters/EngineAdapter';
import { engineManifestRegistry } from './EngineManifestRegistry';
import { OrbitSession, OrbitEngineEvent } from '../../types/conversation';

class ConversationCaptureService {
  private adapters: Map<string, EngineAdapter> = new Map();
  private sessionAdapters: Map<string, string> = new Map(); // sessionId -> adapterId
  private activeSubscriptions: Map<string, () => void> = new Map();

  constructor() {
    this.registerAdapter(genericPtyAdapter);
    this.registerAdapter(agyAdapter);
    this.registerAdapter(jsonlAdapter);
    this.registerAdapter(acpAdapter);
  }

  registerAdapter(adapter: EngineAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapterForSession(sessionId: string): EngineAdapter {
    const adapterId = this.sessionAdapters.get(sessionId) || 'pty';
    return this.adapters.get(adapterId) || genericPtyAdapter;
  }

  /**
   * Bind any agent session (known or unknown future engine) to the universal conversation capture system
   */
  bindSession(
    sessionId: string,
    projectId: string,
    workspaceId: string,
    engineInfo: { id: string; name: string; provider: string },
    title?: string
  ): OrbitSession {
    const manifest = engineManifestRegistry.getManifest(engineInfo.provider || engineInfo.id);

    // Route based on transport
    let adapterId = 'pty';
    if (engineInfo.provider === 'antigravity' || engineInfo.provider === 'agy') {
      adapterId = 'antigravity';
    } else if (manifest.transport === 'acp') {
      adapterId = 'acp';
      acpAdapter.setManifestForSession(sessionId, manifest);
    } else if (manifest.transport === 'jsonl') {
      adapterId = 'jsonl';
      jsonlAdapter.setManifestForSession(sessionId, manifest);
    } else {
      adapterId = 'pty';
    }

    this.sessionAdapters.set(sessionId, adapterId);

    const session = conversationStore.getOrCreateSession(
      sessionId,
      projectId,
      workspaceId,
      {
        id: engineInfo.id,
        name: engineInfo.name || manifest.name,
        provider: engineInfo.provider || manifest.id,
        transport: manifest.transport,
      },
      title
    );

    const adapter = this.getAdapterForSession(sessionId);

    // Set up subscription to canonical adapter events
    if (!this.activeSubscriptions.has(sessionId)) {
      const unsub = adapter.subscribe(sessionId, (event: OrbitEngineEvent) => {
        switch (event.type) {
          case 'user_message':
            // If the user message arrived via native engine event
            conversationStore.addUserMessage(sessionId, event.text);
            break;

          case 'assistant_delta':
            conversationStore.updateStreamingAssistant(sessionId, event.text, event.thought);
            break;

          case 'assistant_completed':
            conversationStore.completeAgentMessage(sessionId, event.text, event.thought);
            break;

          case 'activity_started':
          case 'activity_updated':
          case 'activity_completed':
            conversationStore.appendActivity(sessionId, event.category, event.summary, event.detail);
            break;

          case 'approval_requested':
            conversationStore.appendActivity(sessionId, 'approvals', `Needs Approval: ${event.title}`, {
              id: event.id,
              type: 'custom',
              description: event.action,
              metadata: event.metadata,
            });
            conversationStore.setSessionStatus(sessionId, 'input_required');
            break;

          case 'session_status_changed':
            conversationStore.setSessionStatus(sessionId, event.status);
            break;

          case 'error':
            conversationStore.setSessionStatus(sessionId, 'error');
            break;

          case 'session_completed':
            conversationStore.setSessionStatus(sessionId, 'completed');
            break;

          case 'session_interrupted':
            conversationStore.setSessionStatus(sessionId, 'waiting');
            break;
        }
      });
      this.activeSubscriptions.set(sessionId, unsub);
    }

    return session;
  }

  /**
   * Authoritatively submit a user message to a session and dispatch to the engine adapter
   */
  async submitUserMessage(sessionId: string, message: string): Promise<void> {
    const cleanText = message.trim();
    if (!cleanText) return;

    // 1. Authoritatively record the user turn in the canonical conversation store
    conversationStore.addUserMessage(sessionId, cleanText);

    // 2. Dispatch to the engine adapter for execution
    const adapter = this.getAdapterForSession(sessionId);
    await adapter.sendMessage(sessionId, cleanText);
  }

  /**
   * Process raw stdout/stderr chunks from desktop runtime
   */
  handlePtyOutput(sessionId: string, text: string) {
    const adapter = this.getAdapterForSession(sessionId);
    if (adapter instanceof AgyAdapter || (adapter as any).processRawOutput) {
      (adapter as any).processRawOutput(sessionId, text);
    } else if (adapter instanceof JsonlAdapter || (adapter as any).processStreamChunk) {
      (adapter as any).processStreamChunk(sessionId, text);
    } else {
      genericPtyAdapter.processRawOutput(sessionId, text);
    }
  }

  /**
   * Process structured ACP / JSON-RPC messages from desktop runtime
   */
  handleAcpMessage(sessionId: string, message: any) {
    const adapter = this.getAdapterForSession(sessionId);
    if (adapter instanceof AcpAdapter || (adapter as any).processAcpMessage) {
      (adapter as any).processAcpMessage(sessionId, message);
    }
  }

  /**
   * Update runtime alive / process status
   */
  handleProcessStatus(sessionId: string, status: string, pid?: number) {
    const isAlive = status === 'working' || status === 'running' || status === 'active' || status === 'started' || status === 'ready';
    let canonicalStatus: import('../../types/conversation').SessionStatus = 'offline';
    if (status === 'working' || status === 'running' || status === 'active') {
      canonicalStatus = 'working';
    } else if (status === 'ready' || status === 'waiting' || status === 'started') {
      canonicalStatus = 'waiting';
    } else if (status === 'error') {
      canonicalStatus = 'error';
    } else if (status === 'exited' || status === 'stopped') {
      canonicalStatus = 'offline';
    }
    conversationStore.setRuntimeAlive(sessionId, isAlive, pid, canonicalStatus);
  }
}

export const conversationCaptureService = new ConversationCaptureService();
