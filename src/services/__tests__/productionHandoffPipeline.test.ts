import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import assert from 'assert';
import { handoffService } from '../handoff.service';
import { EventStore, getCanonicalProjectSlug, resolveProjectSlug } from '../evidence/EventStore';
import { EventReplayEngine } from '../evidence/EventReplayEngine';
import { conversationStore } from '../conversation/ConversationStore';
import { conversationCaptureService } from '../conversation/ConversationCaptureService';
import { ContextPackage, HandoffSelection } from '../../types/orbit';

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir() || '.';
const TEST_SLUG = 'orbit-prod-test';
const TEST_WS_ID = 'ws-audit-999';

async function runProductionAuditSuite() {
  console.log('========================================================================');
  console.log(' ORBIT — PRODUCTION INTEGRATION TEST SUITE (REAL CALL PATHS)');
  console.log('========================================================================\n');

  const testCanonicalDir = EventStore.getProjectDir(TEST_SLUG);
  const testWrongDir = EventStore.getProjectDir(TEST_WS_ID);
  const tempProjDir = path.join(os.tmpdir(), `orbit_prod_test_repo_${Date.now()}`);

  // Setup test sandbox directories
  fs.rmSync(testCanonicalDir, { recursive: true, force: true });
  fs.rmSync(testWrongDir, { recursive: true, force: true });
  fs.rmSync(tempProjDir, { recursive: true, force: true });

  fs.mkdirSync(tempProjDir, { recursive: true });
  fs.mkdirSync(testCanonicalDir, { recursive: true });

  const selection: HandoffSelection = {
    includeCurrentTask: true,
    includeProgress: true,
    includeDecisions: true,
    includeKnownIssues: true,
    includeChangedFiles: true,
    includeGitState: true,
    includeRelevantConversation: true,
    includeFullConversation: false,
    requireConfirmation: false,
  };

  // -------------------------------------------------------------------------
  // TEST CASE E: Event Ledger Path (workspaceId !== projectSlug)
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE E: Event Ledger Path (workspaceId !== projectSlug) ---');
  assert.notStrictEqual(TEST_WS_ID, TEST_SLUG, 'workspaceId is distinct from projectSlug');

  // Verify slug resolution
  const resolvedSlug = getCanonicalProjectSlug(TEST_SLUG, tempProjDir);
  assert.strictEqual(resolvedSlug, TEST_SLUG, 'Canonical slug matches expected slug');

  // Start session via conversationCaptureService using production session-binding path
  const sessA = `sess_agent_a_${Date.now()}`;
  conversationCaptureService.bindSession(
    sessA,
    resolvedSlug,
    TEST_WS_ID,
    { id: 'agent_a', name: 'Agent Alpha', provider: 'kilocode' },
    'Agent A Audit Session'
  );

  // User interacts with Agent A through ConversationStore
  conversationStore.addUserMessage(sessA, 'Implement JWT refresh rotation and verify token invariants');
  conversationStore.completeAgentMessage(sessA, 'Completed JWT refresh tokens with atomic Redis rotation');

  // Allow async write to complete
  await new Promise((r) => setTimeout(r, 150));

  // Assert events.jsonl was written to ~/.orbit/projects/orbit-prod-test/events.jsonl
  const canonicalEventsFile = path.join(testCanonicalDir, 'events.jsonl');
  const wrongEventsFile = path.join(testWrongDir, 'events.jsonl');

  assert(fs.existsSync(canonicalEventsFile), `Authoritative events.jsonl exists at ${canonicalEventsFile}`);
  assert(!fs.existsSync(wrongEventsFile), `Wrong ledger at ${wrongEventsFile} was NOT created`);
  console.log('  ✓ Verified ~/.orbit/projects/orbit-prod-test/events.jsonl is authoritative');
  console.log('  ✓ Verified ~/.orbit/projects/ws-audit-999/events.jsonl does NOT exist\n');

  // -------------------------------------------------------------------------
  // TEST CASE B: Real File Change
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE B: Real File Change Verification ---');
  const realRelativePath = path.join('src', 'auth', 'jwtService.ts');
  const realAbsolutePath = path.join(tempProjDir, realRelativePath);
  fs.mkdirSync(path.dirname(realAbsolutePath), { recursive: true });
  fs.writeFileSync(realAbsolutePath, 'export class JwtService { sign() { return "token"; } }', 'utf8');

  // -------------------------------------------------------------------------
  // TEST CASE A: Phantom File (Does not exist on disk or git)
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE A: Phantom File Rejection ---');
  const phantomRelativePath = path.join('src', 'phantom.ts');
  // Explicitly ensure phantom file does NOT exist
  assert(!fs.existsSync(path.join(tempProjDir, phantomRelativePath)), 'Phantom file does not exist on disk');

  // -------------------------------------------------------------------------
  // TEST CASE C: Decision Replay & Superseding Lineage
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE C: Decision Replay & Superseding Lineage ---');
  const decAId = `dec_init_${Date.now()}`;
  const decBId = `dec_super_${Date.now()}`;

  await EventStore.appendEvent(TEST_SLUG, {
    eventId: `evt_dec_a_${Date.now()}`,
    type: 'agent.claimed_decision',
    projectId: TEST_SLUG,
    sessionId: sessA,
    timestamp: Date.now() - 2000,
    payload: {
      id: decAId,
      decision: 'Store refresh tokens in local memory cache',
      status: 'active',
      rationale: 'Initial quick prototyping phase',
    },
    provenance: {
      sourceType: 'agent_observation',
      sourceId: sessA,
      timestamp: Date.now() - 2000,
      confidence: 'observed',
      verificationLevel: 'observed',
    },
  });

  // Decision B supersedes Decision A with verified backing
  await EventStore.appendEvent(TEST_SLUG, {
    eventId: `evt_dec_b_${Date.now()}`,
    type: 'decision.superseded',
    projectId: TEST_SLUG,
    sessionId: sessA,
    timestamp: Date.now() - 1000,
    payload: {
      id: decBId,
      supersededId: decAId,
      decision: 'Store refresh tokens in Redis cluster with Redlock lease',
      rationale: 'Prevent race conditions across multiple node worker instances',
      effectiveLevel: 'behavior_verified',
    },
    provenance: {
      sourceType: 'test_runner',
      sourceId: sessA,
      timestamp: Date.now() - 1000,
      confidence: 'verified',
      verificationLevel: 'behavior_verified',
      evidence: ['Redis cluster test assertions passed with 0 drift'],
    },
  });

  // -------------------------------------------------------------------------
  // TEST CASE D: Invariant Claim Contradiction
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE D: Invariant Claim Contradiction Preserves Invariant ---');
  // Seed an active invariant
  await EventStore.appendEvent(TEST_SLUG, {
    eventId: `evt_inv_pg_${Date.now()}`,
    type: 'memory.invariant_added',
    projectId: TEST_SLUG,
    sessionId: sessA,
    timestamp: Date.now() - 3000,
    payload: {
      id: 'inv_postgres_storage',
      statement: 'Use PostgreSQL as the primary database.',
      rationale: 'Strict ACID relational transactions required for audit log',
      effectiveLevel: 'file_verified',
    },
    provenance: {
      sourceType: 'repository',
      sourceId: 'knexfile.ts',
      timestamp: Date.now() - 3000,
      confidence: 'verified',
      verificationLevel: 'file_verified',
    },
  });

  // =========================================================================
  // EXECUTE REAL PRODUCTION HANDOFF (Invoking the real production entry point)
  // =========================================================================
  console.log('--- INVOKING REAL PRODUCTION HANDOFF PIPELINE ---');

  const contextPackageInput: ContextPackage = {
    schemaVersion: 1,
    sourceAgent: 'Agent Alpha',
    sourceSessionId: sessA,
    targetAgent: 'Agent Beta',
    workspaceId: TEST_WS_ID,
    workspaceName: TEST_SLUG,
    projectPath: tempProjDir,
    currentTask: 'Implement secure JWT rotation with Redis lease',
    progress: 'Active token tests running',
    decisions: [
      'Store refresh tokens in Redis cluster with Redlock lease',
      'Switch the project to SQLite database.', // <--- Unverified agent claim conflicting with invariant
    ],
    changedFiles: [
      { path: realRelativePath, status: 'modified' },
      { path: phantomRelativePath, status: 'modified' }, // <--- Phantom candidate
    ],
    knownIssues: ['Clock drift in token expiry check'],
    generatedAt: Date.now(),
    estimatedTokens: 500,
  };

  const previewSummaryInput = {
    task: 'Implement secure JWT rotation with Redis lease',
    progress: '90%',
    currentIssue: 'Clock drift in token expiry check',
    relevantFiles: [realRelativePath, phantomRelativePath],
    decisions: [
      'Store refresh tokens in Redis cluster with Redlock lease',
      'Switch the project to SQLite database.',
    ],
    fileSummaries: [
      { filePath: realRelativePath, status: 'modified', additions: 1, deletions: 0, summary: 'Real file' },
      { filePath: phantomRelativePath, status: 'modified', additions: 10, deletions: 0, summary: 'Phantom file' },
    ],
    previousAgent: 'Agent Alpha',
    nextStep: 'Finalize integration tests and verify JWT expiry assertions.',
    formattedInstruction: '',
  };

  // Call the exact production handoff execution function
  const handoffResult = await handoffService.executeHandoff(
    TEST_WS_ID,
    'agent_a',
    'Agent Alpha',
    sessA,
    'agent_b',
    'Agent Beta',
    'antigravity',
    `sess_agent_b_${Date.now()}`,
    selection,
    previewSummaryInput,
    contextPackageInput
  );

  assert(handoffResult.handoffRecord, 'Production handoff returned valid handoffRecord');
  console.log('  ✓ Real production executeHandoff pipeline executed successfully\n');

  // -------------------------------------------------------------------------
  // VALIDATE TEST CASE A: Phantom file NOT verified in changes.json or HANDOFF
  // -------------------------------------------------------------------------
  const changesJsonPath = path.join(testCanonicalDir, 'changes.json');
  assert(fs.existsSync(changesJsonPath), 'changes.json was materialized on disk');
  const changesData = JSON.parse(fs.readFileSync(changesJsonPath, 'utf8'));

  const phantomInChanges = changesData.find((c: any) => c.path === phantomRelativePath);
  if (phantomInChanges) {
    assert.notStrictEqual(
      phantomInChanges.verificationLevel,
      'file_verified',
      'Phantom file MUST NOT be marked file_verified in changes.json'
    );
    assert.strictEqual(
      phantomInChanges.verificationLevel,
      'claimed',
      'Phantom file remains unverified (claimed)'
    );
  }

  const pkgChangedFiles = handoffResult.handoffRecord.contextPackage.changedFiles;
  const phantomInPkg = pkgChangedFiles.find((f: any) => f.path === phantomRelativePath);
  assert(!phantomInPkg, 'Phantom file is excluded from verified changedFiles in contextPackage');
  console.log('  ✓ TEST CASE A PASSED: Phantom file was rejected and NOT file_verified\n');

  // -------------------------------------------------------------------------
  // VALIDATE TEST CASE B: Real file change IS file_verified
  // -------------------------------------------------------------------------
  const realInChanges = changesData.find((c: any) => c.path === realRelativePath);
  assert(realInChanges, 'Real file is recorded in changes.json');
  assert.strictEqual(realInChanges.verificationLevel, 'file_verified', 'Real file is verified as file_verified');

  const realInPkg = pkgChangedFiles.find((f: any) => f.path === realRelativePath);
  assert(realInPkg, 'Real file is included in verified changedFiles in contextPackage');
  console.log('  ✓ TEST CASE B PASSED: Real file verified via EvidenceGate and present in projections\n');

  // -------------------------------------------------------------------------
  // VALIDATE TEST CASE C: Decision Replay & Superseding Lineage in decisions.json
  // -------------------------------------------------------------------------
  const decisionsJsonPath = path.join(testCanonicalDir, 'decisions.json');
  assert(fs.existsSync(decisionsJsonPath), 'decisions.json was materialized on disk');
  const decisionsData = JSON.parse(fs.readFileSync(decisionsJsonPath, 'utf8'));

  const activeDec = decisionsData.find((d: any) => d.id === decBId);
  const supersededDec = decisionsData.find((d: any) => d.id === decAId);

  assert(activeDec, 'Superseding decision B exists in decisions.json');
  assert.strictEqual(activeDec.status, 'active', 'Decision B is active');
  assert.strictEqual(activeDec.supersedesId, decAId, 'Decision B preserves lineage supersedesId link');

  assert(supersededDec, 'Old decision A is preserved in decisions.json');
  assert.strictEqual(supersededDec.status, 'superseded', 'Decision A status is superseded');
  assert.strictEqual(supersededDec.supersededByEventId, activeDec.createdByEventId, 'Decision A links to superseding event');
  console.log('  ✓ TEST CASE C PASSED: decisions.json deterministically projected with superseding lineage\n');

  // -------------------------------------------------------------------------
  // VALIDATE TEST CASE D: Invariant Claim Contradiction
  // -------------------------------------------------------------------------
  const invariantsJsonPath = path.join(testCanonicalDir, 'invariants.json');
  assert(fs.existsSync(invariantsJsonPath), 'invariants.json was materialized on disk');
  const invariantsData = JSON.parse(fs.readFileSync(invariantsJsonPath, 'utf8'));

  const pgInvariant = invariantsData.find((i: any) => i.id === 'inv_postgres_storage');
  assert(pgInvariant, 'PostgreSQL invariant exists in invariants.json');
  assert.strictEqual(pgInvariant.status, 'active', 'Active invariant remains ACTIVE despite conflicting claim');

  // Verify the conflicting claim was rejected and tracked in issues
  const issuesJsonPath = path.join(testCanonicalDir, 'issues.json');
  assert(fs.existsSync(issuesJsonPath), 'issues.json was materialized on disk');
  const issuesData = JSON.parse(fs.readFileSync(issuesJsonPath, 'utf8'));

  const rejectedClaimIssue = issuesData.find((i: any) => i.issue?.includes('[REJECTED CLAIM]') && i.issue?.includes('SQLite'));
  assert(rejectedClaimIssue, 'Conflicting SQLite claim was recorded as a resolved audit issue');
  console.log('  ✓ TEST CASE D PASSED: Invariant preserved active, conflicting agent claim rejected\n');

  // -------------------------------------------------------------------------
  // VALIDATE TEST CASE F: Replay Recovery (Delete JSONs and reconstruct)
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE F: Deterministic Replay Recovery from events.jsonl ---');
  // Delete materialized JSON projections
  fs.unlinkSync(decisionsJsonPath);
  fs.unlinkSync(issuesJsonPath);
  fs.unlinkSync(changesJsonPath);
  fs.unlinkSync(invariantsJsonPath);

  assert(!fs.existsSync(decisionsJsonPath), 'decisions.json deleted');
  assert(!fs.existsSync(changesJsonPath), 'changes.json deleted');

  // Trigger production replay and materialization
  const replayedEvents = await EventStore.getEvents(TEST_SLUG);
  const reconstructedState = EventReplayEngine.replay(TEST_SLUG, replayedEvents);
  await EventReplayEngine.materializeProjections(TEST_SLUG, reconstructedState);

  // Assert all files were deterministically recovered
  assert(fs.existsSync(decisionsJsonPath), 'decisions.json recovered deterministically');
  assert(fs.existsSync(issuesJsonPath), 'issues.json recovered deterministically');
  assert(fs.existsSync(changesJsonPath), 'changes.json recovered deterministically');
  assert(fs.existsSync(invariantsJsonPath), 'invariants.json recovered deterministically');

  const recoveredDecisions = JSON.parse(fs.readFileSync(decisionsJsonPath, 'utf8'));
  assert.strictEqual(recoveredDecisions.length, decisionsData.length, 'Recovered decisions match original count');
  console.log('  ✓ TEST CASE F PASSED: Projections deleted and deterministically reconstructed from ledger\n');

  // -------------------------------------------------------------------------
  // VALIDATE TEST CASE G: Agent B Continuity Prompt Injection
  // -------------------------------------------------------------------------
  console.log('--- TEST CASE G: Agent B Dynamic Continuity Prompt ---');
  const formattedInstruction = handoffResult.handoffRecord.contextPackage.formattedInstruction || '';
  assert(formattedInstruction.includes('ORBIT CONTINUITY: You have the available project engineering context'), 'Contains DISCUSS continuity banner');
  assert(formattedInstruction.includes(TEST_SLUG), 'Prompt dynamically references project slug');
  assert(formattedInstruction.includes('Store refresh tokens in Redis cluster with Redlock lease'), 'Prompt references verified active decision');
  assert(!formattedInstruction.includes('complete context'), 'Prompt avoids false complete context claim');
  console.log('  ✓ TEST CASE G PASSED: Agent B received verified engineering state without hallucinations\n');

  // -------------------------------------------------------------------------
  // VALIDATE ALL PROJECTION ARTIFACTS ON DISK
  // -------------------------------------------------------------------------
  console.log('--- PROJECTION STORAGE ARTIFACTS AUDIT ---');
  const expectedFiles = [
    'events.jsonl',
    'project.json',
    'decisions.json',
    'issues.json',
    'invariants.json',
    'changes.json',
    'views/SESSION.md',
    'views/DECISIONS.md',
    'views/INVARIANTS.md',
    'views/BUGS.md',
    'views/ROADMAP.md',
    'views/MASTER.md',
  ];

  for (const f of expectedFiles) {
    const fullP = path.join(testCanonicalDir, f);
    assert(fs.existsSync(fullP), `Expected artifact ${f} exists on disk at ${fullP}`);
    console.log(`  ✓ Materialized: ~/.orbit/projects/${TEST_SLUG}/${f}`);
  }

  // Cleanup
  fs.rmSync(testCanonicalDir, { recursive: true, force: true });
  fs.rmSync(tempProjDir, { recursive: true, force: true });

  console.log('\n========================================================================');
  console.log(' 🎉 ALL PRODUCTION PIPELINE INTEGRATION TESTS CERTIFIED (100% GREEN)');
  console.log('========================================================================\n');
}

runProductionAuditSuite().catch((err) => {
  console.error('Production audit suite failed:', err);
  process.exit(1);
});
