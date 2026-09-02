import { conversationStore } from './ConversationStore';
import { genericPtyAdapter } from './adapters/GenericPtyAdapter';
import { agyAdapter, AgyAdapter } from './adapters/AgyAdapter';
import { jsonlAdapter, JsonlAdapter } from './adapters/JsonlAdapter';
import { acpAdapter, AcpAdapter } from './adapters/AcpAdapter';
import { EngineAdapter } from './adapters/EngineAdapter';
import { engineManifestRegistry } from './EngineManifestRegistry';
import { OrbitSession, OrbitEngineEvent } from '../../types/conversation';
import { pendingInputEchoQueue } from '../sessionProjection/input/PendingInputEchoQueue';
import { useAgentStore } from '../../stores/agent.store';

class ConversationCaptureService {
  private adapters: Map<string, EngineAdapter> = new Map();
  private sessionAdapters: Map<string, string> = new Map(); // sessionId -> adapterId
  private sessionToAgentId: Map<string, string> = new Map(); // sessionId -> agentId
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

  getAgentIdForSession(sessionId: string): string | undefined {
    return this.sessionToAgentId.get(sessionId);
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
    if (manifest.transport === 'acp') {
      adapterId = 'acp';
      acpAdapter.setManifestForSession(sessionId, manifest);
    } else if (manifest.transport === 'jsonl') {
      adapterId = 'jsonl';
      jsonlAdapter.setManifestForSession(sessionId, manifest);
    } else {
      adapterId = 'pty';
    }

    this.sessionAdapters.set(sessionId, adapterId);
    this.sessionToAgentId.set(sessionId, engineInfo.id);

    console.log(
      `[SESSION] bind agent=${engineInfo.id} session=${sessionId} project=${projectId} adapter=${adapterId}`
    );

    // Prime the PTY capture with the agent's authoritative terminal history so a
    // freshly-attached session (restart / re-bind) does not mistake the agent's
    // first full-screen conversation repaint for new reply content.
    if (adapterId === 'pty') {
      genericPtyAdapter.ensureSessionPrimed(sessionId);
    }

    // INV-22 — seed the prompt ledger from the canonical store so re-rendered
    // past prompts (TUI resume repaints) can never surface as assistant prose.
    try {
      const canonical = conversationStore.getSession(sessionId);
      const pastPrompts: string[] = [];
      for (const turn of canonical?.conversation.turns || []) {
        if (turn.role !== 'user') continue;
        for (const msg of turn.messages) {
          for (const c of msg.content) {
            if (c.type === 'text' && c.text?.trim()) pastPrompts.push(c.text);
          }
        }
      }
      if (pastPrompts.length) {
        this.seedCapturePrompts(sessionId, pastPrompts);
      }
    } catch {}

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
            conversationStore.updateStreamingAssistant(sessionId, event.text, event.thought, event.turnId);
            // Mirror live assistant streaming into the desktop chat view (AgentChat
            // renders agent.store.messages — without this bridge real PTY replies
            // never appear in the chat UI; the canonical store fed only mobile sync).
            this.mirrorAssistantToChatStore(sessionId, engineInfo.id, event.text, true);
            break;

          case 'assistant_completed':
            conversationStore.completeAgentMessage(sessionId, event.text, event.thought, event.turnId);
            this.mirrorAssistantToChatStore(sessionId, engineInfo.id, event.text, false);
            // Turn finished — release the agent's 'working' lock so the chat input
            // re-enables and the UI stops looking frozen.
            useAgentStore.getState().setAgentStatus(engineInfo.id, 'ready').catch(() => {});
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

        // Incremental Project Intelligence & Context Evolution (§4, §6)
        import('../intelligence/ContextEvolutionEngine')
          .then(({ ContextEvolutionEngine }) => {
            ContextEvolutionEngine.processEvent(event, {
              projectId,
              agentId: engineInfo.id,
              sessionId,
              provider: engineInfo.provider,
            });
          })
          .catch(() => {});

        // Out-of-band push notification evaluation (§2, §3, §27)
        import('../notifications/NotificationDispatcher')
          .then(({ NotificationDispatcher }) => {
            NotificationDispatcher.handleCanonicalEvent(sessionId, engineInfo.id, event);
          })
          .catch(() => {});
      });
      this.activeSubscriptions.set(sessionId, unsub);
    }

    return session;
  }

  /**
   * INV-22 — seed the PTY capture's prompt ledger with historical prompts from
   * the canonical store (restart / re-bind path).
   */
  private seedCapturePrompts(sessionId: string, prompts: string[]) {
    const adapter = this.getAdapterForSession(sessionId);
    const capture = (adapter as any).getCaptureSession?.(sessionId);
    if (capture?.seedPromptFingerprints) {
      capture.seedPromptFingerprints(prompts);
    }
  }

  startTurn(sessionId: string, userPrompt: string, turnId?: string, userMessageId?: string): void {
    // INV — a NEW turn supersedes any leftover streaming turn from a previous
    // one (missed completion, restart, delivery failure). Without this the UI
    // pins on "Generating response…" forever.
    try {
      conversationStore.reconcileStreamingTurns(sessionId);
    } catch {}

    const adapter = this.getAdapterForSession(sessionId);
    if (adapter.startTurn) {
      adapter.startTurn(sessionId, userPrompt, turnId, userMessageId);
    } else {
      genericPtyAdapter.startTurn(sessionId, userPrompt, turnId, userMessageId);
    }
  }

  commitTurn(sessionId: string, turnId?: string): void {
    const adapter = this.getAdapterForSession(sessionId);
    if (adapter.commitTurn) {
      adapter.commitTurn(sessionId, turnId);
    } else {
      genericPtyAdapter.commitTurn(sessionId, turnId);
    }
  }

  /**
   * Bridge canonical agent replies into the desktop chat view.
   *
   * `AgentChat` renders `useAgentStore.messages[sessionId]`, but the capture pipeline
   * wrote replies ONLY into the canonical `conversationStore` (which no desktop
   * component reads — it fed only the mobile relay). This mirror makes real PTY
   * replies (Codex, Claude, Mimo, …) visible in the desktop chat.
   */
  private mirrorAssistantToChatStore(sessionId: string, agentId: string, text: string, streaming: boolean) {
    try {
      // Streaming-aware upsert: replaces the in-flight streaming bubble while the
      // reply streams, finalizes it on completion, appends otherwise.
      useAgentStore.getState().upsertAssistantMessage(sessionId, {
        id: streaming ? `msg-a-${sessionId}-live` : `msg-a-${sessionId}-${Date.now()}`,
        sessionId,
        role: 'agent',
        content: text,
        timestamp: Date.now(),
        _streaming: streaming || undefined,
      } as any);
    } catch (err) {
      console.warn('[ConversationCapture] Failed to mirror reply into chat view:', err);
    }
  }

  /**
   * Authoritatively submit a user message to a session and dispatch to the engine adapter
   */
  async submitUserMessage(sessionId: string, message: string): Promise<void> {
    const cleanText = message.trim();
    if (!cleanText) return;

    const turnId = `turn_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 1. Authoritatively freeze baseline in adapter before sending input
    this.startTurn(sessionId, cleanText, turnId);

    // 2. Register pending echo in authoritative queue for session
    pendingInputEchoQueue.registerPendingEcho(sessionId, cleanText);

    // 3. Authoritatively record the user turn in the canonical conversation store
    conversationStore.addUserMessage(sessionId, cleanText);

    // 4. Dispatch to the engine adapter for execution
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
