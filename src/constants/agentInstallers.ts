/**
 * Orbit Official Agent CLI Installation Registry
 * Provides verified 1-click terminal install commands for major AI coding agents.
 */

export interface AgentInstallerConfig {
  provider: string;
  name: string;
  command: string;
  fallbackCommand?: string;
  packageManager: 'npm' | 'pip' | 'curl' | 'cargo';
  docUrl: string;
  description: string;
}

export const OFFICIAL_AGENT_INSTALLERS: Record<string, AgentInstallerConfig> = {
  claude: {
    provider: 'claude',
    name: 'Claude Code CLI',
    command: 'npm install -g @anthropic-ai/claude-code',
    fallbackCommand: 'curl -fsSL https://claude.ai/install.sh | bash',
    packageManager: 'npm',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    description: 'Official Anthropic Claude Code terminal agent harness.',
  },
  opencode: {
    provider: 'opencode',
    name: 'OpenCode Interpreter',
    command: 'npm install -g opencode-ai',
    fallbackCommand: 'npx opencode-ai',
    packageManager: 'npm',
    docUrl: 'https://opencode.ai',
    description: 'Open-source local terminal coding interpreter for DeepSeek R1 & open models.',
  },
  antigravity: {
    provider: 'antigravity',
    name: 'Antigravity CLI (agy)',
    command: 'curl -fsSL https://antigravity.google/install.sh | bash',
    packageManager: 'curl',
    docUrl: 'https://antigravity.google/docs',
    description: 'Google Antigravity autonomous coding agent harness.',
  },
  codex: {
    provider: 'codex',
    name: 'Codex CLI',
    command: 'npm install -g @openai/codex',
    packageManager: 'npm',
    docUrl: 'https://openai.com/codex',
    description: 'OpenAI Codex terminal coding agent.',
  },
  custom: {
    provider: 'custom',
    name: 'Custom Agent CLI',
    command: 'pip install aider-chat',
    packageManager: 'pip',
    docUrl: 'https://aider.chat',
    description: 'Connect custom agent CLIs (e.g. Aider, Mentor, Cursor CLI).',
  }
};
