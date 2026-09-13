import { SkillItem } from '../types/skills';

// Known official industry leader creators
const OFFICIAL_CREATORS = new Set([
  'greensock',
  'vercel-labs',
  'vercel',
  'stripe',
  'supabase',
  'anthropics',
  'expo',
  'getsentry',
  'google-gemini',
  'cloudflare',
  'angular',
  'firebase',
  'microsoft',
  'sanity',
  'huggingface',
  'tinybird',
  'resend',
  'modem-dev',
  'shadcn',
  'callstack',
  'courier',
  'firecrawl',
  'neon',
  'clickhouse',
  'remotion',
  'duckdb',
  'mongodb',
  'redis',
  'auth0',
  'coderabbit',
  'leo-agent'
]);

// Bundled Hardened Industrial Skills from Leo-Agent & Orbit Engine
export const BUNDLED_HARDENED_SKILLS: SkillItem[] = [
  {
    id: 'leo/detect-race-condition',
    name: 'leo-agent/detect-race-condition',
    shortLabel: 'Race Condition Scanner',
    description: 'Scans for concurrent request hazards, payment without idempotency, and non-atomic database state updates.',
    source: 'github',
    sourceLabel: 'Leo-Agent Security',
    category: 'security',
    author: 'Vishnu Guardian',
    tags: ['security', 'concurrency', 'idempotency', 'transactions', 'atomic'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: DETECT RACE CONDITIONS. Wrap concurrent state mutations in atomic database transactions with conditional update locks. Enforce idempotency keys on payment and state endpoints.',
  },
  {
    id: 'leo/detect-sequential-awaits',
    name: 'leo-agent/detect-sequential-awaits',
    shortLabel: 'Async Parallelizer',
    description: 'Converts sequential independent awaits into Promise.all parallel execution for 3-5x faster backend latency.',
    source: 'github',
    sourceLabel: 'Leo-Agent / Mahesh',
    category: 'backend',
    author: 'Mahesh Engine',
    tags: ['performance', 'async', 'promise-all', 'latency', 'mahesh'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: ZERO SEQUENTIAL AWAITS. Whenever two async operations do not depend on each other, combine them with Promise.all([A(), B()]) instead of sequential awaits.',
  },
  {
    id: 'leo/check-decimal-money',
    name: 'leo-agent/check-decimal-money',
    shortLabel: 'Decimal Money Safety',
    description: 'Guarantees prices and currencies are stored as integer cents or exact decimals, never floating points.',
    source: 'github',
    sourceLabel: 'Leo-Agent / Atlas',
    category: 'backend',
    author: 'Atlas Database',
    tags: ['financial', 'currency', 'money', 'database', 'precision'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: DECIMAL MONEY SAFETY. Never use JavaScript floating point math for financial currency. Store currency in integer cents (e.g. 1000 = $10.00) or exact Decimal types.',
  },
  {
    id: 'leo/find-n-plus-one',
    name: 'leo-agent/find-n-plus-one',
    shortLabel: 'N+1 Query Eliminator',
    description: 'Eliminates nested database queries inside loops by batch loading relationships.',
    source: 'github',
    sourceLabel: 'Leo-Agent / Mahesh',
    category: 'backend',
    author: 'Mahesh Engine',
    tags: ['database', 'orm', 'performance', 'sql', 'prisma'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: ELIMINATE N+1 QUERIES. Never execute database queries inside array loops or map functions. Use batch loaders, Prisma `include`, or SQL `IN (...)` queries.',
  },
  {
    id: 'orbit/vitest-tdd-master',
    name: 'orbit/vitest-tdd-master',
    shortLabel: 'Vitest TDD Master',
    description: 'Enforces strict Red-Green-Refactor loop with 100% type-safe unit and integration test coverage.',
    source: 'skills_sh',
    sourceLabel: 'Orbit Standard',
    category: 'testing',
    author: 'Orbit Engineering',
    tags: ['testing', 'vitest', 'tdd', 'unit-tests'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: STRICT VITEST TDD. Write failing unit and integration tests first. Implement the minimal type-safe code to turn the test suite green.',
  }
];

let liveRegistryCache: SkillItem[] | null = null;
let isFetchingRegistry = false;

export const skillAggregatorService = {
  /**
   * Dynamically fetches, parses, and indexes the entire live open registry (1,217+ official skills)
   * seamlessly merged with the Bundled Leo-Agent Hardened Skills.
   */
  async fetchLiveOnlineSkills(forceRefresh: boolean = false): Promise<SkillItem[]> {
    if (liveRegistryCache && !forceRefresh) {
      return liveRegistryCache;
    }

    try {
      isFetchingRegistry = true;
      const response = await fetch('https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md', {
        headers: { 'Accept': 'text/plain' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} when fetching live skill registry`);
      }

      const text = await response.text();
      const parsed: SkillItem[] = [...BUNDLED_HARDENED_SKILLS];

      // Regex matches table rows: | [name](url) | Description | Author |
      const rowRegex = /\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+)\/([^)]+))\)\s*\|\s*([^|]+)\|\s*([^|]+)\|/g;
      let match;

      while ((match = rowRegex.exec(text)) !== null) {
        const [, repoName, url, author, rawRepo, rawDescription] = match;
        const authorLower = author.toLowerCase().trim();
        const repo = rawRepo.trim();
        const repoLower = repo.toLowerCase();
        const description = rawDescription.replace(/<[^>]*>/g, '').trim();

        // Categorization heuristic
        let category: any = 'workflow';
        if (/test|vitest|jest|playwright|cypress|mock/i.test(description) || /test/i.test(repoLower)) {
          category = 'testing';
        } else if (/auth|security|jwt|oauth|crypto|guard/i.test(description) || /auth|security/i.test(repoLower)) {
          category = 'security';
        } else if (/ui|design|css|tailwind|framer|gsap|canvas|three/i.test(description) || /ui|design|gsap/i.test(repoLower)) {
          category = 'design';
        } else if (/react|next|vue|nuxt|svelte|astro|angular|expo/i.test(description) || /react|next/i.test(repoLower)) {
          category = 'framework';
        } else if (/database|sql|postgres|supabase|redis|mongo|prisma|orm/i.test(description) || /db|database|sql/i.test(repoLower)) {
          category = 'backend';
        }

        const isOfficial = OFFICIAL_CREATORS.has(authorLower);
        const source = isOfficial ? 'official' : 'github';
        const sourceLabel = isOfficial ? `${author} (Verified)` : author;
        const id = `${authorLower}/${repoLower}`;

        if (parsed.some(p => p.id === id)) continue;

        // Clean label
        const shortLabel = repo
          .replace(/-/g, ' ')
          .replace(/^(skill|agent|tool)-/i, '')
          .replace(/^gsap-/, 'GSAP ')
          .replace(/^expo-/, 'Expo ');

        parsed.push({
          id,
          name: `${author}/${repo}`,
          shortLabel,
          description: description.trim(),
          source,
          sourceLabel,
          category,
          author,
          tags: [authorLower, category, ...repoLower.split('-')],
          isPopular: isOfficial,
          rawUrl: url,
          directive: `[ORBIT SKILL INVARIANT: ${repo.toUpperCase()}]: Follow all engineering best practices and architectural constraints from ${url} for ${description.trim()}.`,
        });
      }

      liveRegistryCache = parsed;
      return parsed;
    } catch (err) {
      console.warn('Live online registry fetch fallback to bundled skills:', err);
      liveRegistryCache = BUNDLED_HARDENED_SKILLS;
      return BUNDLED_HARDENED_SKILLS;
    } finally {
      isFetchingRegistry = false;
    }
  },

  async importSkillFromGitHub(repoUrl: string): Promise<SkillItem> {
    const cleanUrl = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
    const match = cleanUrl.match(/^(?:https?:\/\/github\.com\/)?([^/]+)\/([^/#]+)(?:\/tree\/([^/]+)(?:\/(.*))?)?$/i);
    if (!match) throw new Error('Enter a GitHub repository URL such as github.com/owner/repository');
    const [, owner, repo, requestedRef, requestedPath] = match;
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const headers = { Accept: 'application/vnd.github+json' };
    const repoInfo = await fetch(apiBase, { headers });
    if (!repoInfo.ok) throw new Error(`GitHub repository lookup failed (${repoInfo.status})`);
    const metadata = await repoInfo.json() as { default_branch?: string; license?: { spdx_id?: string } };
    const ref = requestedRef || metadata.default_branch || 'main';
    const commitResponse = await fetch(`${apiBase}/commits/${encodeURIComponent(ref)}`, { headers });
    if (!commitResponse.ok) throw new Error(`GitHub ref '${ref}' could not be resolved`);
    const commit = await commitResponse.json() as { sha: string };
    const treeResponse = await fetch(`${apiBase}/git/trees/${commit.sha}?recursive=1`, { headers });
    if (!treeResponse.ok) throw new Error(`GitHub tree lookup failed (${treeResponse.status})`);
    const tree = await treeResponse.json() as { tree?: Array<{ path: string; type: string; size?: number }> };
    const files = (tree.tree || []).filter(item => item.type === 'blob');
    const skillFile = files.find(item => {
      if (!item.path.endsWith('SKILL.md')) return false;
      return !requestedPath || item.path === `${requestedPath.replace(/\/$/, '')}/SKILL.md` || item.path.startsWith(`${requestedPath.replace(/\/$/, '')}/`);
    });
    if (!skillFile) throw new Error('No SKILL.md was found in this GitHub repository or selected skill directory');
    const skillRoot = skillFile.path.slice(0, -'SKILL.md'.length).replace(/\/$/, '');
    const bundleFiles = files.filter(item => item.path === skillFile.path || item.path.startsWith(`${skillRoot}/`));
    const downloaded: Array<{ relativePath: string; content: string; size: number }> = [];
    for (const file of bundleFiles) {
      const response = await fetch(`${apiBase}/contents/${file.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(commit.sha)}`, { headers });
      if (!response.ok) throw new Error(`Could not download ${file.path} (${response.status})`);
      const payload = await response.json() as { content?: string; encoding?: string; size?: number };
      if (payload.encoding !== 'base64' || !payload.content) throw new Error(`Unsupported GitHub content encoding for ${file.path}`);
      const binary = atob(payload.content.replace(/\n/g, ''));
      const content = new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
      downloaded.push({ relativePath: file.path.slice(skillRoot ? skillRoot.length + 1 : 0), content, size: payload.size ?? content.length });
    }
    const skillMarkdown = downloaded.find(file => file.relativePath === 'SKILL.md')?.content || '';
    const description = skillMarkdown.match(/description:\s*[|>]?(?:\s*)([^\n]+)/i)?.[1]?.trim() || `Imported from ${owner}/${repo}`;
    const skillName = skillRoot.split('/').pop() || repo.replace(/[^a-zA-Z0-9_-]/g, '-');
    const dependencyText = `${skillMarkdown}\n${downloaded.map(file => file.content).join('\n')}`;
    const dependencies: import('../types/skills').SkillDependency[] = [];
    for (const [name, kind] of [['ffmpeg', 'tool'], ['ffprobe', 'tool'], ['python', 'runtime'], ['higgsfield', 'service'], ['monid', 'service']] as const) {
      if (new RegExp(`\\b${name}\\b`, 'i').test(dependencyText)) dependencies.push({ name, kind, required: true });
    }

    return {
      id: `github-${owner.toLowerCase()}-${repo.toLowerCase()}-${skillName.toLowerCase()}`,
      name: `${owner}/${repo}`,
      shortLabel: repo,
      description,
      source: 'github',
      sourceLabel: 'GitHub Repo',
      category: 'workflow',
      author: owner,
      tags: ['github', 'custom', 'imported'],
      isPopular: false,
      directive: `Use the imported skill bundle at .orbit/skills/${skillName}/SKILL.md when relevant.`,
      rawContent: skillMarkdown,
      files: downloaded,
      sourceRef: ref,
      commitSha: commit.sha,
      trust: 'unreviewed',
      dependencies,
    };
  }
};
