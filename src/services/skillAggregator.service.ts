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

// Bundled Hardened Industrial Skills from Orbit Engine
export const BUNDLED_HARDENED_SKILLS: SkillItem[] = [
  {
    id: 'orbit/detect-race-condition',
    name: 'orbit/detect-race-condition',
    shortLabel: 'Race Condition Scanner',
    description: 'Scans for concurrent request hazards, payment without idempotency, and non-atomic database state updates.',
    source: 'official',
    sourceLabel: 'Orbit Security',
    category: 'security',
    author: 'Security Guardian',
    tags: ['security', 'concurrency', 'idempotency', 'transactions', 'atomic'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: DETECT RACE CONDITIONS. Wrap concurrent state mutations in atomic database transactions with conditional update locks. Enforce idempotency keys on payment and state endpoints.',
  },
  {
    id: 'orbit/detect-sequential-awaits',
    name: 'orbit/detect-sequential-awaits',
    shortLabel: 'Async Parallelizer',
    description: 'Converts sequential independent awaits into Promise.all parallel execution for 3-5x faster backend latency.',
    source: 'official',
    sourceLabel: 'Orbit Performance',
    category: 'backend',
    author: 'Async Performance Engine',
    tags: ['performance', 'async', 'promise-all', 'latency'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: ZERO SEQUENTIAL AWAITS. Whenever two async operations do not depend on each other, combine them with Promise.all([A(), B()]) instead of sequential awaits.',
  },
  {
    id: 'orbit/check-decimal-money',
    name: 'orbit/check-decimal-money',
    shortLabel: 'Decimal Money Safety',
    description: 'Guarantees prices and currencies are stored as integer cents or exact decimals, never floating points.',
    source: 'official',
    sourceLabel: 'Orbit Safety',
    category: 'backend',
    author: 'Financial Safety Engine',
    tags: ['financial', 'currency', 'money', 'database', 'precision'],
    isPopular: true,
    directive: 'ROLE CONTINUOUS INVARIANT: DECIMAL MONEY SAFETY. Never use JavaScript floating point math for financial currency. Store currency in integer cents (e.g. 1000 = $10.00) or exact Decimal types.',
  },
  {
    id: 'orbit/find-n-plus-one',
    name: 'orbit/find-n-plus-one',
    shortLabel: 'N+1 Query Eliminator',
    description: 'Eliminates nested database queries inside loops by batch loading relationships.',
    source: 'official',
    sourceLabel: 'Orbit Database',
    category: 'backend',
    author: 'Database Optimizer Engine',
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

// Official Anthropic Skills (anthropics/skills on GitHub)
export const ANTHROPIC_OFFICIAL_SKILLS: SkillItem[] = [
  {
    id: 'anthropic/mcp-builder',
    name: 'anthropics/mcp-builder',
    shortLabel: 'MCP Server Builder',
    description: 'Guide for creating high-quality Model Context Protocol (MCP) servers in Python (FastMCP) or Node/TypeScript SDK.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'backend',
    author: 'Anthropic',
    tags: ['anthropic', 'mcp', 'sdk', 'tools', 'protocol', 'python', 'typescript'],
    isPopular: true,
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/mcp-builder',
    directive: 'Follow official Anthropic MCP server architecture: design clean tool interfaces, schema validation, and structured error boundaries.',
  },
  {
    id: 'anthropic/webapp-testing',
    name: 'anthropics/webapp-testing',
    shortLabel: 'Web App Testing & Automation',
    description: 'Toolkit and patterns for end-to-end web testing using Playwright, Vitest, component testing, and browser verification.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'testing',
    author: 'Anthropic',
    tags: ['anthropic', 'testing', 'playwright', 'vitest', 'e2e', 'automation'],
    isPopular: true,
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/webapp-testing',
    directive: 'Enforce robust web application test automation with explicit selectors, mock assertions, and clean error traces.',
  },
  {
    id: 'anthropic/frontend-design',
    name: 'anthropics/frontend-design',
    shortLabel: 'Frontend Design Systems',
    description: 'Create distinct, production-grade frontend designs with Tailwind CSS, accessible UI patterns, and animation principles.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'design',
    author: 'Anthropic',
    tags: ['anthropic', 'frontend', 'design', 'tailwind', 'ui', 'css'],
    isPopular: true,
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/frontend-design',
    directive: 'Design responsive, accessible, high-fidelity interfaces following modern design system tokens and component composition.',
  },
  {
    id: 'anthropic/claude-api',
    name: 'anthropics/claude-api',
    shortLabel: 'Claude API Integration',
    description: 'Anthropic Claude API best practices: streaming, prompt caching, tool use, structured outputs, and vision integration.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'backend',
    author: 'Anthropic',
    tags: ['anthropic', 'claude', 'api', 'llm', 'streaming', 'caching'],
    isPopular: true,
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/claude-api',
    directive: 'Optimize Claude API usage with prompt caching headers, stream parsing, typed tool use schemas, and retry backoff.',
  },
  {
    id: 'anthropic/brand-guidelines',
    name: 'anthropics/brand-guidelines',
    shortLabel: 'Brand Guidelines & Typography',
    description: 'Enforce brand consistency, design systems, typography scales, color harmony, and voice across applications.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'design',
    author: 'Anthropic',
    tags: ['anthropic', 'brand', 'design', 'typography', 'theme'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/brand-guidelines',
    directive: 'Maintain strict visual hierarchy, WCAG contrast ratios, and consistent brand typography throughout the UI.',
  },
  {
    id: 'anthropic/canvas-design',
    name: 'anthropics/canvas-design',
    shortLabel: 'Canvas & Visual Graphics',
    description: 'HTML5 2D Canvas, WebGL, SVG rendering, generative visual art, and high-performance interactive graphics.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'design',
    author: 'Anthropic',
    tags: ['anthropic', 'canvas', 'graphics', 'svg', 'interactive', 'webgl'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/canvas-design',
    directive: 'Render hardware-accelerated 2D/3D graphics with optimal frame budgets and device-pixel-ratio scaling.',
  },
  {
    id: 'anthropic/docx',
    name: 'anthropics/docx',
    shortLabel: 'Word Document (.docx) Suite',
    description: 'Create, parse, format, and manipulate Microsoft Word documents with structured tables, styles, and headers.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'workflow',
    author: 'Anthropic',
    tags: ['anthropic', 'docx', 'documents', 'word', 'office'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/docx',
    directive: 'Generate and parse cleanly formatted .docx files adhering to standard OpenXML schemas.',
  },
  {
    id: 'anthropic/pdf',
    name: 'anthropics/pdf',
    shortLabel: 'PDF Extraction & Generation',
    description: 'Extract text, inspect vector graphics, fill forms, and generate high-fidelity PDF documents.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'workflow',
    author: 'Anthropic',
    tags: ['anthropic', 'pdf', 'documents', 'extraction', 'generation'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/pdf',
    directive: 'Process PDF documents with robust text flow, pagination handling, and metadata preservation.',
  },
  {
    id: 'anthropic/xlsx',
    name: 'anthropics/xlsx',
    shortLabel: 'Excel Spreadsheet (.xlsx) Suite',
    description: 'Read, calculate, format, and generate complex Excel spreadsheets, formulas, charts, and pivot tables.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'workflow',
    author: 'Anthropic',
    tags: ['anthropic', 'xlsx', 'excel', 'spreadsheets', 'data'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/xlsx',
    directive: 'Format spreadsheet workbooks with proper cell types, formulas, and tabular structures.',
  },
  {
    id: 'anthropic/pptx',
    name: 'anthropics/pptx',
    shortLabel: 'PowerPoint Slide (.pptx) Suite',
    description: 'Generate and customize PowerPoint presentations with structured layouts, themes, diagrams, and speaker notes.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'workflow',
    author: 'Anthropic',
    tags: ['anthropic', 'pptx', 'powerpoint', 'slides', 'presentations'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/pptx',
    directive: 'Assemble slide decks with consistent visual balance, slide geometry, and semantic speaker notes.',
  },
  {
    id: 'anthropic/skill-creator',
    name: 'anthropics/skill-creator',
    shortLabel: 'Skill Creator & Packager',
    description: 'Interactive workflow to design, validate, test, and package reusable SKILL.md bundles for AI agents.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'workflow',
    author: 'Anthropic',
    tags: ['anthropic', 'skills', 'authoring', 'packager', 'creator'],
    isPopular: true,
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/skill-creator',
    directive: 'Structure SKILL.md bundles with valid YAML frontmatter, progressive disclosure triggers, and test fixtures.',
  },
  {
    id: 'anthropic/theme-factory',
    name: 'anthropics/theme-factory',
    shortLabel: 'Theme Factory & Tokens',
    description: 'Generate accessible light/dark theme color palettes, WCAG-compliant contrast ratios, and semantic CSS tokens.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'design',
    author: 'Anthropic',
    tags: ['anthropic', 'theme', 'css', 'design-tokens', 'accessibility'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/theme-factory',
    directive: 'Construct tokenized design themes ensuring minimum 4.5:1 contrast ratios and smooth transitions.',
  },
  {
    id: 'anthropic/web-artifacts-builder',
    name: 'anthropics/web-artifacts-builder',
    shortLabel: 'Web Artifacts Builder',
    description: 'Build standalone, single-file HTML/JS/CSS interactive web applications with Tailwind and inline assets.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'framework',
    author: 'Anthropic',
    tags: ['anthropic', 'artifacts', 'html', 'interactive', 'preview'],
    isPopular: true,
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/web-artifacts-builder',
    directive: 'Compile interactive single-page web previews self-contained within safe sandbox containers.',
  },
  {
    id: 'anthropic/doc-coauthoring',
    name: 'anthropics/doc-coauthoring',
    shortLabel: 'Technical Documentation Coauthor',
    description: 'Coauthor architecture RFCs, technical specs, user guides, and API reference documentation.',
    source: 'anthropic',
    sourceLabel: 'Anthropic Official',
    category: 'workflow',
    author: 'Anthropic',
    tags: ['anthropic', 'docs', 'rfc', 'writing', 'architecture'],
    rawUrl: 'https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring',
    directive: 'Draft comprehensive technical specifications with clear goals, non-goals, architecture diagrams, and tradeoffs.',
  }
];

// Official skills.sh / Vercel Labs Skills (vercel-labs/agent-skills & skills.sh)
export const SKILLS_SH_OFFICIAL_SKILLS: SkillItem[] = [
  {
    id: 'skills_sh/web-design-guidelines',
    name: 'vercel-labs/web-design-guidelines',
    shortLabel: 'Web Design Guidelines',
    description: 'Review and refine web interfaces for layout consistency, responsive design, visual hierarchy, and polished spacing.',
    source: 'skills_sh',
    sourceLabel: 'skills.sh / Vercel',
    category: 'design',
    author: 'Vercel Labs',
    tags: ['skills_sh', 'vercel', 'design', 'ui', 'layout', 'responsive'],
    isPopular: true,
    rawUrl: 'https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines',
    directive: 'Enforce professional web interface design with clean whitespace, responsive breakpoints, and consistent typography.',
  },
  {
    id: 'skills_sh/react-best-practices',
    name: 'vercel-labs/react-best-practices',
    shortLabel: 'React Best Practices',
    description: 'Enforce modern React architecture: Server Components, minimal client JS, streaming boundaries, and state optimization.',
    source: 'skills_sh',
    sourceLabel: 'skills.sh / Vercel',
    category: 'framework',
    author: 'Vercel Labs',
    tags: ['skills_sh', 'vercel', 'react', 'nextjs', 'rsc', 'performance'],
    isPopular: true,
    rawUrl: 'https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices',
    directive: 'Adhere to React 19 / Next.js best practices: push client boundaries to leaves, minimize hydration payload, and prevent re-render cascades.',
  },
  {
    id: 'skills_sh/composition-patterns',
    name: 'vercel-labs/composition-patterns',
    shortLabel: 'React Composition Patterns',
    description: 'Compound components, slot patterns, render props, and headless component architecture for flexible UI.',
    source: 'skills_sh',
    sourceLabel: 'skills.sh / Vercel',
    category: 'framework',
    author: 'Vercel Labs',
    tags: ['skills_sh', 'vercel', 'react', 'composition', 'components'],
    rawUrl: 'https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns',
    directive: 'Build modular React components using compound patterns, slot distribution, and decoupled state hooks.',
  },
  {
    id: 'skills_sh/deploy-to-vercel',
    name: 'vercel-labs/deploy-to-vercel',
    shortLabel: 'Deploy to Vercel',
    description: 'Automate deployments, preview URLs, custom domains, environment variable configuration, and Edge functions on Vercel.',
    source: 'skills_sh',
    sourceLabel: 'skills.sh / Vercel',
    category: 'workflow',
    author: 'Vercel Labs',
    tags: ['skills_sh', 'vercel', 'deployment', 'ci-cd', 'cloud'],
    isPopular: true,
    rawUrl: 'https://github.com/vercel-labs/agent-skills/tree/main/skills/deploy-to-vercel',
    directive: 'Manage Vercel deployments, preview builds, environment headers, and serverless edge functions.',
  },
  {
    id: 'skills_sh/vercel-optimize',
    name: 'vercel-labs/vercel-optimize',
    shortLabel: 'Vercel Performance Optimizer',
    description: 'Analyze and optimize Core Web Vitals (LCP, INP, CLS), asset bundles, image loading, and edge caching.',
    source: 'skills_sh',
    sourceLabel: 'skills.sh / Vercel',
    category: 'backend',
    author: 'Vercel Labs',
    tags: ['skills_sh', 'vercel', 'performance', 'vitals', 'cache'],
    rawUrl: 'https://github.com/vercel-labs/agent-skills/tree/main/skills/vercel-optimize',
    directive: 'Audit and resolve Core Web Vitals bottlenecks: optimize Largest Contentful Paint, minimize script execution, and leverage edge stale-while-revalidate.',
  },
  {
    id: 'skills_sh/react-view-transitions',
    name: 'vercel-labs/react-view-transitions',
    shortLabel: 'React View Transitions',
    description: 'Smooth page navigation and layout morphing using the native View Transitions API in React and Next.js.',
    source: 'skills_sh',
    sourceLabel: 'skills.sh / Vercel',
    category: 'design',
    author: 'Vercel Labs',
    tags: ['skills_sh', 'vercel', 'view-transitions', 'animations', 'nextjs'],
    rawUrl: 'https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions',
    directive: 'Implement smooth route transitions with document.startViewTransition and semantic transition names.',
  }
];

let liveRegistryCache: SkillItem[] | null = null;
let isFetchingRegistry = false;

export const skillAggregatorService = {
  /**
   * Dynamically fetches, parses, and indexes the entire live open registry (Anthropic, skills.sh, and 1,200+ community skills)
   * seamlessly merged with the Bundled Hardened Skills.
   */
  async fetchLiveOnlineSkills(forceRefresh: boolean = false): Promise<SkillItem[]> {
    if (liveRegistryCache && !forceRefresh) {
      return liveRegistryCache;
    }

    try {
      isFetchingRegistry = true;
      const parsed: SkillItem[] = [
        ...BUNDLED_HARDENED_SKILLS,
        ...ANTHROPIC_OFFICIAL_SKILLS,
        ...SKILLS_SH_OFFICIAL_SKILLS,
      ];

      // Fetch VoltAgent open skills index
      try {
        const response = await fetch('https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md', {
          headers: { 'Accept': 'text/plain' },
        });

        if (response.ok) {
          const text = await response.text();
          const rowRegex = /\|\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+)\/([^)]+))\)\s*\|\s*([^|]+)\|\s*([^|]+)\|/g;
          let match;

          while ((match = rowRegex.exec(text)) !== null) {
            const [, repoName, url, author, rawRepo, rawDescription] = match;
            const authorLower = author.toLowerCase().trim();
            const repo = rawRepo.trim();
            const repoLower = repo.toLowerCase();
            const description = rawDescription.replace(/<[^>]*>/g, '').trim();

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

            const isAnthropic = authorLower === 'anthropics' || authorLower === 'anthropic';
            const isSkillsSh = authorLower === 'vercel-labs' || authorLower === 'skills-sh';
            const isOfficial = OFFICIAL_CREATORS.has(authorLower);

            const source = isAnthropic ? 'anthropic' : isSkillsSh ? 'skills_sh' : isOfficial ? 'official' : 'github';
            const sourceLabel = isAnthropic ? 'Anthropic Official' : isSkillsSh ? 'skills.sh / Vercel' : isOfficial ? `${author} (Verified)` : author;
            const id = `${authorLower}/${repoLower}`;

            if (parsed.some(p => p.id === id || p.name.toLowerCase() === `${authorLower}/${repoLower}`)) continue;

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
              isPopular: isOfficial || isAnthropic || isSkillsSh,
              rawUrl: url,
              directive: `[ORBIT SKILL INVARIANT: ${repo.toUpperCase()}]: Follow all engineering best practices and architectural constraints from ${url} for ${description.trim()}.`,
            });
          }
        }
      } catch (err) {
        console.warn('VoltAgent skills registry fetch notice:', err);
      }

      liveRegistryCache = parsed;
      return parsed;
    } catch (err) {
      console.warn('Live online registry fetch fallback to bundled & official skills:', err);
      const fallback = [
        ...BUNDLED_HARDENED_SKILLS,
        ...ANTHROPIC_OFFICIAL_SKILLS,
        ...SKILLS_SH_OFFICIAL_SKILLS,
      ];
      liveRegistryCache = fallback;
      return fallback;
    } finally {
      isFetchingRegistry = false;
    }
  },

  /**
   * Search across all online registries (Anthropic, skills.sh, Verified, GitHub) with live GitHub fallback.
   */
  async searchOnlineSkills(
    query: string,
    sourceFilter: 'all' | 'anthropic' | 'skills_sh' | 'official' | 'github' = 'all'
  ): Promise<SkillItem[]> {
    const baseList = await this.fetchLiveOnlineSkills();
    const q = query.toLowerCase().trim();

    let filtered = baseList.filter((s) => {
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'anthropic' && s.source !== 'anthropic') return false;
        if (sourceFilter === 'skills_sh' && s.source !== 'skills_sh' && s.source !== 'vercel') return false;
        if (sourceFilter === 'official' && !s.isPopular && s.source !== 'official' && s.source !== 'anthropic') return false;
        if (sourceFilter === 'github' && s.source !== 'github') return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.shortLabel.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        (s.author && s.author.toLowerCase().includes(q))
      );
    });

    // Dynamic GitHub Search when query produces few results
    if (q.length >= 3 && filtered.length < 5) {
      try {
        const ghResponse = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+topic:agent-skill&per_page=10`,
          { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (ghResponse.ok) {
          const data = await ghResponse.json() as {
            items?: Array<{
              full_name: string;
              name: string;
              owner: { login: string };
              description: string;
              html_url: string;
              topics?: string[];
            }>;
          };
          if (data.items) {
            for (const item of data.items) {
              const id = `gh-${item.full_name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
              if (!filtered.some((f) => f.id === id)) {
                filtered.push({
                  id,
                  name: item.full_name,
                  shortLabel: item.name.replace(/^(agent-skill|skill)-/i, ''),
                  description: item.description || `Agent skill from GitHub ${item.full_name}`,
                  source: 'github',
                  sourceLabel: 'GitHub',
                  category: 'workflow',
                  author: item.owner.login,
                  tags: ['github', 'online-search', ...(item.topics || [])],
                  rawUrl: item.html_url,
                  directive: `Follow engineering conventions and skills from ${item.html_url}.`,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Live GitHub skills search notice:', err);
      }
    }

    return filtered;
  },

  /**
   * Resolves the full SKILL.md content on demand for Anthropic, skills.sh, or GitHub skills.
   */
  async resolveSkillContent(skill: SkillItem): Promise<SkillItem> {
    if (skill.rawContent && skill.rawContent.trim().length > 0) {
      return skill;
    }

    // Direct Anthropic raw URL
    if (skill.source === 'anthropic' || skill.name.startsWith('anthropics/')) {
      const slug = skill.name.replace(/^anthropics\//, '');
      const rawUrl = `https://raw.githubusercontent.com/anthropics/skills/main/skills/${slug}/SKILL.md`;
      try {
        const res = await fetch(rawUrl);
        if (res.ok) {
          const content = await res.text();
          return { ...skill, rawContent: content };
        }
      } catch (e) {
        console.warn(`Failed to resolve Anthropic skill content for ${slug}:`, e);
      }
    }

    // Direct skills.sh / Vercel raw URL
    if (skill.source === 'skills_sh' || skill.source === 'vercel' || skill.name.startsWith('vercel-labs/')) {
      const slug = skill.name.replace(/^vercel-labs\//, '');
      const rawUrl = `https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/${slug}/SKILL.md`;
      try {
        const res = await fetch(rawUrl);
        if (res.ok) {
          const content = await res.text();
          return { ...skill, rawContent: content };
        }
      } catch (e) {
        console.warn(`Failed to resolve skills.sh content for ${slug}:`, e);
      }
    }

    // GitHub repository raw URL fallback
    if (skill.rawUrl && skill.rawUrl.includes('github.com')) {
      try {
        const imported = await this.importSkillFromGitHub(skill.rawUrl);
        return {
          ...skill,
          rawContent: imported.rawContent,
          files: imported.files,
        };
      } catch (e) {
        console.warn(`Failed to resolve GitHub skill content for ${skill.rawUrl}:`, e);
      }
    }

    return skill;
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

export const SkillAggregatorService = skillAggregatorService;
