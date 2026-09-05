/**
 * Orbit Official Agent CLI Installation Registry
 * Provides verified 1-click terminal install and uninstall commands for major AI coding agents.
 */

export interface AgentInstallerConfig {
  provider: string;
  name: string;
  command: string;
  fallbackCommand?: string;
  uninstallCommand?: string;
  packageManager: 'npm' | 'pip' | 'curl' | 'cargo' | 'gh' | 'system';
  docUrl: string;
  description: string;
}

export const OFFICIAL_AGENT_INSTALLERS: Record<string, AgentInstallerConfig> = {
  antigravity: {
    provider: 'antigravity',
    name: 'Antigravity CLI (agy)',
    command: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    fallbackCommand: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    uninstallCommand: 'rm -f ~/.local/bin/agy ~/.gemini/antigravity-cli/bin/agy ~/.local/share/orbit/engines/antigravity/bin/agy',
    packageManager: 'curl',
    docUrl: 'https://antigravity.google/docs',
    description: 'Official Google Antigravity autonomous coding agent harness (agy).',
  },
  claude: {
    provider: 'claude',
    name: 'Claude Code CLI',
    command: 'npm install -g @anthropic-ai/claude-code',
    fallbackCommand: 'curl -fsSL https://claude.ai/install.sh | bash',
    uninstallCommand: 'npm uninstall -g @anthropic-ai/claude-code; rm -f ~/.local/bin/claude',
    packageManager: 'npm',
    docUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    description: 'Official Anthropic Claude Code terminal agent harness.',
  },
  codex: {
    provider: 'codex',
    name: 'Codex CLI',
    command: 'npm install -g @openai/codex',
    uninstallCommand: 'npm uninstall -g @openai/codex; rm -f ~/.npm-global/bin/codex',
    packageManager: 'npm',
    docUrl: 'https://openai.com/codex',
    description: 'OpenAI Codex terminal coding agent.',
  },
  opencode: {
    provider: 'opencode',
    name: 'OpenCode Interpreter',
    command: 'npm install -g opencode-ai',
    fallbackCommand: 'npx opencode-ai',
    uninstallCommand: 'npm uninstall -g opencode-ai; rm -f ~/.nvm/versions/node/*/bin/opencode ~/.npm-global/bin/opencode',
    packageManager: 'npm',
    docUrl: 'https://opencode.ai',
    description: 'Open-source local terminal coding interpreter for DeepSeek R1 & open models.',
  },
  kilocode: {
    provider: 'kilocode',
    name: 'KiloCode CLI',
    command: 'npm install -g @kilocode/cli',
    fallbackCommand: 'npx @kilocode/cli',
    uninstallCommand: 'npm uninstall -g @kilocode/cli; rm -f ~/.nvm/versions/node/*/bin/kilocode ~/.npm-global/bin/kilocode',
    packageManager: 'npm',
    docUrl: 'https://kilocode.ai',
    description: 'Autonomous KiloCode terminal agent harness with codebase indexing.',
  },
  freebuff: {
    provider: 'freebuff',
    name: 'Freebuff CLI',
    command: 'npm install -g freebuff',
    fallbackCommand: 'npx freebuff',
    uninstallCommand: 'npm uninstall -g freebuff; rm -f ~/.nvm/versions/node/*/bin/freebuff ~/.npm-global/bin/freebuff',
    packageManager: 'npm',
    docUrl: 'https://github.com/freebuff/freebuff',
    description: 'Lightweight autonomous AI agent CLI for rapid feature implementation.',
  },
  cline: {
    provider: 'cline',
    name: 'Cline CLI',
    command: 'npm install -g cline',
    fallbackCommand: 'npx cline',
    uninstallCommand: 'npm uninstall -g cline; rm -f ~/.nvm/versions/node/*/bin/cline ~/.npm-global/bin/cline',
    packageManager: 'npm',
    docUrl: 'https://github.com/cline/cline',
    description: 'Autonomous multi-model Cline terminal coding agent harness.',
  },
  copilot: {
    provider: 'copilot',
    name: 'GitHub Copilot CLI',
    command: 'npm install -g @github/copilot',
    fallbackCommand: 'npx @github/copilot',
    uninstallCommand: 'npm uninstall -g @github/copilot; rm -f ~/.npm-global/bin/copilot ~/.nvm/versions/node/*/bin/copilot',
    packageManager: 'npm',
    docUrl: 'https://github.com/github/copilot-cli',
    description: 'Official GitHub Copilot autonomous terminal coding agent CLI by GitHub.',
  },
  goose: {
    provider: 'goose',
    name: 'Goose CLI',
    command: 'curl -fsSL https://github.com/aaif-goose/goose/releases/download/stable/download_cli.sh | bash',
    fallbackCommand: 'curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash',
    uninstallCommand: 'rm -f ~/.local/bin/goose ~/.cargo/bin/goose',
    packageManager: 'curl',
    docUrl: 'https://block.github.io/goose',
    description: 'Autonomous on-machine developer agent with extensible MCP tools by Block.',
  },
  kiro: {
    provider: 'kiro',
    name: 'Kiro CLI',
    command: 'curl -fsSL https://cli.kiro.dev/install | bash',
    fallbackCommand: 'npm install -g kiro-cli',
    uninstallCommand: 'rm -f ~/.local/bin/kiro ~/.local/bin/kiro-cli; npm uninstall -g kiro-cli 2>/dev/null || true',
    packageManager: 'curl',
    docUrl: 'https://kiro.dev',
    description: 'High-performance autonomous terminal assistant & agent runner.',
  },
  qwen: {
    provider: 'qwen',
    name: 'Qwen Code',
    command: 'npm install -g @qwen-code/qwen-code@latest',
    fallbackCommand: 'pip install qwen-code',
    uninstallCommand: 'npm uninstall -g @qwen-code/qwen-code; rm -f ~/.var/app/com.visualstudio.code/data/node_modules/bin/qwen',
    packageManager: 'npm',
    docUrl: 'https://github.com/QwenLM/qwen-code',
    description: 'Alibaba Qwen specialized coding agent for deep multilingual reasoning.',
  },
  mimo: {
    provider: 'mimo',
    name: 'Mimo Code',
    command: 'npm install -g @mimo-ai/cli',
    fallbackCommand: 'npx @mimo-ai/cli',
    uninstallCommand: 'npm uninstall -g @mimo-ai/cli; rm -f ~/.local/bin/mimo ~/.npm-global/bin/mimo',
    packageManager: 'npm',
    docUrl: 'https://mimo.xiaomi.com/coder',
    description: 'Autonomous on-device developer coding agent CLI by Xiaomi.',
  },
  muse: {
    provider: 'muse',
    name: 'Muse Code',
    command: 'curl -fsSL https://dev.meta.ai/install.sh | bash',
    uninstallCommand: 'rm -f ~/.local/bin/muse ~/.local/bin/muse-cli',
    packageManager: 'curl',
    docUrl: 'https://dev.meta.ai',
    description: 'Meta AI autonomous terminal coding assistant powered by Llama.',
  },
  vibe: {
    provider: 'vibe',
    name: 'Mistral Vibe',
    command: 'curl -LsSf https://mistral.ai/vibe/install.sh | bash',
    fallbackCommand: 'pip install mistral-vibe',
    uninstallCommand: 'rm -f ~/.local/bin/vibe ~/.local/share/uv/tools/mistral-vibe/bin/vibe',
    packageManager: 'curl',
    docUrl: 'https://mistral.ai',
    description: 'Mistral AI terminal coding harness powered by Codestral for ultra-fast generation.',
  },
  qoder: {
    provider: 'qoder',
    name: 'Qoder CLI',
    command: 'curl -fsSL https://qoder.com/install | bash',
    fallbackCommand: 'npm install -g qoder-cli',
    uninstallCommand: 'rm -rf ~/.qoder; rm -f ~/.local/bin/qodercli',
    packageManager: 'curl',
    docUrl: 'https://qoder.ai',
    description: 'Intelligent command line coding agent for fast repository navigation & refactoring.',
  },
  terminal: {
    provider: 'terminal',
    name: 'Shell Terminal',
    command: '',
    packageManager: 'system',
    docUrl: 'https://www.gnu.org/software/bash/',
    description: 'Built-in operating system shell terminal.',
  },
};
