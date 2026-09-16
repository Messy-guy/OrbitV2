import { conversationStore } from '../conversation/ConversationStore';
import { useAgentStore } from '../../stores/agent.store';
import { UniversalSessionExtractor } from '../extractor.service';
import { SessionDistillerService } from '../distiller.service';
import { handoffService } from '../handoff.service';
import { ProjectContext, GitState, HandoffSelection } from '../../types/orbit';

// Simple lightweight test runner
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runHandoffIntelligenceTests() {
  console.log('=== TEST SUITE: ORBIT HANDOFF INTELLIGENCE & CONVERSATION SYNTHESIS ===\n');

  // --- TEST 1: Extraction from Authoritative Canonical Session Store ---
  console.log('--- TEST 1: Authoritative Canonical Store Extraction ---');
  const sessionId = `test-sess-${Date.now()}`;
  const agentId = 'ag-test-source';

  const session = conversationStore.getOrCreateSession(
    sessionId,
    'proj-orbit',
    'ws-orbit',
    { id: agentId, name: 'Claude Code', provider: 'claude' },
    'Active Task Session'
  );

  // Turn 1: User request
  conversationStore.addUserMessage(sessionId, 'Implement token refresh rotation and sanitize incoming request headers');
  
  // Turn 1: Agent work & tool execution
  conversationStore.completeAgentMessage(
    sessionId,
    'Analyzing authentication requirements. We have decided to use HMAC-SHA256 for token rotation.\nCreated middleware in src/middleware/auth.ts and validated request headers.',
    'Checking existing auth implementations.'
  );

  // Turn 2: User follow-up directive
  conversationStore.addUserMessage(sessionId, 'Also add unit tests and ensure zero race conditions in token store');

  // Turn 2: Agent reply with blocker and resolution
  conversationStore.completeAgentMessage(
    sessionId,
    'Updated src/services/token.service.ts with atomic token swaps.\nEncountered error: race condition detected during concurrent refresh, but fixed by adding mutex lock.\nAll test contracts verified.'
  );

  const extracted = await UniversalSessionExtractor.extractAuthoritativeSession(agentId, sessionId);

  assert(extracted.turns.length === 4, `Extracted all 4 conversation turns (got ${extracted.turns.length})`);
  assert(!!extracted.primaryGoal?.includes('token refresh rotation'), 'Primary goal matches user initial request');
  assert(extracted.recentUserInstructions.length === 2, `Captured both user directives (got ${extracted.recentUserInstructions.length})`);
  assert(extracted.decisionsFormulated.length > 0, 'Extracted architectural decisions');
  assert(extracted.decisionsFormulated.some(d => d.includes('HMAC-SHA256')), 'Identified HMAC-SHA256 decision');
  assert(extracted.blockersFound.length > 0, 'Extracted encountered error/blocker');
  assert(extracted.conversationSynthesis !== undefined, 'Generated ConversationSynthesis object');
  assert(extracted.conversationSynthesis?.workAccomplished.length! > 0, 'Populated work accomplishments');
  assert(!!extracted.conversationSynthesis?.narrativeSummary.includes('Session Objectives'), 'Generated Markdown narrative summary');

  // --- TEST 2: File Diff Analysis & Edit Summarization ---
  console.log('\n--- TEST 2: File Diff Analysis & Edit Summarization ---');
  const sampleDiff = `--- a/src/services/token.service.ts
+++ b/src/services/token.service.ts
@@ -10,6 +10,14 @@ import { crypto } from 'node:crypto';
+export function rotateRefreshToken(oldToken: string): string {
+  // Atomic token rotation logic
+  const newToken = crypto.randomUUID();
+  return newToken;
+}
+
+export const TOKEN_EXPIRY_MS = 3600000;
-const LEGACY_TOKEN_EXPIRY = 1800000;
`;

  const fileSummary = UniversalSessionExtractor.summarizeFileDiff('src/services/token.service.ts', sampleDiff);

  assert(fileSummary.filePath === 'src/services/token.service.ts', 'File path correctly assigned');
  assert(fileSummary.additions === 7, `Correct additions count (expected 7, got ${fileSummary.additions})`);
  assert(fileSummary.deletions === 1, `Correct deletions count (expected 1, got ${fileSummary.deletions})`);
  assert(fileSummary.summary.includes('rotateRefreshToken'), 'Summary identifies modified symbol rotateRefreshToken');
  assert(!!fileSummary.diffSnippet?.includes('rotateRefreshToken'), 'Diff snippet contains code diff');

  // --- TEST 3: Distiller Knapsack Brief with File Summaries ---
  console.log('\n--- TEST 3: SessionDistiller with Rich Trajectory & Diffs ---');
  extracted.fileSummaries = [fileSummary];

  const distilled = SessionDistillerService.distillSession(
    extracted,
    'chat_continue',
    'Claude Code',
    'Antigravity',
    4000
  );

  assert(distilled.fileSummaries?.length === 1, 'Distilled brief includes file summaries');
  assert(distilled.formattedEnvelope.includes('Conversation Summary & Trajectory'), 'Envelope contains conversation trajectory');
  assert(distilled.formattedEnvelope.includes('File Edit Summaries & Diffs'), 'Envelope contains file edit summaries');
  assert(distilled.formattedEnvelope.includes('rotateRefreshToken'), 'Envelope includes diff details');
  assert(distilled.estimatedTokens > 0, `Estimated tokens calculated (${distilled.estimatedTokens})`);

  // --- TEST 4: Full Handoff Preview & HANDOFF.md Generation ---
  console.log('\n--- TEST 4: Full Handoff Preview & HANDOFF.md Manifest ---');
  const context: ProjectContext = {
    id: 'ctx-1',
    workspaceId: 'ws-orbit',
    currentTask: 'Token rotation implementation',
    goal: 'Secure Auth System',
    progress: 80,
    activeWork: 'Adding test contracts',
    decisions: [{ id: 'd1', title: 'HMAC SHA256', timestamp: 'now' }],
    issues: [{ id: 'i1', title: 'None', status: 'open', severity: 'info' }],
    notes: [],
    architecture: 'Modular TypeScript',
    relevantFiles: ['src/services/token.service.ts'],
    updatedAt: Date.now(),
  };

  const gitState: GitState = {
    currentBranch: 'feature/auth-hardening',
    headCommit: 'e89fbc3',
    recentCommits: ['e89fbc3 Initial commit'],
    modifiedFiles: [{ path: 'src/services/token.service.ts', status: 'modified' }],
  };

  const selection: HandoffSelection = {
    includeCurrentTask: true,
    includeProgress: true,
    includeDecisions: true,
    includeKnownIssues: true,
    includeChangedFiles: true,
    includeGitState: true,
    includeRelevantConversation: true,
    includeFullConversation: false,
    requireConfirmation: true,
  };

  const preview = handoffService.generateHandoffPreview(
    context,
    'Claude Code',
    sessionId,
    'Antigravity',
    selection,
    gitState,
    distilled
  );

  assert(preview.previousAgent === 'Claude Code', 'Previous agent preserved');
  assert(preview.fileSummaries?.length === 1, 'Preview contains file edit summaries');
  assert(preview.formattedInstruction?.includes('# ORBIT CONTEXT HANDOFF BRIEF'), 'Contains standard handoff brief header');
  assert(preview.formattedInstruction?.includes('MANDATORY INGESTION PROTOCOL'), 'Contains ingestion protocol');
  assert(preview.formattedInstruction?.includes('Agent Conversation & Work Trajectory'), 'Contains rich conversation narrative');
  assert(preview.formattedInstruction?.includes('Modified Files & Detailed Edit Summaries'), 'Contains file edit summaries section');
  assert(preview.formattedInstruction?.includes('rotateRefreshToken'), 'Contains actual code diffs inside HANDOFF.md');
  assert(preview.formattedInstruction?.includes('feature/auth-hardening'), 'Contains Git state');
  assert(preview.formattedInstruction?.includes('Immediate Next Action'), 'Contains immediate next action');

  // --- TEST 5: Fallback to Desktop Chat Store When Canonical Empty ---
  console.log('\n--- TEST 5: Desktop Chat Store Fallback ---');
  const fallbackSessionId = `chat-fallback-sess-${Date.now()}`;
  useAgentStore.getState().upsertAssistantMessage(fallbackSessionId, {
    id: 'm1',
    sessionId: fallbackSessionId,
    role: 'user',
    content: 'Refactor desktop relay service and test websocket reconnects',
    timestamp: Date.now() - 5000,
  });
  useAgentStore.getState().upsertAssistantMessage(fallbackSessionId, {
    id: 'm2',
    sessionId: fallbackSessionId,
    role: 'agent',
    content: 'Refactored src/services/desktopRelay.service.ts. Decided to add exponential backoff for socket reconnects.',
    timestamp: Date.now(),
  });

  const fallbackExtracted = await UniversalSessionExtractor.extractAuthoritativeSession('ag-fallback', fallbackSessionId);
  assert(fallbackExtracted.turns.length === 2, `Fallback extracted chat messages (got ${fallbackExtracted.turns.length})`);
  assert(!!fallbackExtracted.primaryGoal?.includes('Refactor desktop relay'), 'Primary goal extracted from chat messages');
  assert(fallbackExtracted.filesTouched.includes('src/services/desktopRelay.service.ts'), 'File touched extracted from chat messages');

  console.log('\n=== ALL 5 HANDOFF INTELLIGENCE SUITES PASSED CLEANLY! ===');
}

runHandoffIntelligenceTests().catch((err) => {
  console.error('Test suite failed with error:', err);
  process.exit(1);
});
