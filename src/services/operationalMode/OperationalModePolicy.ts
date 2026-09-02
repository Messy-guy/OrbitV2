import { OperationalMode, OperationalCommandEvaluation } from './types';

// Read-only CLI inspection commands allowed in Plan & Audit
const SAFE_READ_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'view',
  'grep', 'ripgrep', 'rg', 'find', 'fd', 'ls', 'dir', 'tree', 'pwd',
  'stat', 'file', 'diff', 'cmp', 'wc', 'strings', 'readelf', 'objdump',
  'which', 'whereis', 'type', 'echo', 'printf', 'env', 'printenv'
]);

// Git read-only inspection commands allowed in Plan & Audit
const SAFE_GIT_SUBCOMMANDS = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'tag', 'ls-files',
  'rev-parse', 'remote', 'describe', 'whatchanged', 'shortlog', 'check-ignore'
]);

// Dangerous mutating Git subcommands forbidden in Plan & Audit
const DANGEROUS_GIT_SUBCOMMANDS = new Set([
  'commit', 'push', 'merge', 'rebase', 'cherry-pick', 'reset', 'revert',
  'clean', 'restore', 'checkout', 'rm', 'mv', 'add', 'apply', 'am', 'stash'
]);

// Mutating filesystem commands forbidden in Plan & Audit
const MUTATING_FS_COMMANDS = new Set([
  'rm', 'unlink', 'rmdir', 'cp', 'mv', 'touch', 'mkdir', 'truncate',
  'chmod', 'chown', 'chgrp', 'sed', 'awk', 'tee', 'patch', 'dd'
]);

export class OperationalCommandPolicy {
  public static evaluateCommand(
    operationalMode: OperationalMode,
    rawCommand: string
  ): OperationalCommandEvaluation {
    const trimmed = rawCommand.trim();
    if (!trimmed) {
      return { allowed: true, category: 'READ', command: rawCommand };
    }

    // In CODE mode, normal operations are allowed
    if (operationalMode === 'code') {
      return { allowed: true, category: 'BUILD', command: rawCommand };
    }

    // Check redirection operators (>, >>, | tee) that mutate files
    if (trimmed.includes('>') || trimmed.includes('| tee') || trimmed.includes('|tee')) {
      return {
        allowed: false,
        category: 'WRITE',
        reason: `Output redirection (file write) is strictly denied in ${operationalMode.toUpperCase()} mode.`,
        command: rawCommand
      };
    }

    // Parse the base command and arguments
    const parts = trimmed.split(/\s+/);
    const baseBinary = parts[0].replace(/^.*\//, '');

    // 1. Git inspection vs mutation evaluation
    if (baseBinary === 'git') {
      const gitSub = parts[1];
      if (!gitSub || SAFE_GIT_SUBCOMMANDS.has(gitSub)) {
        // Special check: 'git branch' with modification flags
        if (gitSub === 'branch' && parts.some(p => p === '-d' || p === '-D' || p === '-m' || p === '-M')) {
          return {
            allowed: false,
            category: 'GIT_MUTATION',
            reason: `Branch modification ('git branch ${parts.slice(2).join(' ')}') is denied in ${operationalMode.toUpperCase()} mode.`,
            command: rawCommand
          };
        }
        return { allowed: true, category: 'GIT_READ', command: rawCommand };
      }

      if (DANGEROUS_GIT_SUBCOMMANDS.has(gitSub)) {
        return {
          allowed: false,
          category: 'GIT_MUTATION',
          reason: `Git mutation ('git ${gitSub}') is strictly forbidden in ${operationalMode.toUpperCase()} mode.`,
          command: rawCommand
        };
      }
    }

    // 2. Safe filesystem reading
    if (SAFE_READ_COMMANDS.has(baseBinary)) {
      return { allowed: true, category: 'READ', command: rawCommand };
    }

    // 3. Mutating filesystem command
    if (MUTATING_FS_COMMANDS.has(baseBinary)) {
      return {
        allowed: false,
        category: 'WRITE',
        reason: `Filesystem mutating command ('${baseBinary}') is strictly forbidden in ${operationalMode.toUpperCase()} mode.`,
        command: rawCommand
      };
    }

    // 4. Test execution in Audit or Plan (Read-only execution verification)
    if (baseBinary === 'npm' && (parts[1] === 'test' || parts[1] === 'run' && parts[2]?.startsWith('test'))) {
      return { allowed: true, category: 'TEST', command: rawCommand };
    }
    if (baseBinary === 'cargo' && (parts[1] === 'test' || parts[1] === 'check')) {
      return { allowed: true, category: 'TEST', command: rawCommand };
    }
    if (baseBinary === 'pytest' || baseBinary === 'vitest' || baseBinary === 'jest') {
      return { allowed: true, category: 'TEST', command: rawCommand };
    }

    // 5. Unknown mutating command policy
    return {
      allowed: false,
      category: 'UNKNOWN_MUTATING',
      reason: `Execution of potentially mutating command ('${baseBinary}') is blocked in ${operationalMode.toUpperCase()} mode to preserve workspace safety.`,
      command: rawCommand
    };
  }
}
