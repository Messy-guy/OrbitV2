import { conversationCaptureService } from '../conversation/ConversationCaptureService';
import { conversationStore } from '../conversation/ConversationStore';
import { projectKnowledgeStore } from '../intelligence/ProjectKnowledgeStore';
import { ContextEvolutionEngine } from '../intelligence/ContextEvolutionEngine';
import { IntelligentContextAssembler } from '../intelligence/IntelligentContextAssembler';
import { VerificationPipeline } from '../intelligence/VerificationPipeline';
import { ApprovalGateService } from '../intelligence/ApprovalGateService';
import { HybridHandoffService } from '../handoff.service';
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

async function runGoldenWorkflow() {
  console.log('================================================================');
  console.log(' ORBIT — COMPLETE GOLDEN WORKFLOW E2E VERIFICATION (MILESTONE 19)');
  console.log('================================================================\n');

  const projectId = 'proj_golden_payment_system';

  // 1. User assigns architectural goal
  console.log('Step 1: User assigns task to System Architect (Claude)');
  const sessArchitect = 'sess_arch_1';
  const agentArchitect = 'agent_claude_arch';

  conversationCaptureService.bindSession(
    sessArchitect,
    projectId,
    projectId,
    { id: agentArchitect, name: 'Claude System Architect', provider: 'claude' },
    'Payment System Architecture'
  );

  // 2. Architect formulates decisions & constraints
  console.log('Step 2: Architect emits architectural decisions');
  const archEvents: OrbitEngineEvent[] = [
    {
      type: 'activity_completed',
      category: 'commands',
      summary: 'Decision made: Stripe Payment Intent Architecture with Webhooks',
      detail: {
        id: 'act_arch_1',
        type: 'command',
        description: 'Enforced idempotency keys on all refund mutation routes',
        path: 'src/services/stripe.ts',
      },
      timestamp: Date.now(),
    },
    {
      type: 'activity_completed',
      category: 'commands',
      summary: 'Constraint: Database operations must run inside Prisma transactions',
      detail: {
        id: 'act_arch_2',
        type: 'command',
        description: 'PostgreSQL ACID compliance on wallet debits',
        path: 'src/db/transaction.ts',
      },
      timestamp: Date.now() + 10,
    },
  ];

  for (const evt of archEvents) {
    ContextEvolutionEngine.processEvent(evt, {
      projectId,
      agentId: agentArchitect,
      sessionId: sessArchitect,
      provider: 'claude',
      agentRole: 'architect',
    });
  }

  // 3. Human confirms decisions
  console.log('Step 3: Human reviews & confirms architectural decisions');
  const knowledge = projectKnowledgeStore.getProjectKnowledge(projectId);
  for (const k of knowledge) {
    projectKnowledgeStore.confirmKnowledge(projectId, k.id, 'leo');
  }

  // 4. Human initiates Handoff to Implementer (Codex)
  console.log('Step 4: Human initiates Handoff to Implementer (Codex)');
  const handoffSvc = new HybridHandoffService();
  const handoffPreview = handoffSvc.generateHandoffPreview(
    {
      id: 'ctx-golden',
      workspaceId: projectId,
      currentTask: 'Implement payment refund API and webhook handler',
      goal: 'Payment System Architecture',
      progress: 30,
      activeWork: 'Architecting refund flows',
      decisions: [],
      issues: [],
      notes: [],
      architecture: 'Node.js + PostgreSQL',
      relevantFiles: ['src/services/stripe.ts', 'src/db/transaction.ts'],
      updatedAt: Date.now(),
    },
    'Claude Architect',
    'Payment Architecture Session',
    'Codex Implementer',
    {
      includeCurrentTask: true,
      includeProgress: true,
      includeDecisions: true,
      includeKnownIssues: true,
      includeChangedFiles: true,
      includeGitState: true,
      includeRelevantConversation: true,
      includeFullConversation: false,
      requireConfirmation: true,
    }
  );

  if (!handoffPreview.formattedInstruction.includes('MANDATORY INGESTION PROTOCOL')) {
    throw new Error('Mandatory Ingestion Protocol missing from handoff package');
  }

  // 5. Intelligent Context Assembly for Implementer
  console.log('Step 5: Orbit intelligently assembles context for Implementer');
  const assembled = IntelligentContextAssembler.assembleContext({
    projectId,
    currentTask: 'Implement payment refund API with atomic PostgreSQL transaction',
    agentId: 'agent_codex_coder',
    sessionId: 'sess_code_1',
    role: 'implementer',
    modifiedFiles: ['src/api/refund.ts', 'src/db/transaction.ts'],
    maxTokenBudget: 2000,
  });

  if (assembled.items.length < 2) {
    throw new Error('Intelligent context assembly failed to pack critical decisions');
  }

  // 6. Implementer completes code and requests Gated Approval for sensitive operation
  console.log('Step 6: Implementer requests approval to drop test schema');
  const gateService = new ApprovalGateService();
  const gate = gateService.createGate({
    projectId,
    agentId: 'agent_codex_coder',
    sessionId: 'sess_code_1',
    operationType: 'destructive_file',
    title: 'Migrate & Reset test database',
    description: 'Running atomic migration test',
    operationPayload: { cmd: 'prisma migrate reset --force' },
  });

  gateService.decide(gate.id, 'approved', 'leo');

  // 7. Implementer reports completion -> Verification Pipeline triggers
  console.log('Step 7: Verification Pipeline executes static checks');
  const verifPipeline = new VerificationPipeline();
  const job = await verifPipeline.runVerification({
    projectId,
    agentId: 'agent_codex_coder',
    sessionId: 'sess_code_1',
    trigger: 'session_completed',
  });

  if (job.verdict !== 'PASS') {
    throw new Error(`Verification failed with verdict: ${job.verdict}`);
  }

  console.log('\n================================================================');
  console.log(' 🎯 GOLDEN WORKFLOW E2E VERIFICATION COMPLETED (ALL PASS)');
  console.log('================================================================\n');
}

runGoldenWorkflow().catch((err) => {
  console.error('GOLDEN WORKFLOW FAILED:', err);
  process.exit(1);
});
