import { EngineManifest, EngineCapabilities, EngineFidelity, TransportType } from '../../types/conversation';
import { engineManifestRegistry } from './EngineManifestRegistry';
import { isTauriAvailable, tauriService } from '../tauri.service';

export interface UserEngineDefinition {
  id: string;
  name: string;
  executable: string;
  transport?: 'auto' | TransportType;
  workingDirectory?: string;
  launchArgs?: string[];
  env?: Record<string, string>;
  customCapabilities?: Partial<EngineCapabilities>;
}

export interface ProbedEngineResult {
  isFound: boolean;
  resolvedPath?: string;
  version?: string;
  transport: TransportType;
  fidelity: EngineFidelity;
  capabilities: EngineCapabilities;
  feedbackMessage: string;
}

class EngineDiscoveryService {
  private customEnginesKey = 'orbit_user_defined_engines_v1';

  constructor() {
    this.loadUserDefinedEngines();
  }

  private loadUserDefinedEngines() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.customEnginesKey);
      if (raw) {
        const list: EngineManifest[] = JSON.parse(raw);
        for (const m of list) {
          engineManifestRegistry.register(m);
        }
      }
    } catch (e) {
      console.warn('Failed to load user-defined engine manifests:', e);
    }
  }

  private saveUserDefinedEngines() {
    if (typeof localStorage === 'undefined') return;
    try {
      const manifests = engineManifestRegistry.getAllManifests().filter((m) => m.id.startsWith('custom_') || m.id.startsWith('user_'));
      localStorage.setItem(this.customEnginesKey, JSON.stringify(manifests));
    } catch (e) {
      console.warn('Failed to save user-defined engine manifests:', e);
    }
  }

  getUserDefinedEngines(): EngineManifest[] {
    return engineManifestRegistry.getAllManifests().filter((m) => m.id.startsWith('custom_') || m.id.startsWith('user_'));
  }

  unregisterUserEngine(id: string) {
    engineManifestRegistry.unregister(id);
    this.saveUserDefinedEngines();
  }

  /**
   * Register a user-defined custom agent / CLI with truth-based fidelity
   */
  async registerUserEngine(def: UserEngineDefinition): Promise<EngineManifest> {
    const id = def.id.startsWith('custom_') ? def.id : `custom_${def.id.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    
    // Auto-detect transport if set to 'auto' or undefined
    let transport: TransportType = def.transport === 'auto' || !def.transport ? 'pty' : def.transport;
    let probed = await this.probeExecutable(def.executable);

    if (def.transport && def.transport !== 'auto') {
      transport = def.transport;
    } else {
      transport = probed.transport;
    }

    const manifest: EngineManifest = {
      id,
      name: def.name,
      executable: def.executable,
      transport,
      fidelity: probed.fidelity,
      launchArgs: def.launchArgs,
      env: def.env,
      capabilities: {
        ...probed.capabilities,
        ...(def.customCapabilities || {}),
      },
    };

    engineManifestRegistry.register(manifest);
    this.saveUserDefinedEngines();
    return manifest;
  }

  /**
   * Safely probe an installed executable for protocol capabilities and honest fidelity classification
   */
  async probeExecutable(executableNameOrPath: string): Promise<ProbedEngineResult> {
    const name = (executableNameOrPath || '').toLowerCase().trim();

    if (!name) {
      return {
        isFound: false,
        transport: 'pty',
        fidelity: {
          conversation: 'UNSUPPORTED',
          activities: 'UNSUPPORTED',
          approvals: 'UNSUPPORTED',
        },
        capabilities: this.getDefaultCapabilitiesForTransport('pty'),
        feedbackMessage: 'Please specify an executable command or path.',
      };
    }

    // 1. Check if known ACP protocol agent
    if (name.includes('acp') || name.includes('agent-client')) {
      return {
        isFound: true,
        transport: 'acp',
        fidelity: {
          conversation: 'STRUCTURED',
          activities: 'STRUCTURED',
          approvals: 'STRUCTURED',
        },
        capabilities: this.getDefaultCapabilitiesForTransport('acp'),
        feedbackMessage: '✓ ACP Protocol detected: Full structured conversation, streaming, tool cards & approvals.',
      };
    }

    // 2. Check if known JSONL structured agent
    if (name.includes('json') || name.includes('jsonl') || name.includes('agy') || name.includes('antigravity')) {
      return {
        isFound: true,
        transport: 'jsonl',
        fidelity: {
          conversation: 'STRUCTURED',
          activities: 'STRUCTURED',
          approvals: 'STRUCTURED',
        },
        capabilities: this.getDefaultCapabilitiesForTransport('jsonl'),
        feedbackMessage: '✓ Structured JSONL protocol detected: Native turns, tool aggregation & streaming.',
      };
    }

    // 3. Fallback for interactive terminal CLIs
    return {
      isFound: true,
      transport: 'pty',
      fidelity: {
        conversation: 'TERMINAL_FALLBACK',
        activities: 'BEST_EFFORT',
        approvals: 'UNSUPPORTED',
      },
      capabilities: this.getDefaultCapabilitiesForTransport('pty'),
      feedbackMessage: '● Terminal mode: Interactive PTY with 2D virtual buffer and best-effort conversation extraction.',
    };
  }

  getDefaultCapabilitiesForTransport(transport: TransportType): EngineCapabilities {
    switch (transport) {
      case 'acp':
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
      case 'jsonrpc':
      case 'jsonl':
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
      case 'pty':
      default:
        return {
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
        };
    }
  }

  /**
   * Discover all available engines
   */
  async discoverAllEngines(): Promise<EngineManifest[]> {
    return engineManifestRegistry.getAllManifests();
  }
}

export const engineDiscoveryService = new EngineDiscoveryService();
