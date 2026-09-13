import * as fs from 'fs';
import * as path from 'path';
import { Skill, AgentProvider } from '../types.js';

export class SkillProjector {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  public projectSkills(skills: Skill[], targetProvider?: AgentProvider): string[] {
    const enabledSkills = skills.filter((s) => s.enabled);
    const modifiedFiles: string[] = [];

    if (!targetProvider || targetProvider === 'claude') {
      const claudeFile = this.projectClaude(enabledSkills);
      if (claudeFile) modifiedFiles.push(claudeFile);
    }

    if (!targetProvider || targetProvider === 'codex') {
      const codexFile = this.projectCodex(enabledSkills);
      if (codexFile) modifiedFiles.push(codexFile);
    }

    if (!targetProvider || targetProvider === 'agy' || targetProvider === 'gemini') {
      const agyFile = this.projectAntigravity(enabledSkills);
      if (agyFile) modifiedFiles.push(agyFile);
    }

    if (!targetProvider || targetProvider === 'opencode') {
      const opencodeFile = this.projectOpenCode(enabledSkills);
      if (opencodeFile) modifiedFiles.push(opencodeFile);
    }

    return modifiedFiles;
  }

  private projectClaude(skills: Skill[]): string | null {
    const filePath = path.join(this.cwd, 'CLAUDE.md');
    let header = `# CLAUDE.md - Orbit Project Directives\n\n`;
    header += `> Auto-projected by Orbit Skill Registry on ${new Date().toISOString()}\n\n`;
    header += `## Active Skill Directives\n\n`;

    for (const s of skills) {
      header += `### [Skill] ${s.name}\n`;
      header += `${s.content}\n\n`;
      if (s.rules && s.rules.length > 0) {
        header += `**Rules:**\n`;
        for (const r of s.rules) {
          header += `- ${r}\n`;
        }
        header += `\n`;
      }
    }

    fs.writeFileSync(filePath, header, 'utf8');
    return 'CLAUDE.md';
  }

  private projectCodex(skills: Skill[]): string | null {
    const filePath = path.join(this.cwd, 'AGENTS.md');
    let header = `# AGENTS.md - Orbit Codex Directives\n\n`;
    header += `> Auto-projected by Orbit Skill Registry on ${new Date().toISOString()}\n\n`;
    header += `## Active Directives\n\n`;

    for (const s of skills) {
      header += `### ${s.name}\n`;
      header += `${s.content}\n\n`;
    }

    fs.writeFileSync(filePath, header, 'utf8');
    return 'AGENTS.md';
  }

  private projectAntigravity(skills: Skill[]): string | null {
    const rulesDir = path.join(this.cwd, '.gemini', 'rules');
    if (!fs.existsSync(rulesDir)) {
      fs.mkdirSync(rulesDir, { recursive: true });
    }
    const filePath = path.join(rulesDir, 'orbit_skills.md');
    let content = `# Antigravity Rules (Orbit Projected)\n\n`;
    for (const s of skills) {
      content += `## ${s.name}\n${s.content}\n\n`;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return '.gemini/rules/orbit_skills.md';
  }

  private projectOpenCode(skills: Skill[]): string | null {
    const rulesDir = path.join(this.cwd, '.opencode');
    if (!fs.existsSync(rulesDir)) {
      fs.mkdirSync(rulesDir, { recursive: true });
    }
    const filePath = path.join(rulesDir, 'rules.md');
    let content = `# OpenCode Rules (Orbit Projected)\n\n`;
    for (const s of skills) {
      content += `## ${s.name}\n${s.content}\n\n`;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return '.opencode/rules.md';
  }
}
