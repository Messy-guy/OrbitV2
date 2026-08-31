import { useAgentStore } from '../../stores/agent.store';
import { conversationStore } from '../conversation/ConversationStore';
import { conversationCaptureService } from '../conversation/ConversationCaptureService';
import { pendingInputEchoQueue } from '../sessionProjection/input/PendingInputEchoQueue';
import { isTauriAvailable, tauriService } from '../tauri.service';
import { agentProfileRegistry } from './AgentInteractionProfileRegistry';
import {
  RemoteControlRequest,
  RemoteControlResult,
  RemoteDiagnosticEvent,
  RemoteDiagnosticLog,
} from './types';

export class UniversalRemoteController {
  private processedRequestIds: Set<string> = new Set();
  private maxStoredRequestIds = 500;
  private diagnosticListeners: Set<(log: RemoteDiagnosticLog) => void> = new Set();

  /**
   * Register a diagnostic listener for observability
   */
  onDiagnostic(listener: (log: RemoteDiagnosticLog) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  private emitDiagnostic(
    event: RemoteDiagnosticEvent,
    agentId: string,
    sessionId: string,
    provider?: string,
    details?: Record<string, any>
  ) {
    // Sanitize details to guarantee zero token / secret leakage
    const sanitizedDetails: Record<string, any> = {};
    if (details) {
      for (const [k, v] of Object.entries(details)) {
        if (
          k.toLowerCase().includes('token') ||
          k.toLowerCase().includes('secret') ||
          k.toLowerCase().includes('password') ||
          k.toLowerCase().includes('key') ||
          k.toLowerCase().includes('auth')
        ) {
          sanitizedDetails[k] = '[REDACTED]';
        } else {
          sanitizedDetails[k] = v;
        }
      }
    }

    const log: RemoteDiagnosticLog = {
      timestamp: Date.now(),
      event,
      agentId,
      sessionId,
      provider,
      details: sanitizedDetails,
    };

    console.log(`[Orbit RemoteControl] [${event}] Agent: ${agentId} | Session: ${sessionId} | Provider: ${provider || 'unknown'}`);
    for (const listener of this.diagnosticListeners) {
      try {
        listener(log);
      } catch {}
    }
  }

  /**
   * Universal authoritative remote message delivery endpoint
   */
  async deliverRemoteMessage(request: RemoteControlRequest): Promise<RemoteControlResult> {
    const { requestId, agentId, sessionId, message } = request;
    const targetSessionId = sessionId || agentId;
    const cleanMessage = String(message || '').trim();

    this.emitDiagnostic('REMOTE_CONTROL_REQUEST', agentId, targetSessionId, undefined, {
      requestId,
      messageLength: cleanMessage.length,
    });

    // 1. Idempotency validation
    if (requestId) {
      if (this.processedRequestIds.has(requestId)) {
        console.warn(`[Orbit RemoteControl] Duplicate requestId ${requestId} ignored.`);
        return {
          success: true,
          requestId,
          sessionId: targetSessionId,
          agentId,
          deliveryTier: 'pty_interactive',
          submittedAt: Date.now(),
        };
      }
      this.processedRequestIds.add(requestId);
      if (this.processedRequestIds.size > this.maxStoredRequestIds) {
        const first = this.processedRequestIds.values().next().value;
        if (first) this.processedRequestIds.delete(first);
      }
    }

    if (!cleanMessage) {
      return {
        success: false,
        requestId,
        sessionId: targetSessionId,
        agentId,
        deliveryTier: 'unsupported',
        submittedAt: Date.now(),
        error: 'Cannot deliver empty message',
        diagnosticCode: 'EMPTY_PAYLOAD',
      };
    }

    // 2. Authoritative Desktop Process / Session Lookup
    this.emitDiagnostic('SESSION_LOOKUP', agentId, targetSessionId);
    const agent = useAgentStore.getState().agents.find(
      (a) => a.id === agentId || a.currentSessionId === targetSessionId || a.id === targetSessionId || a.currentSessionId === agentId
    );
    const canonicalSession =
      conversationStore.getSession(targetSessionId) ||
      (agent?.currentSessionId ? conversationStore.getSession(agent.currentSessionId) : undefined) ||
      conversationStore.getSession(agentId) ||
      conversationStore.getSessionsForAgent(agentId)[0];

    const resolvedAgentId = agent?.id || canonicalSession?.engine?.id || agentId;
    const resolvedSessionId = canonicalSession?.id || agent?.currentSessionId || targetSessionId;
    const provider = agent?.provider || canonicalSession?.engine?.provider || 'terminal';
    const profile = agentProfileRegistry.getProfile(provider);

    this.emitDiagnostic('PTY_LOOKUP', resolvedAgentId, resolvedSessionId, provider, {
      matchedAgentId: agent?.id,
      matchedSessionId: agent?.currentSessionId,
      canonicalSessionExists: !!canonicalSession,
      isTauriAvailable: isTauriAvailable(),
    });

    this.emitDiagnostic('ADAPTER_SELECTED', resolvedAgentId, resolvedSessionId, provider, {
      profileName: profile.name,
      deliveryTier: profile.deliveryTier,
    });

    // 3. Lifecycle State Check
    if (agent && (agent.status === 'error' || (agent as any).status === 'exited')) {
      this.emitDiagnostic('REMOTE_CONTROL_FAILED', resolvedAgentId, resolvedSessionId, provider, {
        reason: 'AGENT_OFFLINE',
        agentStatus: agent.status,
      });
      return {
        success: false,
        requestId,
        sessionId: resolvedSessionId,
        agentId: resolvedAgentId,
        deliveryTier: profile.deliveryTier,
        submittedAt: Date.now(),
        error: `Target agent ${agent.name || resolvedAgentId} is offline or in error state.`,
        diagnosticCode: 'AGENT_OFFLINE',
      };
    }

    const turnId = request.turnId || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 4. Authoritatively freeze capture baseline and register pending echo before PTY delivery
    conversationCaptureService.startTurn(resolvedSessionId, cleanMessage, turnId);
    if (resolvedAgentId && resolvedAgentId !== resolvedSessionId) {
      conversationCaptureService.startTurn(resolvedAgentId, cleanMessage, turnId);
    }
    pendingInputEchoQueue.registerPendingEcho(resolvedSessionId, cleanMessage);
    if (resolvedAgentId && resolvedAgentId !== resolvedSessionId) {
      pendingInputEchoQueue.registerPendingEcho(resolvedAgentId, cleanMessage);
    }

    // 5. Update Conversation Store
    conversationStore.getOrCreateSession(
      resolvedSessionId,
      agent?.workspaceId || 'default',
      agent?.workspaceId || 'default',
      {
        id: resolvedAgentId,
        name: agent?.name || profile.name,
        provider,
        transport: profile.deliveryTier === 'structured_acp' ? 'acp' : 'pty',
      }
    );
    conversationStore.addUserMessage(resolvedSessionId, cleanMessage);
    conversationStore.setSessionStatus(resolvedSessionId, 'working');
    if (agent) {
      useAgentStore.getState().setAgentStatus(resolvedAgentId, 'working').catch(() => {});
    }

    // 6. Execute Delivery according to Profile Strategy
    this.emitDiagnostic('INPUT_DELIVERY_STARTED', resolvedAgentId, resolvedSessionId, provider, {
      deliveryTier: profile.deliveryTier,
    });

    try {
      const submission = profile.formatSubmission(cleanMessage);

      this.emitDiagnostic('INPUT_FORMATTED', resolvedAgentId, resolvedSessionId, provider, {
        payloadLength: submission.payload.length,
        submitKey: submission.submitKey === '\r' ? 'CR' : submission.submitKey === '\n' ? 'LF' : 'CUSTOM',
        preSubmitDelayMs: submission.preSubmitDelayMs || 0,
      });

      if (isTauriAvailable()) {
        this.emitDiagnostic('PTY_WRITE_STARTED', resolvedAgentId, resolvedSessionId, provider, {
          targetAgentId: resolvedAgentId,
          targetSessionId: resolvedSessionId,
        });

        // Send the payload to the EXISTING PTY process
        await tauriService.sendAgentInput(resolvedAgentId, resolvedSessionId, submission.payload);

        // Pre-submit delay if required by profile (e.g. Codex multiline buffering)
        if (submission.preSubmitDelayMs && submission.preSubmitDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, submission.preSubmitDelayMs));
        }

        // Send submit key (e.g. '\r' or '\n')
        await tauriService.sendAgentInput(resolvedAgentId, resolvedSessionId, submission.submitKey);

        this.emitDiagnostic('PTY_WRITE_COMPLETED', resolvedAgentId, resolvedSessionId, provider, {
          targetAgentId: resolvedAgentId,
          targetSessionId: resolvedSessionId,
        });
      } else {
        // Fallback for non-Tauri / mock testing environments
        console.log(`[Orbit RemoteControl (Web/Mock)] Delivered to ${resolvedAgentId}: ${submission.payload}`);
      }

      this.emitDiagnostic('INPUT_SUBMITTED', resolvedAgentId, resolvedSessionId, provider, {
        submitKey: submission.submitKey === '\r' ? 'CR' : submission.submitKey === '\n' ? 'LF' : 'CUSTOM',
      });

      return {
        success: true,
        requestId,
        sessionId: resolvedSessionId,
        agentId: resolvedAgentId,
        deliveryTier: profile.deliveryTier,
        submittedAt: Date.now(),
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      this.emitDiagnostic('REMOTE_CONTROL_FAILED', resolvedAgentId, resolvedSessionId, provider, {
        error: errorMsg,
      });
      return {
        success: false,
        requestId,
        sessionId: resolvedSessionId,
        agentId: resolvedAgentId,
        deliveryTier: profile.deliveryTier,
        submittedAt: Date.now(),
        error: errorMsg,
        diagnosticCode: 'PTY_WRITE_ERROR',
      };
    }
  }
}

export const universalRemoteController = new UniversalRemoteController();
