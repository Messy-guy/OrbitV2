import { AgentProvider } from '../../types/orbit';
import { AgentInteractionProfile, FormattedSubmission, RemoteControlCapabilities } from './types';

const defaultPtyCapabilities: RemoteControlCapabilities = {
  canSendMessage: true,
  canInterrupt: true,
  canResume: true,
  canDetectReadyState: true,
  canDetectBusyState: true,
  canUseStructuredInput: false,
  canUsePTYInput: true,
  requiresSubmitAction: true,
  supportsInteractivePrompt: true,
  supportsSlashCommands: true,
  supportsApprovalInput: true,
};

const structuredAcpCapabilities: RemoteControlCapabilities = {
  canSendMessage: true,
  canInterrupt: true,
  canResume: true,
  canDetectReadyState: true,
  canDetectBusyState: true,
  canUseStructuredInput: true,
  canUsePTYInput: true,
  requiresSubmitAction: true,
  supportsInteractivePrompt: true,
  supportsSlashCommands: true,
  supportsApprovalInput: true,
};

/**
 * 1. Google Antigravity Profile
 */
export const AntigravityProfile: AgentInteractionProfile = {
  provider: 'antigravity',
  name: 'Antigravity CLI Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: structuredAcpCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
  isReady(output: string): boolean {
    return output.includes('❯') || output.includes('Antigravity') || output.includes('Ready');
  },
};

/**
 * 2. Anthropic Claude Code Profile
 */
export const ClaudeProfile: AgentInteractionProfile = {
  provider: 'claude',
  name: 'Claude Code Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 20,
      postSubmitFlush: true,
    };
  },
  isReady(output: string): boolean {
    return output.includes('❯') || output.includes('>');
  },
};

/**
 * 3. OpenAI Codex CLI Profile
 * Solves the newline / multiline buffer issue by ensuring prompt is formatted
 * as a single coherent stream without trailing CR/LF in the body, followed by
 * an immediate carriage return (\r) submit key.
 */
export const CodexProfile: AgentInteractionProfile = {
  provider: 'codex',
  name: 'Codex CLI Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    // Strip trailing line feeds to prevent multiline textarea newline insertion
    const clean = message.replace(/[\r\n]+$/, '').trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 25,
      postSubmitFlush: true,
    };
  },
  isReady(output: string): boolean {
    return output.includes('❯') || output.includes('OpenAI') || output.includes('Codex');
  },
};

/**
 * 4. OpenCode Interpreter Profile
 */
export const OpenCodeProfile: AgentInteractionProfile = {
  provider: 'opencode',
  name: 'OpenCode Interpreter Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 5. KiloCode Profile
 */
export const KiloProfile: AgentInteractionProfile = {
  provider: 'kilocode',
  name: 'KiloCode Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 6. Freebuff Profile
 */
export const FreebuffProfile: AgentInteractionProfile = {
  provider: 'freebuff',
  name: 'Freebuff Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 7. Cline Profile
 */
export const ClineProfile: AgentInteractionProfile = {
  provider: 'cline',
  name: 'Cline Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 8. GitHub Copilot Profile
 */
export const CopilotProfile: AgentInteractionProfile = {
  provider: 'copilot',
  name: 'GitHub Copilot Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 20,
      postSubmitFlush: true,
    };
  },
};

/**
 * 9. Block Goose Profile
 */
export const GooseProfile: AgentInteractionProfile = {
  provider: 'goose',
  name: 'Block Goose Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 20,
      postSubmitFlush: true,
    };
  },
};

/**
 * 10. Kiro CLI Profile
 */
export const KiroProfile: AgentInteractionProfile = {
  provider: 'kiro',
  name: 'Kiro CLI Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 11. Alibaba Qwen Code Profile
 */
export const QwenProfile: AgentInteractionProfile = {
  provider: 'qwen',
  name: 'Qwen Code Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 12. Xiaomi Mimo Code Profile
 */
export const MimoProfile: AgentInteractionProfile = {
  provider: 'mimo',
  name: 'Mimo Code Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 13. Meta AI Muse Code Profile
 */
export const MuseProfile: AgentInteractionProfile = {
  provider: 'muse',
  name: 'Muse Code Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 14. Mistral Vibe Profile
 */
export const VibeProfile: AgentInteractionProfile = {
  provider: 'vibe',
  name: 'Mistral Vibe Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 25,
      postSubmitFlush: true,
    };
  },
};

/**
 * 15. Qoder CLI Profile
 */
export const QoderProfile: AgentInteractionProfile = {
  provider: 'qoder',
  name: 'Qoder CLI Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 15,
      postSubmitFlush: true,
    };
  },
};

/**
 * 16. Raw Shell Terminal Profile (Bash / Sh / Zsh)
 */
export const ShellProfile: AgentInteractionProfile = {
  provider: 'terminal',
  name: 'Shell Terminal Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\n',
  capabilities: {
    ...defaultPtyCapabilities,
    supportsSlashCommands: false,
    supportsApprovalInput: false,
  },
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\n',
      preSubmitDelayMs: 10,
      postSubmitFlush: true,
    };
  },
};

/**
 * Generic Fallback Profile for arbitrary / custom CLI agents
 */
export const GenericFallbackProfile: AgentInteractionProfile = {
  provider: 'generic',
  name: 'Generic PTY Fallback Profile',
  deliveryTier: 'pty_interactive',
  submitKey: '\r',
  capabilities: defaultPtyCapabilities,
  formatSubmission(message: string): FormattedSubmission {
    const clean = message.trim();
    return {
      payload: clean,
      submitKey: '\r',
      preSubmitDelayMs: 20,
      postSubmitFlush: true,
    };
  },
};

/**
 * Authoritative Profile Registry
 */
export class AgentInteractionProfileRegistry {
  private profiles: Map<string, AgentInteractionProfile> = new Map();

  constructor() {
    this.register(AntigravityProfile);
    this.register(ClaudeProfile);
    this.register(CodexProfile);
    this.register(OpenCodeProfile);
    this.register(KiloProfile);
    this.register(FreebuffProfile);
    this.register(ClineProfile);
    this.register(CopilotProfile);
    this.register(GooseProfile);
    this.register(KiroProfile);
    this.register(QwenProfile);
    this.register(MimoProfile);
    this.register(MuseProfile);
    this.register(VibeProfile);
    this.register(QoderProfile);
    this.register(ShellProfile);
  }

  register(profile: AgentInteractionProfile) {
    this.profiles.set(String(profile.provider).toLowerCase(), profile);
  }

  getProfile(providerOrAlias: string): AgentInteractionProfile {
    if (!providerOrAlias) return GenericFallbackProfile;
    const key = providerOrAlias.toLowerCase().trim();
    
    // Direct match
    if (this.profiles.has(key)) {
      return this.profiles.get(key)!;
    }

    // Alias matches
    if (key.includes('antigravity') || key === 'agy') return AntigravityProfile;
    if (key.includes('claude')) return ClaudeProfile;
    if (key.includes('codex')) return CodexProfile;
    if (key.includes('opencode')) return OpenCodeProfile;
    if (key.includes('kilo')) return KiloProfile;
    if (key.includes('freebuff')) return FreebuffProfile;
    if (key.includes('cline')) return ClineProfile;
    if (key.includes('copilot') || key.includes('github')) return CopilotProfile;
    if (key.includes('goose')) return GooseProfile;
    if (key.includes('kiro')) return KiroProfile;
    if (key.includes('qwen')) return QwenProfile;
    if (key.includes('mimo')) return MimoProfile;
    if (key.includes('muse')) return MuseProfile;
    if (key.includes('vibe') || key.includes('mistral')) return VibeProfile;
    if (key.includes('qoder')) return QoderProfile;
    if (key.includes('shell') || key.includes('bash') || key.includes('sh') || key.includes('terminal')) return ShellProfile;

    return GenericFallbackProfile;
  }

  getAllProfiles(): AgentInteractionProfile[] {
    return Array.from(this.profiles.values());
  }
}

export const agentProfileRegistry = new AgentInteractionProfileRegistry();
