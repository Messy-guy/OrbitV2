import { projectKnowledgeStore } from '../intelligence/ProjectKnowledgeStore';
import { ContextEvolutionEngine } from '../intelligence/ContextEvolutionEngine';
import { VerificationPipeline } from '../intelligence/VerificationPipeline';
import { ApprovalGateService } from '../intelligence/ApprovalGateService';
import { OrbitEngineEvent } from '../../types/conversation';

// Mock localStorage for node test execution
const storeMock: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => storeMock[k] || null,
  setItem: (k: string, v: string) => { storeMock[k] = v; },
  removeItem: (k: string) => { delete storeMock[k]; },
  clear: () => { Object.keys(storeMock).forEach((k) => delete storeMock[k]); },
  length: 0,
  key: () => null,
};

async function runProjectIntelligenceTests() {
  console.log('=== TEST 1: Absolute Data-Scoping & Project Isolation (§2, §22) ===');
  const projectA = 'ws-proj-alpha';
  const projectB = 'ws-proj-beta';

  projectKnowledgeStore.upsertKnowledgeItem({
    id: 'kn-alpha-1',
    projectId: projectA,
    type: 'decision',
    title: 'PostgreSQL Database Standard',
    content: 'We use PostgreSQL with Prisma ORM.',
    status: 'confirmed',
    confidence: 1.0,
    provenance: {
      type: 'user_assertion',
      agentId: 'agent-1',
      sessionId: 'sess-1',
      timestamp: Date.now(),
    },
    evidence: ['Architectural RFC #1'],
    relatedFiles: ['prisma/schema.prisma'],
    relatedSessions: ['sess-1'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const knowledgeA = projectKnowledgeStore.getProjectKnowledge(projectA);
  const knowledgeB = projectKnowledgeStore.getProjectKnowledge(projectB);

  if (knowledgeA.length !== 1 || knowledgeA[0].id !== 'kn-alpha-1') {
    throw new Error('Failed to retrieve Project A knowledge');
  }
  if (knowledgeB.length !== 0) {
    throw new Error(`CRITICAL ISOLATION BREACH: Project B returned ${knowledgeB.length} items from Project A!`);
  }
  console.log('✔ Strict project boundary isolation verified');

  console.log('\n=== TEST 2: Incremental Context Evolution & Provenance (§4, §6, §9) ===');
  const activityEvent: OrbitEngineEvent = {
    type: 'activity_completed',
    category: 'commands',
    summary: 'Decision made: Migrated authentication to JWT tokens',
    detail: {
      id: 'act-1',
      type: 'command',
      description: 'Standardized token expiry to 15m and refresh rotation',
      path: 'src/auth/jwt.service.ts',
    },
    timestamp: Date.now(),
  };

  const evolvedItems = ContextEvolutionEngine.processEvent(activityEvent, {
    projectId: projectA,
    agentId: 'agent-claude',
    sessionId: 'sess-auth',
    provider: 'claude',
  });

  if (evolvedItems.length !== 1 || evolvedItems[0].type !== 'decision') {
    throw new Error('Context evolution failed to extract decision candidate');
  }
  const item = evolvedItems[0];
  if (item.provenance.agentId !== 'agent-claude' || item.provenance.sessionId !== 'sess-auth') {
    throw new Error('Provenance attribution mismatch');
  }
  console.log(`✔ Extracted candidate decision with full provenance: ${item.title}`);

  console.log('\n=== TEST 3: Knowledge Conflict Detection & Preservation (§8) ===');
  // First confirm item
  projectKnowledgeStore.confirmKnowledge(projectA, item.id);

  // Now an opposing decision appears from another agent
  const opposingEvent: OrbitEngineEvent = {
    type: 'activity_completed',
    category: 'commands',
    summary: 'Configured authentication using Session Cookie store',
    detail: {
      id: 'act-2',
      type: 'command',
      description: 'Replaced tokens with session cookies',
      path: 'src/auth/session.service.ts',
    },
    timestamp: Date.now() + 1000,
  };

  const opposingItems = ContextEvolutionEngine.processEvent(opposingEvent, {
    projectId: projectA,
    agentId: 'agent-codex',
    sessionId: 'sess-cookie',
    provider: 'codex',
  });

  const updatedKnowledge = projectKnowledgeStore.getProjectKnowledge(projectA);
  const conflictingItems = updatedKnowledge.filter((k) => k.status === 'conflicting');
  if (conflictingItems.length < 2) {
    throw new Error('Knowledge conflict was not detected or preserved');
  }
  console.log('✔ Knowledge conflict detected and preserved without silent overwrite');

  console.log('\n=== TEST 4: Verification Pipeline Lifecycle (§15) ===');
  const verifPipeline = new VerificationPipeline();
  const job = await verifPipeline.runVerification({
    projectId: projectA,
    agentId: 'agent-codex',
    sessionId: 'sess-auth',
    trigger: 'session_completed',
  });

  if (job.verdict !== 'PASS' || job.checks.length < 3) {
    throw new Error('Verification pipeline failed');
  }
  console.log(`✔ Verification job ${job.id} completed with verdict: ${job.verdict}`);

  console.log('\n=== TEST 5: One-Time Auditable Approval Gates (§17) ===');
  const gateService = new ApprovalGateService();
  const gate = gateService.createGate({
    projectId: projectA,
    agentId: 'agent-codex',
    sessionId: 'sess-auth',
    operationType: 'destructive_file',
    title: 'Drop test database tables',
    description: 'Running migration reset',
    operationPayload: { cmd: 'prisma migrate reset --force' },
  });

  if (gate.status !== 'pending') {
    throw new Error('Gate was not created in pending status');
  }

  const resolved = gateService.decide(gate.id, 'approved', 'leo');
  if (resolved.status !== 'approved' || resolved.decidedBy !== 'leo') {
    throw new Error('Gate resolution failed');
  }

  // Double decision attempt MUST fail (one-time use invariant)
  try {
    gateService.decide(gate.id, 'rejected', 'leo');
    throw new Error('Gate allowed duplicate consumption');
  } catch (err: any) {
    if (!err.message.includes('already consumed')) {
      throw err;
    }
  }
  console.log('✔ Approval gate one-time consumption & audit lifecycle passed');

  console.log('\n🎉 ALL 5 PROJECT INTELLIGENCE SUITES VERIFIED AND PASSED END-TO-END!');
}

runProjectIntelligenceTests().catch((e) => {
  console.error('TEST SUITE FAILED:', e);
  process.exit(1);
});
