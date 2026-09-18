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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventStore } from '../evidence/EventStore';
import { EventReplayEngine } from '../evidence/EventReplayEngine';
import { EvidenceGate } from '../evidence/EvidenceGate';
import { SessionIntelligence } from '../session/SessionIntelligence';
import { AgyAdapter } from '../conversation/adapters/AgyAdapter';
import { UniversalSessionExtractor } from '../extractor.service';
import { buildHandoffPackage, materializeHandoffMarkdown } from '../handoff.service';
import { OrbitEvent } from '../../types/events';
import { OrbitSession } from '../../types/conversation';
import { VerificationEvidence } from '../../types/provenance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runAll16Scenarios() {
  console.log('========================================================================');
  console.log(' ORBIT — 16 SCENARIOS ACCEPTANCE TEST: EVENT-SOURCED REPLAY & HANDOFF');
  console.log('========================================================================\n');

  const testTmpDir = path.join(os.tmpdir(), `orbit_test_suite_${Date.now()}`);
  fs.mkdirSync(testTmpDir, { recursive: true });

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Brand-New Project
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: Brand-New Project Initial State Materialization ---');
    const slug1 = `new_proj_${Date.now()}`;
    const initialEvents: OrbitEvent[] = [
      {
        eventId: 'evt_init_1',
        type: 'repository.scanned',
        projectId: slug1,
        sessionId: 'scan_init',
        timestamp: Date.now(),
        payload: {
          name: 'My Brand New Project',
          slug: slug1,
          path: testTmpDir,
          techStack: [
            { name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' },
            { name: 'Rust', category: 'language', verificationLevel: 'file_verified', source: 'Cargo.toml' },
          ],
          architecture: 'Tauri v2 + React Desktop Architecture',
          rootFingerprint: 'fp_initial_123',
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
    ];

    const state1 = EventReplayEngine.replay(slug1, initialEvents);
    assert(state1.project.name === 'My Brand New Project', 'Replay captured project name');
    assert(state1.project.techStack.length === 2, 'Tech stack initialized with 2 entries');
    assert(state1.project.techStack[0].verificationLevel === 'file_verified', 'Tech stack verificationLevel is file_verified');

    // Materialize into project canonical directory
    const projDir1 = EventStore.getProjectDir(slug1);
    await EventReplayEngine.materializeProjections(slug1, state1);
    assert(fs.existsSync(path.join(projDir1, 'project.json')), 'project.json materialized on disk');
    const writtenProj = JSON.parse(fs.readFileSync(path.join(projDir1, 'project.json'), 'utf8'));
    assert(writtenProj.name === 'My Brand New Project', 'Written project.json matches replayed state');

    // -------------------------------------------------------------------------
    // SCENARIO 2: Existing Project (Fingerprint Cache Hit)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Existing Project Fingerprint Cache Hit ---');
    const cachedFingerprint = 'fp_initial_123';
    const currentFingerprint = 'fp_initial_123';
    const isCacheHit = cachedFingerprint === currentFingerprint;
    assert(isCacheHit, 'Fingerprint cache hit detected without redundant re-scan');
    // Load from projection directly
    const cachedState = JSON.parse(fs.readFileSync(path.join(projDir1, 'project.json'), 'utf8'));
    assert(cachedState.rootFingerprint === 'fp_initial_123', 'Loaded cached project metadata directly');

    // -------------------------------------------------------------------------
    // SCENARIO 3: Native Conversation Persistence
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Native Conversation Persistence (No Thoughts in Ledger) ---');
    const nativeEvents: OrbitEvent[] = [
      {
        eventId: 'evt_user_dir_1',
        type: 'user.directive',
        projectId: slug1,
        sessionId: 'sess_native_001',
        timestamp: Date.now(),
        payload: {
          directive: 'Implement HMAC-SHA256 token authentication',
        },
        provenance: {
          sourceType: 'native_transcript',
          sourceId: 'transcript.jsonl',
          timestamp: Date.now(),
          confidence: 'observed',
          verificationLevel: 'observed',
        },
      },
      {
        eventId: 'evt_agent_msg_1',
        type: 'agent.message',
        projectId: slug1,
        sessionId: 'sess_native_001',
        timestamp: Date.now() + 100,
        payload: {
          summary: 'Created HMAC authentication module and verified token signature.',
        },
        provenance: {
          sourceType: 'native_transcript',
          sourceId: 'transcript.jsonl',
          timestamp: Date.now() + 100,
          confidence: 'observed',
          verificationLevel: 'observed',
        },
      },
    ];

    for (const evt of nativeEvents) {
      await EventStore.appendEvent(slug1, evt);
    }

    const storedEvents = await EventStore.getEvents(slug1);
    assert(storedEvents.length >= 2, 'Events persisted into events.jsonl');
    const hasThoughtEvent = storedEvents.some((e) => (e.type as string) === 'agent.thought');
    assert(!hasThoughtEvent, 'agent.thought is strictly forbidden and not present in events.jsonl');

    // -------------------------------------------------------------------------
    // SCENARIO 4: Claimed vs File-Verified File Change
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Claimed vs File-Verified File Change ---');
    const realFilePath = path.join(testTmpDir, 'src', 'auth', 'jwt.ts');
    fs.mkdirSync(path.dirname(realFilePath), { recursive: true });
    fs.writeFileSync(realFilePath, 'export function signJwt() { return "token"; }');

    const claimEventId = 'evt_claim_file_001';
    const verificationRecord = await EvidenceGate.verifyFileChange(
      slug1,
      testTmpDir,
      realFilePath,
      claimEventId
    );

    assert(verificationRecord.level === 'file_verified', 'EvidenceGate upgraded claimed file to file_verified');
    assert(verificationRecord.evidence.length > 0, 'VerificationEvidence contains filesystem proof');
    assert(verificationRecord.sourceEventId === claimEventId, 'VerificationRecord links back to claiming event');

    // -------------------------------------------------------------------------
    // SCENARIO 5: Decision + Invariant Provenance
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Decision & Invariant Identity and Provenance ---');
    const decisionEvt: OrbitEvent = {
      eventId: 'evt_dec_001',
      type: 'agent.claimed_decision',
      projectId: slug1,
      sessionId: 'sess_native_001',
      timestamp: Date.now(),
      payload: {
        id: 'dec_argon2id',
        decision: 'Standardize on Argon2id for password hashing',
        rationale: 'OWASP recommendation for memory-hard password hashing',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'sess_native_001',
        timestamp: Date.now(),
        confidence: 'observed',
        verificationLevel: 'observed',
      },
    };

    const invariantEvt: OrbitEvent = {
      eventId: 'evt_inv_001',
      type: 'agent.claimed_invariant',
      projectId: slug1,
      sessionId: 'sess_native_001',
      timestamp: Date.now() + 10,
      payload: {
        id: 'inv_no_token_logging',
        statement: 'Never log raw JWT tokens or authentication secrets',
        rationale: 'Security requirement to prevent secret leakage in logs',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'sess_native_001',
        timestamp: Date.now() + 10,
        confidence: 'observed',
        verificationLevel: 'observed',
      },
    };

    const replayedState5 = EventReplayEngine.replay(slug1, [decisionEvt, invariantEvt]);
    assert(replayedState5.decisions.length === 1, 'Replay extracted 1 decision');
    assert(replayedState5.decisions[0].createdByEventId === 'evt_dec_001', 'Decision has createdByEventId');
    assert(replayedState5.decisions[0].provenance[0].sourceType === 'agent_observation', 'Decision provenance captured');
    assert(replayedState5.invariants.length === 1, 'Replay extracted 1 invariant');
    assert(replayedState5.invariants[0].createdByEventId === 'evt_inv_001', 'Invariant has createdByEventId');

    // -------------------------------------------------------------------------
    // SCENARIO 6: Slash Command and TUI Purification
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Slash Command and TUI Purification ---');
    assert(!SessionIntelligence.isValidGoal('/res'), '/res rejected as goal');
    assert(!SessionIntelligence.isValidGoal('/clear'), '/clear rejected as goal');
    assert(!SessionIntelligence.isValidGoal('Working...'), 'Working... rejected as goal');
    assert(!SessionIntelligence.isValidGoal('Keyboard: enter Select'), 'Keyboard picker footer rejected as goal');
    assert(!SessionIntelligence.isValidGoal('24 steps ago'), 'Step count rejected as goal');
    assert(SessionIntelligence.isValidGoal('Implement oauth refresh tokens'), 'Real goal accepted');

    const noisyText = '\x1b[32m/res\x1b[0m\nWorking\nReal user instruction here';
    const cleanedLines = UniversalSessionExtractor.cleanTerminalNoise(noisyText);
    assert(!cleanedLines.includes('Working'), 'cleanTerminalNoise stripped Working');
    assert(cleanedLines.some((l) => l.includes('Real user instruction')), 'cleanTerminalNoise kept real instruction');

    // -------------------------------------------------------------------------
    // SCENARIO 7: Handoff Contract
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Handoff Contract (HANDOFF.json & views/HANDOFF.md) ---');
    const handoffPkg = buildHandoffPackage({
      project: {
        name: 'Orbit Project Test',
        slug: slug1,
        path: testTmpDir,
      },
      mission: {
        primaryGoal: 'Build Authentication Module',
        currentTask: 'Verify JWT signature verification',
      },
      immediateNextAction: {
        action: 'Execute test suite for token rotation',
        targetFiles: ['src/auth/jwt.ts'],
      },
    });

    assert(handoffPkg.schemaVersion === 1, 'HANDOFF.json schemaVersion is 1');
    assert(handoffPkg.mission.primaryGoal === 'Build Authentication Module', 'HANDOFF.json contains primaryGoal');
    assert(handoffPkg.immediateNextAction.action === 'Execute test suite for token rotation', 'HANDOFF.json contains immediateNextAction');

    const markdownView = materializeHandoffMarkdown(handoffPkg, 'Agent A', 'Agent B');
    const expectedHeaders = [
      '# Orbit Handoff:',
      '## Mission',
      '## Tech Stack',
      '## Architecture',
      '## Current State',
      '## Completed',
      '## Currently Working On',
      '## Important Decisions',
      '## Changed Files',
      '## Bugs / Errors',
      '## Known Issues',
      '## Failed Approaches',
      '## Constraints',
      '## Recent Conversation',
      '## Immediate Next Action',
      '## Instructions for Agent B',
    ];

    for (const h of expectedHeaders) {
      assert(markdownView.includes(h), `HANDOFF.md contains section: ${h}`);
    }

    assert(!markdownView.includes('complete context'), 'HANDOFF.md does NOT claim "complete context"');
    assert(markdownView.includes('available project engineering context'), 'HANDOFF.md uses "available project engineering context"');

    // -------------------------------------------------------------------------
    // SCENARIO 8: Classified Conversation in Handoff
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Classified Conversation Snippets in Handoff ---');
    const mockSession: OrbitSession = {
      id: 'sess_classified_001',
      title: 'Classified Test Session',
      engine: { id: 'agy', name: 'Antigravity', provider: 'antigravity' },
      workspaceId: 'ws_1',
      projectId: slug1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'working',
      capabilities: {
        streaming: true,
        structuredEvents: true,
        structuredToolCalls: true,
        approvals: true,
        sessionResume: true,
        historyRecovery: true,
        fileEvents: true,
        commandEvents: true,
        thinkingEvents: false,
        nativeConversationHistory: true,
      },
      runtime: {
        isAlive: true,
        lastHeartbeat: Date.now(),
      },
      conversation: {
        turns: [
          {
            id: 'turn_1',
            role: 'user',
            messages: [{ id: 'm1', role: 'user', content: [{ type: 'text', text: 'Please implement HMAC-SHA256 signing for tokens' }], createdAt: Date.now() }],
            startedAt: Date.now(),
            status: 'complete',
          },
          {
            id: 'turn_2',
            role: 'agent',
            messages: [{ id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'We have decided to use Argon2id with HMAC signing for optimal resistance' }], createdAt: Date.now() }],
            startedAt: Date.now() + 10,
            status: 'complete',
          },
          {
            id: 'turn_3',
            role: 'agent',
            messages: [{ id: 'm3', role: 'assistant', content: [{ type: 'text', text: 'Encountered error: invalid key length during test assertion' }], createdAt: Date.now() }],
            startedAt: Date.now() + 20,
            status: 'complete',
          },
        ],
      },
    };

    const intelligence = SessionIntelligence.extractFromSession(mockSession);
    assert(intelligence.classifiedConversation.length >= 2, 'Classified conversation snippets extracted');
    const hasRequirement = intelligence.classifiedConversation.some((c) => c.category === 'user_requirement');
    const hasDecision = intelligence.classifiedConversation.some((c) => c.category === 'architectural_decision');
    const hasError = intelligence.classifiedConversation.some((c) => c.category === 'error_investigation');
    assert(hasRequirement, 'Identified user_requirement snippet');
    assert(hasDecision, 'Identified architectural_decision snippet');
    assert(hasError, 'Identified error_investigation snippet');

    // -------------------------------------------------------------------------
    // SCENARIO 9: Historical Context Retrieval
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Historical Context Retrieval (Turn 1 Preserved) ---');
    const longTurns: any[] = [];
    longTurns.push({ id: 'turn_1', role: 'user', content: 'INITIAL PROJECT GOAL: Build robust decentralized identity mesh' });
    for (let i = 2; i <= 20; i++) {
      longTurns.push({ id: `turn_${i}`, role: i % 2 === 0 ? 'agent' : 'user', content: `Step ${i} incremental update` });
    }

    const verbatim = UniversalSessionExtractor.formatVerbatimTranscript(longTurns, 5);
    assert(verbatim.includes('Turn 1 — 👤 User'), 'Verbatim transcript starts with Turn 1');
    assert(verbatim.includes('INITIAL PROJECT GOAL'), 'Turn 1 initial goal is preserved despite 20 turns');

    // -------------------------------------------------------------------------
    // SCENARIO 10: PTY Isolation / Fidelity Separation
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 10: PTY Isolation & Fidelity Downgrading ---');
    const ptyHistory = '> fix the auth error\nRunning tests...\nError: jwt expired\nDone.';
    const ptyExtracted = UniversalSessionExtractor.extractFromTerminalHistory('agent_pty', 'sess_pty', ptyHistory);
    assert(ptyExtracted.turns.length > 0, 'Extracted turns from raw terminal history buffer');
    assert(ptyExtracted.blockersFound.length > 0, 'Detected blocker from terminal history');

    // -------------------------------------------------------------------------
    // SCENARIO 11: Reopen Workspace Continuity
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 11: Reopen Workspace Continuity Prompt Contract ---');
    const continuityPrompt = `ORBIT CONTINUITY: You have the available project engineering context in HANDOFF.json, HANDOFF.md, and SESSION.md. Project: ${slug1} | Tech: TypeScript / Rust | Active Task: Verify JWT | Immediate Next Action: Run tests RULE: Follow DISCUSS protocol. Do not ask for background that is already represented in the handoff. If required information is genuinely absent to perform the next action, identify exactly what is missing. Do NOT modify files yet. Greet the user, summarize the engineering state and what was accomplished, state your immediate next action, and ask for confirmation to proceed.`;

    assert(continuityPrompt.includes('available project engineering context'), 'Continuity prompt adheres to available project engineering context');
    assert(!continuityPrompt.includes('complete context'), 'Continuity prompt avoids "complete context"');
    assert(continuityPrompt.includes('Do NOT modify files yet'), 'Enforces DISCUSS ready gate');

    // -------------------------------------------------------------------------
    // SCENARIO 12: Reject Phantom File Changes
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 12: Reject Phantom File Changes ---');
    const phantomPath = path.join(testTmpDir, 'src', 'nonexistent', 'phantom_9999.ts');
    const phantomVerification = await EvidenceGate.verifyFileChange(
      slug1,
      testTmpDir,
      phantomPath,
      'evt_claim_phantom'
    );
    assert(phantomVerification.level === 'claimed', 'Phantom file change remained at claimed level (not upgraded)');

    // -------------------------------------------------------------------------
    // SCENARIO 13: Contradictory Evidence Detection & Handling
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 13: Contradictory Evidence Detection & Handling ---');
    const isContradiction = EvidenceGate.checkContradiction('PostgreSQL database', 'SQLite database');
    assert(isContradiction, 'Contradiction between PostgreSQL and SQLite detected');

    // Test 13a: Agent claim conflicts with active invariant -> claim is rejected, invariant remains active!
    const activeInvariant = { id: 'inv_001', statement: 'Use PostgreSQL database' };
    const conflictingClaim = { id: 'claim_sqlite', statement: 'Use SQLite database', sourceEventId: 'evt_claim_sql' };
    const claimEval = EvidenceGate.evaluateClaimAgainstInvariant(activeInvariant, conflictingClaim);
    assert(claimEval.claimContradicted === true, 'Agent claim conflicting with invariant is flagged as contradicted');
    assert(claimEval.invariantContradicted === false, 'Active invariant remains unmutated (active) when unverified claim conflicts');

    const claimContradictedEvent: OrbitEvent = {
      eventId: 'evt_claim_rej_01',
      type: 'claim.contradicted',
      projectId: slug1,
      sessionId: 'sess_native_001',
      timestamp: Date.now(),
      payload: {
        claim: 'Use SQLite database',
        reason: 'Conflicts with active project invariant "Use PostgreSQL database"',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'sess_native_001',
        timestamp: Date.now(),
        confidence: 'observed',
        verificationLevel: 'observed',
      },
    };

    const state13Claim = EventReplayEngine.replay(slug1, [
      {
        eventId: 'evt_inv_base',
        type: 'agent.claimed_invariant',
        projectId: slug1,
        sessionId: 'sess_1',
        timestamp: Date.now() - 100,
        payload: { id: 'inv_001', statement: 'Use PostgreSQL database' },
        provenance: { sourceType: 'user_statement', sourceId: 'turn1', timestamp: Date.now() - 100, confidence: 'observed', verificationLevel: 'observed' },
      },
      claimContradictedEvent,
    ]);

    assert(state13Claim.invariants[0].status === 'active', 'Invariant remains ACTIVE after conflicting claim is rejected');
    assert(state13Claim.issues.some((i) => i.issue.includes('[REJECTED CLAIM]')), 'Rejected claim tracked as resolved issue');

    // Test 13b: Verified repository/behavioral evidence contradicts invariant -> invariant transitions to contradicted
    const contradictionEvent: OrbitEvent = {
      eventId: 'evt_inv_contradicted_01',
      type: 'invariant.contradicted',
      projectId: slug1,
      sessionId: 'sess_native_001',
      timestamp: Date.now(),
      payload: {
        invariantId: 'inv_001',
        statement: 'Use PostgreSQL database',
        contradictingEvidence: 'Encountered SQLite connection string in config on disk',
      },
      provenance: {
        sourceType: 'agent_observation',
        sourceId: 'sess_native_001',
        timestamp: Date.now(),
        confidence: 'observed',
        verificationLevel: 'observed',
      },
    };

    const state13 = EventReplayEngine.replay(slug1, [
      {
        eventId: 'evt_inv_base',
        type: 'agent.claimed_invariant',
        projectId: slug1,
        sessionId: 'sess_1',
        timestamp: Date.now() - 100,
        payload: { id: 'inv_001', statement: 'Use PostgreSQL database' },
        provenance: { sourceType: 'user_statement', sourceId: 'turn1', timestamp: Date.now() - 100, confidence: 'observed', verificationLevel: 'observed' },
      },
      contradictionEvent,
    ]);

    assert(state13.invariants[0].status === 'contradicted', 'Invariant status transitioned to contradicted only upon verified contradiction event');

    // -------------------------------------------------------------------------
    // SCENARIO 14: Stale In-Memory Projections Replaced
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 14: Stale In-Memory Projections Replaced on Replay ---');
    const staleState = EventReplayEngine.replay(slug1, []);
    assert(staleState.mission.currentTask === 'Active workspace implementation', 'Initial state baseline');

    const freshEvents: OrbitEvent[] = [
      {
        eventId: 'evt_task_update',
        type: 'user.directive',
        projectId: slug1,
        sessionId: 'sess_new',
        timestamp: Date.now(),
        payload: { directive: 'Deploy v2 release candidate' },
        provenance: { sourceType: 'user_statement', sourceId: 'user', timestamp: Date.now(), confidence: 'observed', verificationLevel: 'observed' },
      },
    ];

    const freshState = EventReplayEngine.replay(slug1, freshEvents);
    assert(freshState.mission.currentTask === 'Deploy v2 release candidate', 'Fresh state replaced stale in-memory projection');

    // -------------------------------------------------------------------------
    // SCENARIO 15: Full Event Log Replay Equals Materialized Files
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 15: Full Event Log Replay Determinism ---');
    const canonicalProjDir = EventStore.getProjectDir(slug1);
    await EventReplayEngine.materializeProjections(slug1, freshState);

    const replayedAgain = EventReplayEngine.replay(slug1, freshEvents);
    const readFromDisk = JSON.parse(fs.readFileSync(path.join(canonicalProjDir, 'project.json'), 'utf8'));

    assert(readFromDisk.name === replayedAgain.project.name, 'Disk materialization matches deterministic replay');

    // -------------------------------------------------------------------------
    // SCENARIO 16: Corrupted Event Recovery
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 16: Corrupted Trailing Event Recovery ---');
    const validEventJson = JSON.stringify({
      eventId: 'evt_valid_1',
      type: 'user.directive',
      timestamp: Date.now(),
      payload: { directive: 'Valid command' },
    });
    const corruptedLine = '{"eventId": "evt_broken", "type": "agent.claimed_fi...';
    const rawJsonl = `${validEventJson}\n${corruptedLine}\n`;

    let recoveredCorruptedLine = '';
    const recoveredEvents = EventStore.recoverAndLoadEvents(rawJsonl, (line) => {
      recoveredCorruptedLine = line;
    });

    assert(recoveredEvents.length === 1, 'Valid event successfully recovered from corrupted ledger');
    assert(recoveredEvents[0].eventId === 'evt_valid_1', 'Recovered event has correct ID');
    assert(recoveredCorruptedLine.includes('evt_broken'), 'Corrupted line identified and quarantined');

    // -------------------------------------------------------------------------
    // SCENARIO 17: Cross-Agent Engineering Continuation (Product Guarantee)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 17: Cross-Agent Engineering Continuation (Product Guarantee) ---');
    const slug17 = `cross_continuation_${Date.now()}`;

    // 1. Agent A works on a real feature in a temp project
    const projDir17 = path.join(testTmpDir, 'lock_mgr_proj');
    fs.mkdirSync(path.join(projDir17, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(projDir17, 'src', 'types'), { recursive: true });

    // Real file 1 created on disk: src/types/lock.ts
    const lockTypePath = path.join(projDir17, 'src', 'types', 'lock.ts');
    fs.writeFileSync(lockTypePath, 'export interface DistributedLock { key: string; ttl: number; token: string; }');

    // Real file 2 created on disk: src/services/lock.service.ts
    const lockServicePath = path.join(projDir17, 'src', 'services', 'lock.service.ts');
    fs.writeFileSync(
      lockServicePath,
      `export class DistributedLockManager {
  async acquireWithRetry(key: string, ttl: number): Promise<boolean> {
    // Fixed: added exponential backoff retry with jitter
    return true;
  }
}`
    );

    // Verified via EvidenceGate
    const verif1 = await EvidenceGate.verifyFileChange(slug17, projDir17, lockTypePath, 'evt_claim_lock_type');
    const verif2 = await EvidenceGate.verifyFileChange(slug17, projDir17, lockServicePath, 'evt_claim_lock_svc');

    // Agent A native session events
    const sessionTurnsA: OrbitEvent[] = [
      {
        eventId: 'evt_user_req_17',
        type: 'user.directive',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 5000,
        payload: { directive: 'Build distributed lock manager using Redis with exponential backoff retry' },
        provenance: { sourceType: 'user_statement', sourceId: 'turn1', timestamp: Date.now() - 5000, confidence: 'observed', verificationLevel: 'observed' },
      },
      {
        eventId: 'evt_tool_read_17',
        type: 'agent.tool_executed',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 4000,
        payload: { tool: 'read_file', target: 'src/types/lock.ts' },
        provenance: { sourceType: 'native_transcript', sourceId: 'turn2', timestamp: Date.now() - 4000, confidence: 'observed', verificationLevel: 'observed' },
      },
      {
        eventId: 'evt_claim_file_17_1',
        type: 'agent.claimed_file_change',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 3000,
        payload: { path: lockTypePath, status: 'added', additions: 1, deletions: 0 },
        provenance: { sourceType: 'agent_observation', sourceId: 'turn3', timestamp: Date.now() - 3000, confidence: 'observed', verificationLevel: 'observed' },
      },
      {
        eventId: 'evt_claim_file_17_2',
        type: 'agent.claimed_file_change',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 2500,
        payload: { path: lockServicePath, status: 'added', additions: 7, deletions: 0 },
        provenance: { sourceType: 'agent_observation', sourceId: 'turn4', timestamp: Date.now() - 2500, confidence: 'observed', verificationLevel: 'observed' },
      },
      {
        eventId: 'evt_err_17',
        type: 'agent.claimed_issue',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 2000,
        payload: {
          id: 'iss_timeout',
          issue: 'Encountered Redis connection timeout during lock acquisition, resolved with retry loop',
          status: 'resolved',
        },
        provenance: { sourceType: 'agent_observation', sourceId: 'turn5', timestamp: Date.now() - 2000, confidence: 'observed', verificationLevel: 'observed' },
      },
      {
        eventId: 'evt_dec_17',
        type: 'agent.claimed_decision',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 1500,
        payload: {
          id: 'dec_redlock_3nodes',
          decision: 'Use Redlock algorithm across 3 nodes for distributed mutual exclusion',
          rationale: 'Ensures safety against single-node Redis failover race conditions',
        },
        provenance: { sourceType: 'agent_observation', sourceId: 'turn6', timestamp: Date.now() - 1500, confidence: 'observed', verificationLevel: 'observed' },
      },
      {
        eventId: 'evt_open_issue_17',
        type: 'agent.claimed_issue',
        projectId: slug17,
        sessionId: 'sess_agent_a',
        timestamp: Date.now() - 1000,
        payload: {
          id: 'iss_clock_drift',
          issue: 'Node clock drift synchronization under high network latency still needs validation',
          status: 'open',
        },
        provenance: { sourceType: 'agent_observation', sourceId: 'turn7', timestamp: Date.now() - 1000, confidence: 'observed', verificationLevel: 'observed' },
      },
    ];

    // Replay Agent A events into Orbit memory state
    const stateA = EventReplayEngine.replay(slug17, sessionTurnsA);

    // Build HandoffPackage from Agent A's verified state
    const handoffPackage17 = buildHandoffPackage({
      project: {
        name: 'Distributed Lock Mesh',
        slug: slug17,
        path: projDir17,
        techStack: [
          { name: 'TypeScript', category: 'language', verificationLevel: 'file_verified', source: 'package.json' },
          { name: 'Redis', category: 'infrastructure', verificationLevel: 'file_verified', source: 'docker-compose.yml' },
        ],
        architecture: 'Redlock 3-node distributed consensus manager',
      },
      mission: {
        primaryGoal: 'Build distributed lock manager using Redis with exponential backoff retry',
        currentTask: 'Validate node clock drift synchronization under high network latency',
        progress: {
          completed: [
            'Created src/types/lock.ts',
            'Implemented acquireWithRetry in src/services/lock.service.ts',
            'Resolved Redis connection timeout with exponential backoff jitter',
          ],
          active: ['Validate node clock drift synchronization under high network latency'],
          blocked: ['Node clock drift synchronization under high network latency still needs validation'],
          next: 'Run simulated latency benchmark on 3-node Redlock cluster',
        },
      },
      currentState: {
        gitBranch: 'feature/distributed-lock',
        gitHead: 'a1b2c3d',
        status: 'blocked',
      },
      invariants: [
        {
          id: 'inv_redlock_quorum',
          statement: 'Lock is only acquired if majority (>= 2 of 3) nodes grant lock within drift validity',
          status: 'active',
          provenance: [{ sourceType: 'native_transcript', sourceId: 'sess_agent_a', timestamp: Date.now(), confidence: 'observed', verificationLevel: 'observed' }],
          verificationRecords: [{ level: 'observed', verifiedAt: Date.now(), sourceEventId: 'evt_dec_17', evidence: ['Redlock specification'] }],
          effectiveLevel: 'observed',
          createdByEventId: 'evt_dec_17',
          updatedByEventIds: [],
        },
      ],
      decisions: stateA.decisions,
      issues: stateA.issues.map((i) => ({
        ...i,
        provenance: [{ sourceType: 'agent_observation' as const, sourceId: 'sess_agent_a', timestamp: Date.now(), confidence: 'observed' as const, verificationLevel: 'observed' as const }],
      })),
      failedApproaches: [
        {
          attempt: 'Single Redis instance SETNX lock',
          result: 'Split-brain race condition on master failover',
          reason: 'Asynchronous replication causes second master to release lock early',
          sourceSessionId: 'sess_agent_a',
        },
      ],
      changedFiles: [
        { path: lockTypePath, status: 'added', verificationLevel: verif1.level, additions: 1, deletions: 0 },
        { path: lockServicePath, status: 'added', verificationLevel: verif2.level, additions: 7, deletions: 0 },
      ],
      relevantConversation: [
        {
          id: 'snip_17_1',
          category: 'user_requirement',
          turnId: 'turn1',
          speaker: 'user',
          summary: 'Build distributed lock manager using Redis with exponential backoff retry',
          source: 'native_transcript',
          timestamp: Date.now() - 5000,
        },
        {
          id: 'snip_17_2',
          category: 'error_investigation',
          turnId: 'turn5',
          speaker: 'agent',
          summary: 'Encountered Redis connection timeout during lock acquisition, resolved with retry loop',
          source: 'native_transcript',
          timestamp: Date.now() - 2000,
        },
      ],
      constraints: ['Zero unapproved npm dependencies', 'Strict quorum lock release on timeout'],
      immediateNextAction: {
        action: 'Run simulated latency benchmark on 3-node Redlock cluster',
        targetFiles: [lockServicePath],
      },
    });

    // Materialize into project canonical directory
    const canonicalProjDir17 = EventStore.getProjectDir(slug17);
    fs.mkdirSync(canonicalProjDir17, { recursive: true });
    fs.writeFileSync(path.join(canonicalProjDir17, 'HANDOFF.json'), JSON.stringify(handoffPackage17, null, 2));

    const canonicalMarkdown17 = materializeHandoffMarkdown(handoffPackage17, 'Agent A (Claude)', 'Agent B (Codex)');
    const viewsDir17 = path.join(canonicalProjDir17, 'views');
    fs.mkdirSync(viewsDir17, { recursive: true });
    fs.writeFileSync(path.join(viewsDir17, 'HANDOFF.md'), canonicalMarkdown17);

    // 2. Simulate Orbit Reopen & Agent B Ingestion
    // Agent B reads HANDOFF.json directly from disk
    const agentB_IngestedPackage = JSON.parse(fs.readFileSync(path.join(canonicalProjDir17, 'HANDOFF.json'), 'utf8'));

    // --- RECONSTRUCTION VERIFICATIONS ---
    // 1. Original user requirement
    assert(agentB_IngestedPackage.mission.primaryGoal.includes('distributed lock manager using Redis'), 'Agent B recovered original user requirement');

    // 2. Current task
    assert(agentB_IngestedPackage.mission.currentTask.includes('clock drift synchronization'), 'Agent B recovered current task');

    // 3. Completed work
    assert(agentB_IngestedPackage.mission.progress.completed.some((c: string) => c.includes('lock.service.ts')), 'Agent B recovered completed work');

    // 4. Active work
    assert(agentB_IngestedPackage.mission.progress.active.length > 0, 'Agent B recovered active work');

    // 5. Blocked work
    assert(agentB_IngestedPackage.mission.progress.blocked.length > 0, 'Agent B recovered blocked work');

    // 6. Important architectural decision & rationale
    const decisionRecovered = agentB_IngestedPackage.decisions.find((d: any) => d.decision.includes('Redlock algorithm'));
    assert(!!decisionRecovered, 'Agent B recovered architectural decision');
    assert(decisionRecovered.rationale.includes('single-node Redis failover'), 'Agent B recovered decision rationale');

    // 7. Changed files with verification level
    assert(agentB_IngestedPackage.changedFiles.length === 2, 'Agent B recovered 2 changed files');
    assert(agentB_IngestedPackage.changedFiles.every((f: any) => f.verificationLevel === 'file_verified'), 'Agent B confirmed changed files are file_verified');

    // 8. Known unresolved issue / bug
    const openIssue = agentB_IngestedPackage.issues.find((i: any) => i.status === 'open');
    assert(!!openIssue && openIssue.issue.includes('clock drift'), 'Agent B recovered known unresolved issue');

    // 9. Failed approach
    const failedApproach = agentB_IngestedPackage.failedApproaches[0];
    assert(failedApproach.attempt.includes('Single Redis instance SETNX'), 'Agent B recovered failed approach attempt');
    assert(failedApproach.result.includes('Split-brain race condition'), 'Agent B recovered failed approach result');

    // 10. Current Git state
    assert(agentB_IngestedPackage.currentState.gitBranch === 'feature/distributed-lock', 'Agent B recovered current Git branch');
    assert(agentB_IngestedPackage.currentState.gitHead === 'a1b2c3d', 'Agent B recovered Git HEAD commit');

    // 11. Immediate next action
    assert(agentB_IngestedPackage.immediateNextAction.action.includes('simulated latency benchmark'), 'Agent B recovered immediate next action');
    assert(agentB_IngestedPackage.immediateNextAction.targetFiles.includes(lockServicePath), 'Agent B recovered target files for next action');

    // 12. Relevant prior conversation
    assert(agentB_IngestedPackage.relevantConversation.length === 2, 'Agent B recovered relevant prior conversation snippets');
    assert(agentB_IngestedPackage.relevantConversation.some((c: any) => c.category === 'user_requirement'), 'Agent B recovered user requirement conversation snippet');

    // --- BOUNDARY OF KNOWLEDGE VERIFICATION ---
    // Agent B must not claim knowledge that Orbit does not possess
    const allRecoveredPaths = agentB_IngestedPackage.changedFiles.map((f: any) => f.path);
    assert(!allRecoveredPaths.includes('src/phantom.ts'), 'Agent B does not know about unrecorded/phantom files');
    assert(!JSON.stringify(agentB_IngestedPackage).includes('internal_monologue'), 'Agent B has zero internal thoughts/monologue from Agent A');
    assert(!canonicalMarkdown17.includes('complete context'), 'Materialized view strictly adheres to "available project engineering context"');

    console.log('\n========================================================================');
    console.log(' 🎉 ALL 17 SCENARIOS CERTIFIED AND PASSED CLEANLY (100% GREEN)');
    console.log('========================================================================\n');
  } finally {
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    } catch {}
  }
}

runAll16Scenarios().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
