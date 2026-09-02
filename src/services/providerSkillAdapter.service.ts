/**
 * Orbit Production Provider Skill Adapter Service
 * Provides capability discovery, safe path resolution, progressive disclosure formatting,
 * and deterministic filesystem mounting across all 16 supported AI agent providers.
 */

import { SkillItem, ProviderSkillCapabilities, SkillIntegrationMode } from '../types/skills';
import { AgentProvider } from '../types/orbit';
import { isTauriAvailable, tauriService } from './tauri.service';

export const PROVIDER_SKILL_CAPABILITIES: Record<AgentProvider, ProviderSkillCapabilities> = {
  antigravity: {
    provider: 'antigravity',
    integrationMode: 'native',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: true,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nRead ${mountedPath} for instructions when relevant.\n`
  },
  claude: {
    provider: 'claude',
    integrationMode: 'native',
    skillDirectory: '.claude/skills',
    supportsNativeDiscovery: true,
    supportsNativeActivation: true,
    resolveSkillPath: (slug) => `.claude/skills/${slug}/SKILL.md`,
    getActivationInstruction: (skill) => `/use-skill ${ProviderSkillAdapterService.sanitizeSkillSlug(skill)}`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nRun /use-skill ${ProviderSkillAdapterService.sanitizeSkillSlug(skill)} or inspect ${mountedPath}.\n`
  },
  codex: {
    provider: 'codex',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  opencode: {
    provider: 'opencode',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  kilocode: {
    provider: 'kilocode',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  freebuff: {
    provider: 'freebuff',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  cline: {
    provider: 'cline',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  copilot: {
    provider: 'copilot',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  goose: {
    provider: 'goose',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  kiro: {
    provider: 'kiro',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  qwen: {
    provider: 'qwen',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  mimo: {
    provider: 'mimo',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  muse: {
    provider: 'muse',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  vibe: {
    provider: 'vibe',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  qoder: {
    provider: 'qoder',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\nFollow guidelines in ${mountedPath} for upcoming tasks.\n`
  },
  terminal: {
    provider: 'terminal',
    integrationMode: 'filesystem',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (_skill, _mountedPath) => null
  },
  continue: {
    provider: 'continue',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\n`
  },
  aider: {
    provider: 'aider',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\n`
  },
  gemini: {
    provider: 'gemini',
    integrationMode: 'orbit-assisted',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (skill, mountedPath) =>
      `\n[ORBIT SKILL EQUIPPED: ${skill.name}]\nLocation: ${mountedPath}\n`
  },
  custom: {
    provider: 'custom',
    integrationMode: 'filesystem',
    skillDirectory: '.agents/skills',
    supportsNativeDiscovery: false,
    supportsNativeActivation: false,
    resolveSkillPath: (slug) => `.agents/skills/${slug}/SKILL.md`,
    getNotification: (_skill, _mountedPath) => null
  }
};

export class ProviderSkillAdapterService {
  /**
   * Sanitizes untrusted skill identifiers, preventing path traversal attacks (../, absolute paths, null bytes)
   */
  public static sanitizeSkillSlug(skill: SkillItem | string): string {
    const raw = typeof skill === 'string' ? skill : (skill.shortLabel || skill.name || skill.id);
    const sanitized = raw
      .replace(/\0/g, '') // remove null bytes
      .replace(/\\/g, '/') // normalize backslashes
      .replace(/(\.\.\/)+/g, '') // strip path traversal
      .replace(/^\/+/, '') // strip leading slashes
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return sanitized || 'custom-skill';
  }

  /**
   * Resolves capabilities for a provider
   */
  public static getCapabilities(provider: AgentProvider): ProviderSkillCapabilities {
    return PROVIDER_SKILL_CAPABILITIES[provider] || PROVIDER_SKILL_CAPABILITIES.terminal;
  }

  /**
   * Formats a SkillItem into standard Progressive Disclosure SKILL.md format with YAML frontmatter
   */
  public static formatSkillMarkdown(skill: SkillItem): string {
    const slugName = this.sanitizeSkillSlug(skill);
    const cleanDescription = (skill.description || 'Custom engineering skill')
      .replace(/\r?\n/g, ' ')
      .trim();

    return `---
name: ${slugName}
description: ${cleanDescription}
author: ${skill.author || 'Orbit Community'}
category: ${skill.category || 'general'}
---

# ${skill.name}

> ${cleanDescription}

## Guidelines & Constraints
${skill.directive || 'Adhere strictly to project conventions and safety invariants.'}

${skill.rawContent ? `\n## Extended Specification\n${skill.rawContent}` : ''}
`;
  }

  /**
   * Mounts a single equipped skill into the provider's discovery directory in the active project workspace
   */
  public static async mountSkillForProvider(
    projectPath: string,
    provider: AgentProvider,
    skill: SkillItem
  ): Promise<{ mountedPath: string; integrationMode: SkillIntegrationMode; notification: string | null }> {
    if (!projectPath) {
      throw new Error('Project path is required for mounting skills.');
    }

    const capabilities = this.getCapabilities(provider);
    const slugName = this.sanitizeSkillSlug(skill);
    const relativePath = capabilities.resolveSkillPath(slugName);
    const fileContent = this.formatSkillMarkdown(skill);

    if (isTauriAvailable()) {
      const written = await tauriService.writeProjectSkillFile(projectPath, relativePath, fileContent);
      if (!written) {
        throw new Error(`Failed to write skill file to ${relativePath}`);
      }
    }

    const notification = capabilities.getNotification(skill, relativePath);

    return {
      mountedPath: relativePath,
      integrationMode: capabilities.integrationMode,
      notification
    };
  }

  /**
   * Mounts equipped skills into the provider's native discovery folder in the active project workspace
   */
  public static async mountSkillsForProvider(
    projectPath: string,
    provider: AgentProvider,
    skills: SkillItem[]
  ): Promise<{ mountedPaths: string[]; totalSkills: number }> {
    if (!projectPath || skills.length === 0) {
      return { mountedPaths: [], totalSkills: 0 };
    }

    const mountedPaths: string[] = [];

    for (const skill of skills) {
      const { mountedPath } = await this.mountSkillForProvider(projectPath, provider, skill);
      mountedPaths.push(mountedPath);
    }

    return { mountedPaths, totalSkills: skills.length };
  }
}
