import * as fs from 'fs';
import * as path from 'path';
import { Skill } from '../types.js';
import { getOrbitGlobalDir, getProjectOrbitDir } from '../context/memory.js';

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'frontend-design',
    name: 'Frontend Design System',
    category: 'frontend',
    enabled: false,
    description: 'Enforces clean typography, accessible color contrast, responsive grids, and design tokens.',
    rules: [
      'Use semantic HTML and ARIA labels for accessibility',
      'Follow design token variables for colors and spacing',
      'Ensure responsive behavior across mobile, tablet, and desktop'
    ],
    content: `# Frontend Design System Guidelines
- Maintain consistent spacing scale (4px / 8px / 16px / 24px / 32px)
- Use semantic color tokens instead of hardcoded hex values
- Ensure all interactive elements have visible focus indicators
- Implement smooth transitions and micro-interactions where appropriate`
  },
  {
    id: 'vercel-react-best-practices',
    name: 'Vercel React Best Practices',
    category: 'frontend',
    enabled: true,
    description: 'React 18/19 patterns, Server/Client component separation, fast SSR, zero unnecessary re-renders.',
    rules: [
      'Separate server and client component concerns',
      'Keep component state localized; avoid premature global state',
      'Use useMemo / useCallback strictly where profiling proves necessity',
      'Optimize layout shift with explicit image dimensions'
    ],
    content: `# Vercel & React Best Practices
- Keep components small and focused
- Minimize bundle size by using tree-shakeable imports
- Leverage streaming SSR and suspense boundaries where appropriate`
  },
  {
    id: 'security-review',
    name: 'Security & Auth Guardrails',
    category: 'security',
    enabled: true,
    description: '15-dimension security checklist, secret redaction, RBAC enforcement, input sanitization.',
    rules: [
      'Never log credentials, tokens, or private keys',
      'Validate all external inputs at system boundaries',
      'Enforce role-based access control (RBAC) on service layers',
      'Use constant-time comparison for HMAC / signature checks'
    ],
    content: `# Security Checklist
- Ensure environment variables are loaded securely
- Sanitize and validate all JSON payloads
- Prevent SQL injection and race conditions with proper transaction isolation`
  },
  {
    id: 'testing-discipline',
    name: 'Testing & Verification Discipline',
    category: 'testing',
    enabled: true,
    description: 'TDD enforcement, boundary test cases, automated regression checks.',
    rules: [
      'Write reproducible unit tests for core business logic',
      'Verify error paths and failure conditions explicitly',
      'Avoid flaky timing-dependent assertions'
    ],
    content: `# Testing Discipline
- Write deterministic unit tests
- Mock external network calls
- Test edge cases: empty states, boundary values, error responses`
  },
  {
    id: 'architecture-integrity',
    name: 'Architecture & Boundary Integrity',
    category: 'architecture',
    enabled: true,
    description: 'Strict modular separation, anti-complexity limits (80-line functions, DRY, no dead code).',
    rules: [
      'Keep functions under 80 lines; decompose complex routines',
      'Avoid circular dependencies between modules',
      'Enforce explicit interfaces across domain boundaries'
    ],
    content: `# Architecture Integrity
- Single Responsibility Principle for all modules
- Isolate platform-specific logic behind clean abstractions
- Document major architectural decisions in ADR format`
  },
  {
    id: 'tailwind-standards',
    name: 'Tailwind CSS Standards',
    category: 'frontend',
    enabled: false,
    description: 'Consistent Tailwind utility patterns, clsx / tailwind-merge conventions.',
    rules: [
      'Use twMerge / clsx for conditional class merging',
      'Avoid arbitrary inline values (e.g. w-[347px]) where possible'
    ],
    content: `# Tailwind Standards
- Combine utility classes predictably
- Use design system color utilities`
  }
];

export class SkillRegistry {
  private configDir: string;
  private projectDir: string;

  constructor(cwd: string = process.cwd()) {
    this.configDir = path.join(getOrbitGlobalDir(), 'skills');
    this.projectDir = path.join(getProjectOrbitDir(cwd), 'skills');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.projectDir)) {
      fs.mkdirSync(this.projectDir, { recursive: true });
    }
  }

  public listSkills(): Skill[] {
    const stateFile = path.join(this.projectDir, 'skills_state.json');
    let state: Record<string, boolean> = {};
    if (fs.existsSync(stateFile)) {
      try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      } catch {}
    }

    return DEFAULT_SKILLS.map((skill) => ({
      ...skill,
      enabled: state[skill.id] !== undefined ? state[skill.id] : skill.enabled
    }));
  }

  public setSkillEnabled(skillId: string, enabled: boolean): boolean {
    const skills = this.listSkills();
    const target = skills.find((s) => s.id === skillId || s.name.toLowerCase().includes(skillId.toLowerCase()));
    if (!target) return false;

    const stateFile = path.join(this.projectDir, 'skills_state.json');
    let state: Record<string, boolean> = {};
    if (fs.existsSync(stateFile)) {
      try {
        state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      } catch {}
    }

    state[target.id] = enabled;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
    return true;
  }
}
