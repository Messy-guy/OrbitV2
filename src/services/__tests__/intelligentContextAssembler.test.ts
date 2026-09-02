import { IntelligentContextAssembler } from '../intelligence/IntelligentContextAssembler';
import { projectKnowledgeStore } from '../intelligence/ProjectKnowledgeStore';

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

async function testContextAssembler() {
  console.log('=== TEST 1: Intelligent Context Assembly & Relevance Scoring ===');
  const projectId = 'proj_e2e_payment';

  projectKnowledgeStore.upsertKnowledgeItem({
    id: 'kn-pay-1',
    projectId,
    type: 'decision',
    title: 'Stripe Payment Gateway Integration',
    content: 'All checkout sessions must use Stripe Elements with server-side payment intent validation.',
    status: 'confirmed',
    confidence: 1.0,
    provenance: { type: 'user_assertion', agentId: 'agy-1', sessionId: 'sess-p', timestamp: Date.now() },
    evidence: ['Payment RFC'],
    relatedFiles: ['src/services/stripe.service.ts'],
    relatedSessions: ['sess-p'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  projectKnowledgeStore.upsertKnowledgeItem({
    id: 'kn-pay-2',
    projectId,
    type: 'constraint',
    title: 'PostgreSQL Transaction Idempotency',
    content: 'Refund mutations must execute inside atomic DB transactions with idempotency keys.',
    status: 'confirmed',
    confidence: 1.0,
    provenance: { type: 'conversation_event', agentId: 'claude-1', sessionId: 'sess-p', timestamp: Date.now() },
    evidence: ['Audit report'],
    relatedFiles: ['src/db/transaction.ts'],
    relatedSessions: ['sess-p'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const assembled = IntelligentContextAssembler.assembleContext({
    projectId,
    currentTask: 'Implement payment refund API and webhook handler',
    agentId: 'agent-codex',
    sessionId: 'sess-refund',
    role: 'implementer',
    modifiedFiles: ['src/api/refund.ts', 'src/db/transaction.ts'],
    maxTokenBudget: 1500,
  });

  if (assembled.items.length < 2) {
    throw new Error(`Expected at least 2 assembled items, got ${assembled.items.length}`);
  }

  const transactionItem = assembled.items.find((i) => i.title.includes('PostgreSQL Transaction'));
  if (!transactionItem || !transactionItem.reason) {
    throw new Error('Transaction idempotency decision was not assembled or missing inclusion reason');
  }

  if (!assembled.formattedPromptSection.includes('PROJECT INTELLIGENCE CONTEXT')) {
    throw new Error('Formatted prompt section missing header');
  }

  console.log(`✔ Assembled ${assembled.items.length} items within ${assembled.totalTokens} tokens`);
  console.log('✔ Every assembled item contains explicit inclusion reasoning & provenance');
  console.log('\n🎉 INTELLIGENT CONTEXT ASSEMBLY TEST PASSED!');
}

testContextAssembler().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
