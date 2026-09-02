import { OperationalMode } from './types';

export class ModeWorkspacePolicy {
  public static generateRulesFileContent(mode: OperationalMode): string {
    if (mode === 'plan') {
      return `# ORBIT UNIVERSAL WORKSPACE INVARIANT — PLAN MODE (SPEC)
# DO NOT DELETE OR OVERWRITE THIS FILE.
You are running as a SYSTEM ARCHITECT in strict PLAN ONLY mode.
- You are STRICTLY FORBIDDEN from creating, modifying, editing, or deleting source code.
- You must ONLY produce specifications, architecture documents, and test requirements.
- Any write or edit command will be rejected by the Orbit runtime enforcement layer.
`;
    }

    if (mode === 'audit') {
      return `# ORBIT UNIVERSAL WORKSPACE INVARIANT — AUDIT MODE (AST)
# DO NOT DELETE OR OVERWRITE THIS FILE.
You are running as a CODE REVIEWER in strict AUDIT ONLY mode.
- You are STRICTLY FORBIDDEN from modifying source code or committing changes.
- You must ONLY inspect git diffs, review logic, check OWASP security vulnerabilities, and report findings.
- Any file mutation will be rejected by the Orbit runtime enforcement layer.
`;
    }

    // Code mode
    return `# ORBIT UNIVERSAL WORKSPACE INVARIANT — CODE MODE (TDD)
You are running as a TDD IMPLEMENTER.
- You are authorized to create and modify source files and execute test suites.
`;
  }
}
