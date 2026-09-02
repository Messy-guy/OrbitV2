import { ProviderSkillAdapterService } from '../providerSkillAdapter.service';
import { useSkillStore } from '../../stores/skill.store';
import { useAgentStore } from '../../stores/agent.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { SkillItem } from '../../types/skills';
import { AgentProvider } from '../../types/orbit';

export async function runSkillTestSuite() {
  const sampleSkill: SkillItem = {
    id: 'skill-race-condition',
    name: 'Detect Race Conditions',
    shortLabel: 'Race Condition Scanner',
    description: 'Scans for concurrent request hazards and payment idempotency',
    source: 'official',
    sourceLabel: 'Leo-Agent',
    category: 'security',
    tags: ['concurrency', 'security'],
    directive: 'Wrap all state mutations in atomic transactions.',
  };

  // 1. Provider Capabilities Matrix (16 Agents)
  const allProviders: AgentProvider[] = [
    'antigravity',
    'claude',
    'codex',
    'opencode',
    'kilocode',
    'freebuff',
    'cline',
    'copilot',
    'goose',
    'kiro',
    'qwen',
    'mimo',
    'muse',
    'vibe',
    'qoder',
    'terminal',
  ];

  for (const provider of allProviders) {
    const caps = ProviderSkillAdapterService.getCapabilities(provider);
    if (!caps || caps.provider !== provider) {
      throw new Error(`Capability definition missing or mismatched for provider ${provider}`);
    }
    if (!['native', 'orbit-assisted', 'filesystem'].includes(caps.integrationMode)) {
      throw new Error(`Invalid integration mode for provider ${provider}`);
    }
    if (!caps.skillDirectory || typeof caps.resolveSkillPath !== 'function') {
      throw new Error(`Invalid skill directory or resolver for provider ${provider}`);
    }
  }

  const agyCaps = ProviderSkillAdapterService.getCapabilities('antigravity');
  if (agyCaps.integrationMode !== 'native' || !agyCaps.supportsNativeDiscovery) {
    throw new Error('AGY capability assertion failed');
  }

  const claudeCaps = ProviderSkillAdapterService.getCapabilities('claude');
  if (claudeCaps.integrationMode !== 'native' || !claudeCaps.supportsNativeActivation) {
    throw new Error('Claude capability assertion failed');
  }

  const codexCaps = ProviderSkillAdapterService.getCapabilities('codex');
  if (codexCaps.integrationMode !== 'orbit-assisted' || codexCaps.supportsNativeActivation !== false) {
    throw new Error('Codex capability assertion failed');
  }

  // 2. Path Sanitization & Traversal Security
  if (ProviderSkillAdapterService.sanitizeSkillSlug('../../../etc/passwd') !== 'etc-passwd') {
    throw new Error('Security: Path traversal ../ not stripped');
  }
  if (ProviderSkillAdapterService.sanitizeSkillSlug('..\\..\\windows\\system32') !== 'windows-system32') {
    throw new Error('Security: Windows backslash traversal not stripped');
  }
  if (ProviderSkillAdapterService.sanitizeSkillSlug('foo/../../bar') !== 'foo-bar') {
    throw new Error('Security: Nested traversal not stripped');
  }
  if (ProviderSkillAdapterService.sanitizeSkillSlug('foo\0bar') !== 'foobar') {
    throw new Error('Security: Null byte not stripped');
  }

  // 3. SKILL.md Generator
  const md = ProviderSkillAdapterService.formatSkillMarkdown(sampleSkill);
  if (!md.includes('name: race-condition-scanner') || !md.includes('Wrap all state mutations')) {
    throw new Error('Markdown frontmatter generation failed');
  }

  // 4. Idempotent Equipping & Concurrency Safety
  useSkillStore.setState({
    installedSkills: [],
    favoriteSkills: [],
    assignmentsByAgent: {},
  });

  useWorkspaceStore.setState({
    workspaces: [
      {
        id: 'ws-test',
        name: 'Test Project',
        projectPath: '/test/project',
        spaces: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: new Date().toISOString(),
      },
    ],
    activeWorkspaceId: 'ws-test',
  });

  useAgentStore.setState({
    agents: [
      {
        id: 'agent-agy-1',
        name: 'AGY Agent',
        provider: 'antigravity',
        model: 'auto',
        role: 'raw',
        status: 'ready',
        viewMode: 'terminal',
        workspaceId: 'ws-test',
        createdAt: Date.now(),
      },
      {
        id: 'agent-claude-1',
        name: 'Claude Agent',
        provider: 'claude',
        model: 'claude-3-7-sonnet',
        role: 'raw',
        status: 'ready',
        viewMode: 'terminal',
        workspaceId: 'ws-test',
        createdAt: Date.now(),
      },
    ],
  });

  const assignment = await useSkillStore.getState().equipSkillToAgent('agent-agy-1', sampleSkill);
  if (assignment.status !== 'equipped' || assignment.integrationMode !== 'native') {
    throw new Error(`Equip operation failed: ${assignment.error}`);
  }

  // Idempotency check
  const assignment2 = await useSkillStore.getState().equipSkillToAgent('agent-agy-1', sampleSkill);
  if (assignment2.status !== 'equipped') {
    throw new Error('Idempotent re-equip failed');
  }
  if (useSkillStore.getState().getAgentSkillAssignments('agent-agy-1').length !== 1) {
    throw new Error('Duplicate assignment created');
  }

  // Multi-agent concurrency
  const skill2: SkillItem = {
    id: 'skill-vitest-tdd',
    name: 'Vitest TDD Master',
    shortLabel: 'TDD Master',
    description: 'Enforces red-green-refactor cycle',
    source: 'official',
    sourceLabel: 'Leo-Agent',
    category: 'testing',
    tags: ['tdd', 'vitest'],
    directive: 'Write unit tests before code.',
  };

  await Promise.all([
    useSkillStore.getState().equipSkillToAgent('agent-agy-1', skill2),
    useSkillStore.getState().equipSkillToAgent('agent-claude-1', sampleSkill),
  ]);

  if (useSkillStore.getState().getEquippedSkills('agent-agy-1').length !== 2) {
    throw new Error('Concurrent equip count mismatch for agent-agy-1');
  }
  if (useSkillStore.getState().getEquippedSkills('agent-claude-1').length !== 1) {
    throw new Error('Concurrent equip count mismatch for agent-claude-1');
  }

  // Safe removal
  await useSkillStore.getState().unequipSkillFromAgent('agent-agy-1', sampleSkill.id);
  if (useSkillStore.getState().getEquippedSkills('agent-agy-1').length !== 1) {
    throw new Error('Unequip failed on agent-agy-1');
  }
  if (useSkillStore.getState().getEquippedSkills('agent-claude-1').length !== 1) {
    throw new Error('Unequip on agent-agy-1 erroneously mutated agent-claude-1');
  }

  return true;
}
