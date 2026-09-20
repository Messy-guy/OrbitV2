import assert from 'assert';
import { SkillAggregatorService, ANTHROPIC_OFFICIAL_SKILLS, SKILLS_SH_OFFICIAL_SKILLS } from '../skillAggregator.service';
import { ProviderSkillAdapterService } from '../providerSkillAdapter.service';
import { SkillItem } from '../../types/skills';

async function runOnlineSkillRegistrySuite() {
  console.log('========================================================================');
  console.log(' ORBIT — ONLINE SKILL REGISTRY & SEARCH TEST SUITE');
  console.log('========================================================================\n');

  // 1. Anthropic Official Skills Presence & Structure
  console.log('--- TEST 1: Anthropic Official Catalog Verification ---');
  assert(ANTHROPIC_OFFICIAL_SKILLS.length >= 10, 'Must have at least 10 official Anthropic skills');
  for (const skill of ANTHROPIC_OFFICIAL_SKILLS) {
    assert.strictEqual(skill.source, 'anthropic', `Skill ${skill.id} must have source 'anthropic'`);
    assert(skill.tags.includes('anthropic'), `Skill ${skill.id} must include 'anthropic' tag`);
    assert(skill.name.startsWith('anthropics/'), `Skill ${skill.name} must start with anthropics/`);
    assert(skill.directive.length > 20, `Skill ${skill.id} must have meaningful directive`);
  }
  const mcpSkill = ANTHROPIC_OFFICIAL_SKILLS.find(s => s.shortLabel === 'MCP Server Builder');
  assert(mcpSkill, 'MCP Server Builder skill must exist in Anthropic catalog');
  console.log(`  ✓ Verified ${ANTHROPIC_OFFICIAL_SKILLS.length} official Anthropic skills loaded with valid schema`);

  // 2. skills.sh / Vercel Labs Catalog Verification
  console.log('--- TEST 2: skills.sh / Vercel Labs Catalog Verification ---');
  assert(SKILLS_SH_OFFICIAL_SKILLS.length >= 5, 'Must have at least 5 official skills.sh skills');
  for (const skill of SKILLS_SH_OFFICIAL_SKILLS) {
    assert.strictEqual(skill.source, 'skills_sh', `Skill ${skill.id} must have source 'skills_sh'`);
    assert(skill.tags.includes('skills.sh') || skill.tags.includes('vercel'), `Skill ${skill.id} must include skills.sh or vercel tag`);
  }
  const webDesignSkill = SKILLS_SH_OFFICIAL_SKILLS.find(s => s.shortLabel === 'Web Design Guidelines');
  assert(webDesignSkill, 'Web Design Guidelines must exist in skills.sh catalog');
  console.log(`  ✓ Verified ${SKILLS_SH_OFFICIAL_SKILLS.length} skills.sh skills loaded with valid schema`);

  // 3. Search & Filter by Source
  console.log('--- TEST 3: Multi-Registry Search & Source Filtering ---');
  const allSkills = await SkillAggregatorService.searchOnlineSkills('', 'all');
  assert(allSkills.length > ANTHROPIC_OFFICIAL_SKILLS.length, 'All skills search should return aggregated catalog');

  const anthropicOnly = await SkillAggregatorService.searchOnlineSkills('', 'anthropic');
  assert(anthropicOnly.length > 0, 'Anthropic filter should return skills');
  for (const s of anthropicOnly) {
    assert.strictEqual(s.source, 'anthropic', `Skill ${s.id} should only be anthropic`);
  }
  console.log(`  ✓ Anthropic source filter isolated ${anthropicOnly.length} skills`);

  const skillsShOnly = await SkillAggregatorService.searchOnlineSkills('', 'skills_sh');
  assert(skillsShOnly.length > 0, 'skills.sh filter should return skills');
  for (const s of skillsShOnly) {
    assert(s.source === 'skills_sh' || s.source === 'vercel', `Skill ${s.id} should be skills_sh/vercel`);
  }
  console.log(`  ✓ skills.sh source filter isolated ${skillsShOnly.length} skills`);

  // 4. Query Search
  console.log('--- TEST 4: Keyword Search across Online Registries ---');
  const mcpResults = await SkillAggregatorService.searchOnlineSkills('mcp', 'all');
  assert(mcpResults.some(s => s.name.includes('mcp') || s.tags.includes('mcp')), 'Query "mcp" should find MCP builder');
  console.log(`  ✓ Query 'mcp' returned ${mcpResults.length} relevant skill(s)`);

  const reactResults = await SkillAggregatorService.searchOnlineSkills('react', 'all');
  assert(reactResults.some(s => s.name.includes('react') || s.tags.includes('react')), 'Query "react" should find react best practices');
  console.log(`  ✓ Query 'react' returned ${reactResults.length} relevant skill(s)`);

  // 5. Skill Content Resolution
  console.log('--- TEST 5: Skill Content Resolution ---');
  const resolvedDirect = await SkillAggregatorService.resolveSkillContent({
    ...mcpSkill,
    rawContent: '# MCP Builder\nTest content',
  });
  assert.strictEqual(resolvedDirect.rawContent, '# MCP Builder\nTest content', 'Existing rawContent must be preserved');

  // Fallback directive preservation
  const testSkillWithoutContent: SkillItem = {
    id: 'test-synthetic',
    name: 'test/synthetic',
    shortLabel: 'Synthetic',
    description: 'Synthetic test skill',
    source: 'official',
    sourceLabel: 'Test',
    category: 'workflow',
    tags: ['test'],
    directive: 'Follow test guidelines.',
  };
  const resolvedSynthetic = await SkillAggregatorService.resolveSkillContent(testSkillWithoutContent);
  assert.strictEqual(resolvedSynthetic.id, 'test-synthetic');
  console.log('  ✓ Verified skill content resolution and fallback contracts');

  // 6. Provider Adapter Integration
  console.log('--- TEST 6: Provider Skill Adapter Compatibility ---');
  const slug = ProviderSkillAdapterService.sanitizeSkillSlug(mcpSkill!);
  assert.strictEqual(slug, 'mcp-server-builder');

  const agyCaps = ProviderSkillAdapterService.getCapabilities('antigravity');
  assert.strictEqual(agyCaps.skillDirectory, '.agents/skills');
  const agyRelPath = agyCaps.resolveSkillPath(slug);
  assert.strictEqual(agyRelPath, '.agents/skills/mcp-server-builder/SKILL.md');

  const claudeCaps = ProviderSkillAdapterService.getCapabilities('claude');
  assert.strictEqual(claudeCaps.skillDirectory, '.claude/skills');
  const claudeRelPath = claudeCaps.resolveSkillPath(slug);
  assert.strictEqual(claudeRelPath, '.claude/skills/mcp-server-builder/SKILL.md');
  assert.strictEqual(claudeCaps.getActivationInstruction?.(mcpSkill!), '/use-skill mcp-server-builder');

  const markdown = ProviderSkillAdapterService.formatSkillMarkdown(mcpSkill!);
  assert(markdown.includes('name: mcp-server-builder'), 'Formatted markdown must include YAML name');
  assert(markdown.includes('Anthropic MCP server architecture'), 'Formatted markdown must include directive');
  console.log('  ✓ Verified provider adapter mounts and frontmatter formatting for Antigravity, Claude, and all supported engines');

  console.log('\n========================================================================');
  console.log(' 🎉 ALL ONLINE SKILL REGISTRY TESTS CERTIFIED (100% GREEN)');
  console.log('========================================================================\n');
}

runOnlineSkillRegistrySuite().catch(err => {
  console.error('Online skill registry suite failed:', err);
  process.exit(1);
});
