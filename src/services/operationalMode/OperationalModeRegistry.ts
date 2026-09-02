import { OperationalMode, OperationalRole, OperationalModeProfile, NativeOperationalModeSupport, EnforcementStrategy } from './types';

export const OPERATIONAL_MODE_PROFILES: Record<OperationalMode, OperationalModeProfile> = {
  plan: {
    mode: 'plan',
    role: 'architect',
    badge: 'SPEC',
    label: 'Plan (Architect)',
    description: 'Strict specification & architecture planning mode. File modifications, deletions, and git commits are strictly forbidden.',
    writePolicy: 'DENIED',
    deletePolicy: 'DENIED',
    commitPolicy: 'DENIED',
    expectedOutputFormat: 'Goal, Requirements, Architecture, Implementation Steps, Files Affected, Failing Test Contracts, Risks',
    bootstrapContract: `[ORBIT OPERATIONAL MODE: PLAN (SPEC)]
ROLE: SYSTEM ARCHITECT
WRITE_POLICY: DENIED
DELETE_POLICY: DENIED
COMMIT_POLICY: DENIED
INVARIANT: You must ONLY inspect code, reason about architecture, and produce structured implementation specifications. You are STRICTLY FORBIDDEN from creating or modifying source code, deleting files, or committing git changes in this mode.`
  },
  code: {
    mode: 'code',
    role: 'implementer',
    badge: 'TDD',
    label: 'Code (TDD Implementer)',
    description: 'TDD implementation mode. Authorized to create and modify source files, run builds, and execute tests.',
    writePolicy: 'ALLOWED',
    deletePolicy: 'ALLOWED',
    commitPolicy: 'ALLOWED',
    expectedOutputFormat: 'Implementation Summary, Changed Files, Passing Tests, Verification Status',
    bootstrapContract: `[ORBIT OPERATIONAL MODE: CODE (TDD)]
ROLE: TDD IMPLEMENTER
WRITE_POLICY: ALLOWED
DELETE_POLICY: ALLOWED
COMMIT_POLICY: ALLOWED
INVARIANT: Implement minimal, high-quality, type-safe solutions fulfilling specifications and turning test suites green.`
  },
  audit: {
    mode: 'audit',
    role: 'reviewer',
    badge: 'AST',
    label: 'Audit (Code Reviewer)',
    description: 'Static analysis, security auditing & code review mode. Modifying source files or committing changes is strictly forbidden.',
    writePolicy: 'DENIED',
    deletePolicy: 'DENIED',
    commitPolicy: 'DENIED',
    expectedOutputFormat: 'Findings, Severity (Critical/High/Medium/Low), Evidence, Affected Files, Security Impact, Recommended Fixes',
    bootstrapContract: `[ORBIT OPERATIONAL MODE: AUDIT (AST)]
ROLE: CODE REVIEWER & SECURITY AUDITOR
WRITE_POLICY: DENIED
DELETE_POLICY: DENIED
COMMIT_POLICY: DENIED
INVARIANT: You must ONLY review diffs, audit code quality, inspect security risks (OWASP), and report findings. You are STRICTLY FORBIDDEN from modifying source files or committing git changes in this mode.`
  }
};

export const NATIVE_MODE_CAPABILITIES: Record<string, NativeOperationalModeSupport> = {
  antigravity: {
    plan: true,
    code: true,
    audit: false,
    nativePlanFlag: ['--mode', 'plan'],
    nativeCodeFlag: ['--mode', 'accept-edits'],
    description: 'Antigravity CLI native --mode flag supported for plan and accept-edits'
  },
  claude: {
    plan: true,
    code: false,
    audit: false,
    nativePlanFlag: ['--permission-mode', 'plan'],
    description: 'Claude Code native --permission-mode plan supported'
  },
  copilot: {
    plan: true,
    code: false,
    audit: false,
    nativePlanFlag: ['--plan'],
    description: 'GitHub Copilot standalone CLI native --plan supported'
  },
  codex: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  opencode: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  kilocode: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  freebuff: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  cline: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  goose: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  kiro: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  qwen: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  mimo: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  muse: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  vibe: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  qoder: { plan: false, code: false, audit: false, description: 'No native mode flags; enforced via Orbit Universal Mode Layer' },
  terminal: { plan: false, code: false, audit: false, description: 'Raw interactive shell; enforced via Orbit Command Policy Engine' }
};

export function resolveEnforcementStrategy(provider: string, mode: OperationalMode): EnforcementStrategy {
  const norm = provider.toLowerCase();
  const cap = NATIVE_MODE_CAPABILITIES[norm];
  if (!cap) return 'universal';

  if (mode === 'plan' && cap.plan) return 'native';
  if (mode === 'code' && cap.code) return 'native';
  if (mode === 'audit' && cap.audit) return 'native';

  return 'universal';
}
