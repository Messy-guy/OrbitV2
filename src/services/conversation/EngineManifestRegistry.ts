import { EngineManifest, EngineCapabilities } from '../../types/conversation';

class EngineManifestRegistry {
  private manifests: Map<string, EngineManifest> = new Map();

  constructor() {
    this.registerBuiltInManifests();
  }

  private registerBuiltInManifests() {
    // 1. Antigravity (AGY) - Protocol: Interactive PTY
    this.register({
      id: 'antigravity',
      name: 'Antigravity (AGY)',
      executable: 'agy',
      transport: 'pty',
      fidelity: {
        conversation: 'TERMINAL_FALLBACK',
        activities: 'BEST_EFFORT',
        approvals: 'UNSUPPORTED',
      },
      capabilities: {
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
      },
    });

    // 2. Generic PTY - Protocol: PTY fallback
    this.register({
      id: 'generic-pty',
      name: 'Generic CLI (Fallback)',
      executable: 'bash',
      transport: 'pty',
      fidelity: {
        conversation: 'TERMINAL_FALLBACK',
        activities: 'BEST_EFFORT',
        approvals: 'UNSUPPORTED',
      },
      capabilities: {
        streaming: true,
        structuredEvents: false,
        structuredToolCalls: false,
        approvals: false,
        sessionResume: true,
        historyRecovery: false,
        fileEvents: false,
        commandEvents: false,
        thinkingEvents: false,
        nativeConversationHistory: false,
      },
    });
  }

  register(manifest: EngineManifest) {
    this.manifests.set(manifest.id.toLowerCase(), manifest);
    if (manifest.executable) {
      this.manifests.set(manifest.executable.toLowerCase(), manifest);
    }
  }

  unregister(idOrExecutable: string) {
    const key = (idOrExecutable || '').toLowerCase();
    this.manifests.delete(key);
  }

  getManifest(engineIdOrExecutable: string): EngineManifest {
    const key = (engineIdOrExecutable || '').toLowerCase();
    const found = this.manifests.get(key);
    if (found) return found;

    // Fallback default manifest for unknown engines
    return {
      id: key || 'unknown',
      name: engineIdOrExecutable || 'Custom Agent',
      executable: engineIdOrExecutable || 'bash',
      transport: 'pty',
      fidelity: {
        conversation: 'TERMINAL_FALLBACK',
        activities: 'BEST_EFFORT',
        approvals: 'UNSUPPORTED',
      },
      capabilities: {
        streaming: true,
        structuredEvents: false,
        structuredToolCalls: false,
        approvals: false,
        sessionResume: false,
        historyRecovery: false,
        fileEvents: false,
        commandEvents: false,
        thinkingEvents: false,
        nativeConversationHistory: false,
      },
    };
  }

  getAllManifests(): EngineManifest[] {
    return Array.from(new Set(this.manifests.values()));
  }
}

export const engineManifestRegistry = new EngineManifestRegistry();
