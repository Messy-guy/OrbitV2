/**
 * Orbit Native Provider Skill Adapter Service
 * Bridges Orbit's Unified Skill Hub (1,200+ online + bundled Leo-Agent skills)
 * directly into the native progressive-disclosure discovery paths:
 * - Antigravity (AGY): <workspace>/.agents/skills/<skill-name>/SKILL.md
 * - Claude Code:       <workspace>/.claude/skills/<skill-name>/SKILL.md
 * - Codex / Generic:   <workspace>/.orbit/skills/<skill-name>/SKILL.md
 *
 * This guarantees 0 context token pollution on startup:
 * The AI CLI discovers the lightweight YAML frontmatter at boot and loads the full
 * instructions via filesystem tools ONLY when the task requires it.
 */

import { SkillItem } from '../types/skills';
import { AgentProvider } from '../types/orbit';
import { isTauriAvailable, tauriService } from './tauri.service';

export class ProviderSkillAdapterService {
  /**
   * Formats a SkillItem into standard Progressive Disclosure SKILL.md format with YAML frontmatter
   */
  public static formatSkillMarkdown(skill: SkillItem): string {
    const slugName = (skill.shortLabel || skill.name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');

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

    // Determine native skill directories per provider
    const targetDirs: string[] = [];
    if (provider === 'antigravity') {
      targetDirs.push('.agents/skills');
    } else if (provider === 'claude') {
      targetDirs.push('.claude/skills');
    } else {
      // Common standard fallback
      targetDirs.push('.agents/skills');
      targetDirs.push('.orbit/skills');
    }

    for (const skill of skills) {
      const slugName = (skill.shortLabel || skill.name)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-');

      const fileContent = this.formatSkillMarkdown(skill);

      for (const relDir of targetDirs) {
        const fullRelPath = `${relDir}/${slugName}/SKILL.md`;
        mountedPaths.push(fullRelPath);

        if (isTauriAvailable()) {
          try {
            // Write file via Tauri FS or command
            await tauriService.writeProjectSkillFile(projectPath, fullRelPath, fileContent);
          } catch (e) {
            console.warn(`Native skill mount notice for ${fullRelPath}:`, e);
          }
        }
      }
    }

    return { mountedPaths, totalSkills: skills.length };
  }
}
