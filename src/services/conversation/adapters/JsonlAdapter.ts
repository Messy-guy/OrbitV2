import { EngineAdapter, StartSessionOptions, Unsubscribe } from './EngineAdapter';
import { EngineCapabilities, OrbitEngineEvent, EngineManifest } from '../../../types/conversation';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class JsonlAdapter implements EngineAdapter {
  readonly id = 'jsonl';
  readonly name = 'JSONL Stream Protocol';

  private subscribers: Map<string, Set<(event: OrbitEngineEvent) => void>> = new Map();
  private lineBuffers: Map<string, string> = new Map();
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
        console.warn(`[JsonlAdapter] Failed to start session:`, err);
      });
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const cleanText = message.trim();
    if (!cleanText) return;

    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(sessionId, sessionId, `${cleanText}\r\n`).catch((err) => {
        console.warn(`[JsonlAdapter] Failed to send input:`, err);
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
    this.subscribers.delete(sessionId);
    this.lineBuffers.delete(sessionId);
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
          console.error('[JsonlAdapter] Emit callback error:', err);
        }
      }
    }
  }

  /**
   * Ingest streaming stdout chunks and assemble into complete JSON lines
   */
  processStreamChunk(sessionId: string, chunk: string) {
    let buffer = (this.lineBuffers.get(sessionId) || '') + chunk;
    const lines = buffer.split('\n');
    this.lineBuffers.set(sessionId, lines.pop() || '');

    const manifest = this.manifests.get(sessionId);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // 1. If custom manifest provides a custom line parser, try it
      if (manifest?.parseStructuredLine) {
        const customEvent = manifest.parseStructuredLine(line);
        if (customEvent) {
          this.emit(sessionId, customEvent);
          continue;
        }
      }

      // 2. Standard JSON/JSONL protocol parsing
      try {
        const payload = JSON.parse(line);
        this.translateJsonlPayload(sessionId, payload);
      } catch {
        // Not a JSON line, ignore or pass through if meaningful
      }
    }
  }

  private translateJsonlPayload(sessionId: string, item: any) {
    const now = Date.now();

    // User message event
    if (item.type === 'USER_INPUT' || item.type === 'user_message' || item.role === 'user') {
      const text = item.content || item.text || item.prompt || '';
      const cleanPrompt = String(text)
        .replace(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/g, '$1')
        .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
        .trim();
      if (cleanPrompt) {
        this.emit(sessionId, { type: 'user_message', text: cleanPrompt, timestamp: now });
      }
    }
    // Assistant response event
    else if (item.type === 'PLANNER_RESPONSE' || item.type === 'assistant_message' || item.role === 'assistant') {
      if (item.thinking) {
        this.emit(sessionId, {
          type: 'activity_started',
          category: 'other',
          summary: `Thought Process (${String(item.thinking).slice(0, 50)}...)`,
          timestamp: now,
        });
      }

      if (item.tool_calls && Array.isArray(item.tool_calls)) {
        for (const call of item.tool_calls) {
          const name = call.name || 'tool';
          const cat = name.includes('file') ? 'files' : name.includes('command') ? 'commands' : 'search';
          this.emit(sessionId, {
            type: 'activity_started',
            category: cat,
            summary: call.toolSummary || name,
            timestamp: now,
          });
        }
      }

      const content = item.content || item.text || '';
      if (content) {
        this.emit(sessionId, {
          type: 'assistant_completed',
          text: content,
          thought: item.thinking,
          timestamp: now,
        });
      }
    }
    // Streaming assistant delta
    else if (item.type === 'assistant_delta' || item.type === 'text_delta') {
      this.emit(sessionId, {
        type: 'assistant_delta',
        text: item.text || item.delta || '',
        thought: item.thought,
        timestamp: now,
      });
    }
    // Tool activity
    else if (item.type === 'tool_started' || item.type === 'activity_started') {
      this.emit(sessionId, {
        type: 'activity_started',
        category: item.category || 'other',
        summary: item.summary || item.toolName || 'Working...',
        timestamp: now,
      });
    }
    // Approvals / Input request
    else if (item.type === 'approval_requested' || item.type === 'permission_request') {
      this.emit(sessionId, {
        type: 'approval_requested',
        id: item.id || `app_${now}`,
        title: item.title || 'Agent needs approval',
        action: item.action || item.command || '',
        metadata: item.metadata,
        timestamp: now,
      });
    }
    // Status change
    else if (item.type === 'status' || item.type === 'session_status_changed') {
      this.emit(sessionId, {
        type: 'session_status_changed',
        status: item.status,
        timestamp: now,
      });
    }
  }
}

export const jsonlAdapter = new JsonlAdapter();
