if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  } as any;
}

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { projectHealthService, ProjectHealthService } from '../projectHealth.service';
import { contextService } from '../index';
import { EventStore } from '../evidence/EventStore';
import { EventReplayEngine } from '../evidence/EventReplayEngine';
import { OrbitEvent } from '../../types/events';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runProjectHealthSnapshotTests() {
  console.log('========================================================================');
  console.log(' ORBIT — PROJECT HEALTH SNAPSHOT TEST SUITE');
  console.log('========================================================================\n');

  const orbitRepoPath = process.cwd();

  // -------------------------------------------------------------------------
  // TEST 1: Snapshot Generation for Orbit Repository (Real Workspace)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: OrbitV2 Real Engineering State Snapshot ---');
  const snapshot = await projectHealthService.generateSnapshot({
    projectPath: orbitRepoPath,
    workspaceName: 'OrbitV2',
    projectSlug: 'orbitv2',
  });

  // 1. Schema version
  assert(snapshot.schemaVersion === 1, 'Snapshot schemaVersion is 1');

  // 2. Detected project name & path
  assert(snapshot.projectName === 'orbit-desktop' || snapshot.projectName === 'OrbitV2', `Project name detected: ${snapshot.projectName}`);
  assert(snapshot.projectPath === orbitRepoPath, `Project path matches workspace: ${snapshot.projectPath}`);

  // 3. Detected tech stack
  assert(Array.isArray(snapshot.techStack) && snapshot.techStack.length >= 4, `Tech stack detected with ${snapshot.techStack.length} items`);
  const stackNames = snapshot.techStack.map((t) => t.name);
  assert(stackNames.includes('TypeScript'), 'Tech stack includes TypeScript');
  assert(stackNames.includes('React'), 'Tech stack includes React');
  assert(stackNames.includes('Rust'), 'Tech stack includes Rust');
  assert(snapshot.techStack.every((t) => t.verificationLevel === 'file_verified'), 'Tech stack items have strict verificationLevel');

  // 4. Git Branch & HEAD
  assert(typeof snapshot.gitBranch === 'string' && snapshot.gitBranch.length > 0 && snapshot.gitBranch !== 'none', `Current Git branch detected: ${snapshot.gitBranch}`);
  assert(typeof snapshot.gitHead === 'string' && snapshot.gitHead.length > 0 && snapshot.gitHead !== 'none', `Current Git HEAD detected: ${snapshot.gitHead}`);

  // 5. Git working-tree status
  assert(typeof snapshot.workingTreeStatus.isClean === 'boolean', 'Working tree isClean status detected');
  assert(Array.isArray(snapshot.workingTreeStatus.modifiedFiles), 'Working tree modifiedFiles list present');
  assert(Array.isArray(snapshot.workingTreeStatus.untrackedFiles), 'Working tree untrackedFiles list present');

  // 6. Relevant project directories
  assert(Array.isArray(snapshot.relevantDirectories) && snapshot.relevantDirectories.length > 0, 'Relevant project directories detected');
  assert(snapshot.relevantDirectories.includes('src'), 'Relevant directories include src');
  assert(snapshot.relevantDirectories.includes('src-tauri'), 'Relevant directories include src-tauri');
  assert(snapshot.relevantDirectories.includes('apps'), 'Relevant directories include apps');
  assert(!snapshot.relevantDirectories.includes('node_modules'), 'node_modules is excluded from relevant directories');
  assert(!snapshot.relevantDirectories.includes('.git'), '.git is excluded from relevant directories');

  // 7. Latest known active task
  assert(typeof snapshot.activeTask === 'string' && snapshot.activeTask.length > 0, `Active task detected: ${snapshot.activeTask}`);
  assert(snapshot.activeTask.includes('Project Health Snapshot'), 'Active task reflects current directive');

  // 8. Latest known unresolved issues
  assert(Array.isArray(snapshot.unresolvedIssues), 'Unresolved issues array present');
  assert(snapshot.unresolvedIssues.length > 0, `Unresolved issues detected (${snapshot.unresolvedIssues.length} found)`);
  assert(snapshot.unresolvedIssues.some((i) => i.id === 'ISSUE-042' || i.issue.includes('Monorepo')), 'Unresolved issue ISSUE-042 recovered from project memory');

  // 9. Latest known architectural decisions
  assert(Array.isArray(snapshot.architecturalDecisions), 'Architectural decisions array present');
  assert(snapshot.architecturalDecisions.length > 0, `Architectural decisions detected (${snapshot.architecturalDecisions.length} found)`);
  assert(snapshot.architecturalDecisions.some((d) => d.id === 'DEC-002' || d.decision.includes('Project Health Snapshot')), 'Architectural decision DEC-002 recovered from project memory');

  // 10. Completed work
  assert(Array.isArray(snapshot.completedWork), 'Completed work array present');
  assert(snapshot.completedWork.length > 0, `Completed work detected (${snapshot.completedWork.length} found)`);

  // 11. Verified changed files
  assert(Array.isArray(snapshot.verifiedChangedFiles), 'Verified changed files array present');
  assert(snapshot.verifiedChangedFiles.length > 0, `Verified changed files detected (${snapshot.verifiedChangedFiles.length} found)`);
  assert(
    snapshot.verifiedChangedFiles.every(
      (f) =>
        f.verificationLevel === 'file_verified' ||
        f.verificationLevel === 'git_verified' ||
        f.verificationLevel === 'behavior_verified'
    ),
    'All verified changed files have verified provenance'
  );

  // -------------------------------------------------------------------------
  // TEST 2: Deterministic In-Memory Event Replay
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Deterministic In-Memory Replay Consistency ---');
  const syntheticSlug = `test_proj_${Date.now()}`;
  const syntheticEvents: OrbitEvent[] = [
    {
      eventId: 'evt_scan_syn',
      type: 'repository.scanned',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now(),
      payload: {
        name: 'Synthetic Project',
        slug: syntheticSlug,
        path: '/tmp/synthetic',
        techStack: [
          { name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' },
        ],
        architecture: 'Modular Service Mesh',
        rootFingerprint: 'syn_fp_1',
        lastScanned: Date.now(),
      },
      provenance: {
        sourceType: 'repository',
        sourceId: 'package.json',
        timestamp: Date.now(),
        confidence: 'verified',
        verificationLevel: 'file_verified',
      },
    },
    {
      eventId: 'evt_dir_syn',
      type: 'user.directive',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now() + 1,
      payload: {
        directive: 'Build distributed caching layer',
      },
      provenance: {
        sourceType: 'user_statement',
        sourceId: 'user_directive',
        timestamp: Date.now() + 1,
        confidence: 'verified',
        verificationLevel: 'observed',
      },
    },
    {
      eventId: 'evt_dec_syn',
      type: 'agent.claimed_decision',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now() + 2,
      payload: {
        id: 'DEC-SYN-1',
        decision: 'Use Redis for distributed caching',
        rationale: 'Sub-millisecond latency requirement',
        status: 'active',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'claude',
        timestamp: Date.now() + 2,
        confidence: 'verified',
        verificationLevel: 'observed',
      },
    },
    {
      eventId: 'evt_iss_syn',
      type: 'agent.claimed_issue',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now() + 3,
      payload: {
        id: 'ISS-SYN-1',
        issue: 'Redis cluster failover reconnection race',
        status: 'open',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'claude',
        timestamp: Date.now() + 3,
        confidence: 'verified',
        verificationLevel: 'observed',
      },
    },
    {
      eventId: 'evt_act_syn',
      type: 'agent.activity',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now() + 4,
      payload: {
        completed: 'Configured Redis cluster connection topology',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'claude',
        timestamp: Date.now() + 4,
        confidence: 'verified',
        verificationLevel: 'observed',
      },
    },
    {
      eventId: 'evt_file_syn_verified',
      type: 'agent.claimed_file_change',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now() + 5,
      payload: {
        path: 'src/services/cache.service.ts',
        status: 'added',
      },
      provenance: {
        sourceType: 'repository',
        sourceId: 'git',
        timestamp: Date.now() + 5,
        confidence: 'verified',
        verificationLevel: 'file_verified',
      },
    },
    {
      eventId: 'evt_file_syn_phantom',
      type: 'agent.claimed_file_change',
      projectId: syntheticSlug,
      sessionId: 'test_session',
      timestamp: Date.now() + 6,
      payload: {
        path: 'src/phantom/unverified.ts',
        status: 'added',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'claude',
        timestamp: Date.now() + 6,
        confidence: 'inferred',
        verificationLevel: 'claimed',
      },
    },
  ];

  const synSnapshot1 = await projectHealthService.generateSnapshot({
    projectPath: '/tmp/synthetic',
    workspaceName: 'Synthetic Project',
    projectSlug: syntheticSlug,
    events: syntheticEvents,
  });

  const synSnapshot2 = await projectHealthService.generateSnapshot({
    projectPath: '/tmp/synthetic',
    workspaceName: 'Synthetic Project',
    projectSlug: syntheticSlug,
    events: syntheticEvents,
  });

  assert(synSnapshot1.projectName === synSnapshot2.projectName, 'Project names match across runs');
  assert(synSnapshot1.activeTask === synSnapshot2.activeTask, 'Active tasks match across runs');
  assert(synSnapshot1.architecturalDecisions.length === synSnapshot2.architecturalDecisions.length, 'Decisions match deterministically');
  assert(synSnapshot1.unresolvedIssues.length === synSnapshot2.unresolvedIssues.length, 'Issues match deterministically');
  assert(synSnapshot1.completedWork.length === synSnapshot2.completedWork.length, 'Completed work matches deterministically');
  assert(synSnapshot1.verifiedChangedFiles.length === synSnapshot2.verifiedChangedFiles.length, 'Verified changed files match deterministically');
  assert(synSnapshot1.completedWork.includes('Configured Redis cluster connection topology'), 'Recovered completed milestone from agent.activity event');

  // -------------------------------------------------------------------------
  // TEST 3: ContextService Delegation Parity
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: ContextService Delegation Parity ---');
  const delegatedSnapshot = await contextService.getProjectHealthSnapshot(orbitRepoPath, 'orbitv2');
  assert(delegatedSnapshot.schemaVersion === 1, 'Delegated snapshot schemaVersion is 1');
  assert(delegatedSnapshot.projectName === snapshot.projectName, 'Delegated snapshot matches projectHealthService directly');
  assert(delegatedSnapshot.completedWork.length === snapshot.completedWork.length, 'Delegated completed work matches');
  assert(delegatedSnapshot.verifiedChangedFiles.length === snapshot.verifiedChangedFiles.length, 'Delegated verified changed files match');

  // -------------------------------------------------------------------------
  // TEST 4: Authoritative Event Projection vs Legacy Source Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Authoritative Event Projection vs Legacy Source Isolation ---');
  const emptyOrbitTmp = path.join(os.tmpdir(), `orbit_isolated_${Date.now()}`);
  fs.mkdirSync(path.join(emptyOrbitTmp, '.orbit'), { recursive: true });
  const isolatedSnapshot = await projectHealthService.generateSnapshot({
    projectPath: emptyOrbitTmp,
    projectSlug: syntheticSlug,
    events: syntheticEvents,
  });
  assert(isolatedSnapshot.architecturalDecisions.length === 1, 'Recovered decision from EventStore even when local .orbit/DECISIONS.md is absent');
  assert(isolatedSnapshot.unresolvedIssues.length === 1, 'Recovered unresolved issue from EventStore even when local .orbit/BUGS.md is absent');
  fs.rmSync(emptyOrbitTmp, { recursive: true, force: true });

  // -------------------------------------------------------------------------
  // TEST 5: Rejection of Phantom Files in ProjectHealthSnapshot
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Rejection of Phantom File Changes ---');
  const verifiedPaths = synSnapshot1.verifiedChangedFiles.map((f) => f.path);
  assert(verifiedPaths.includes('src/services/cache.service.ts'), 'File-verified change included in snapshot');
  assert(!verifiedPaths.includes('src/phantom/unverified.ts'), 'Unverified phantom file excluded from verifiedChangedFiles');

  // -------------------------------------------------------------------------
  // TEST 6: Dual-Layer Reconciliation of Working-Tree Modifications
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Dual-Layer Working-Tree Reconciliation ---');
  const reconTmpDir = path.join(os.tmpdir(), `orbit_recon_${Date.now()}`);
  fs.mkdirSync(path.join(reconTmpDir, 'src'), { recursive: true });
  const realModifiedFile = path.join(reconTmpDir, 'src', 'real.ts');
  fs.writeFileSync(realModifiedFile, 'export const x = 1;');

  const reconSnapshot = await projectHealthService.generateSnapshot({
    projectPath: reconTmpDir,
    projectSlug: `recon_${Date.now()}`,
    events: syntheticEvents,
    gitState: {
      currentBranch: 'feature/recon',
      headCommit: 'c0ffee1',
      modifiedFiles: [{ path: 'src/real.ts', status: 'modified', staged: false, unstaged: true, isUntracked: false }],
      stagedFiles: [],
      unstagedFiles: [{ path: 'src/real.ts', status: 'modified', staged: false, unstaged: true, isUntracked: false }],
      untrackedFiles: [{ path: 'src/phantom.ts', status: 'untracked', staged: false, unstaged: false, isUntracked: true }],
      recentCommits: ['Initial commit'],
    },
  });

  const reconPaths = reconSnapshot.verifiedChangedFiles.map((f) => f.path);
  assert(reconPaths.includes('src/real.ts'), 'Real modified file on disk reconciled into verifiedChangedFiles as git_verified');
  assert(!reconPaths.includes('src/phantom.ts'), 'Phantom untracked file not existing on disk is excluded from verifiedChangedFiles');
  fs.rmSync(reconTmpDir, { recursive: true, force: true });

  console.log('\n========================================================================');
  console.log(' 🎉 ALL PROJECT HEALTH SNAPSHOT TESTS PASSED CLEANLY');
  console.log('========================================================================\n');
}

runProjectHealthSnapshotTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

