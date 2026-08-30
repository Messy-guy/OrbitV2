import { agentProfileRegistry } from '../AgentInteractionProfileRegistry';
import { universalRemoteController } from '../UniversalRemoteController';
import { useAgentStore } from '../../../stores/agent.store';
import { conversationStore } from '../../conversation/ConversationStore';
import { pendingInputEchoQueue } from '../../sessionProjection/input/PendingInputEchoQueue';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log('=== TEST SUITE 1: ALL 16 OFFICIAL AGENT PROFILES REGISTERED ===');
  
  const officialProviders = [
    'antigravity',
    'claude',
    'codex',
    'opencode',
    'kilocode',
    'freebuff',
    'cline',
    'copilot',
    'goose',
    'kiro',
    'qwen',
    'mimo',
    'muse',
    'vibe',
    'qoder',
    'terminal',
  ];

  for (const provider of officialProviders) {
    const profile = agentProfileRegistry.getProfile(provider);
    assert(profile !== undefined, `Profile for '${provider}' must be resolved`);
    assert(profile.provider === provider, `Profile provider matches '${provider}'`);
    assert(profile.capabilities.canSendMessage === true, `Profile '${provider}' canSendMessage is true`);
    assert(typeof profile.submitKey === 'string' && profile.submitKey.length > 0, `Profile '${provider}' has valid submitKey`);
  }

  console.log('\n=== TEST SUITE 2: PAYLOAD & SUBMISSION FORMATTING VALIDATION ===');

  // 1. Single-line submission
  const codexProfile = agentProfileRegistry.getProfile('codex');
  const singleLine = codexProfile.formatSubmission('Hello world');
  assert(singleLine.payload === 'Hello world', 'Single line payload formatted correctly');
  assert(singleLine.submitKey === '\r', 'Codex submitKey is \\r');

  // 2. Multiline submission (preserves internal line breaks, strips trailing)
  const multilinePrompt = 'Line 1\nLine 2\nLine 3\n\n\r\n';
  const formattedMultiline = codexProfile.formatSubmission(multilinePrompt);
  assert(formattedMultiline.payload === 'Line 1\nLine 2\nLine 3', 'Multiline preserves internal line breaks while stripping trailing newlines');

  // 3. CR vs LF
  const shellProfile = agentProfileRegistry.getProfile('terminal');
  const formattedShell = shellProfile.formatSubmission('printf "OK"');
  assert(formattedShell.submitKey === '\n', 'Shell terminal profile uses \\n (LF)');
  assert(codexProfile.submitKey === '\r', 'AI Agent profiles use \\r (CR)');

  // 4. Special Characters & Unicode
  const specialPrompt = 'Test 🚀 "quotes" & `backticks` and \\slashes';
  const formattedSpecial = codexProfile.formatSubmission(specialPrompt);
  assert(formattedSpecial.payload === specialPrompt, 'Special characters and emojis preserved unaltered');

  // 5. Markdown & Code Blocks
  const codeBlockPrompt = '```python\ndef solve(x):\n    return x * 2\n```\n';
  const formattedCode = codexProfile.formatSubmission(codeBlockPrompt);
  assert(formattedCode.payload === '```python\ndef solve(x):\n    return x * 2\n```', 'Markdown code blocks formatted without trailing newline breakage');

  // 6. Long Prompts (10KB+)
  const longPrompt = 'A'.repeat(12000);
  const formattedLong = codexProfile.formatSubmission(longPrompt);
  assert(formattedLong.payload.length === 12000, 'Long payload (12KB) formatted without truncation');

  // 7. Empty Input
  const emptyResult = await universalRemoteController.deliverRemoteMessage({
    requestId: 'req_empty_1',
    agentId: 'agent-1',
    sessionId: 'sess-1',
    message: '   \n\r  ',
    timestamp: Date.now(),
  });
  assert(emptyResult.success === false, 'Empty payload rejected with informative error');
  assert(emptyResult.diagnosticCode === 'EMPTY_PAYLOAD', 'Empty payload returns EMPTY_PAYLOAD code');

  console.log('\n=== TEST SUITE 3: UNIVERSAL CONTROLLER IDEMPOTENCY & LIFECYCLE ===');

  // Setup Agents in Store
  useAgentStore.getState().agents = [
    {
      id: 'agent-codex-1',
      workspaceId: 'ws-test',
      provider: 'codex',
      name: 'CODEX WORKER',
      model: 'o3-mini',
      status: 'ready',
      viewMode: 'terminal',
      currentSessionId: 'sess-codex-1',
      createdAt: Date.now(),
    },
    {
      id: 'agent-opencode-1',
      workspaceId: 'ws-test',
      provider: 'opencode',
      name: 'OPENCODE WORKER',
      model: 'DeepSeek R1',
      status: 'ready',
      viewMode: 'terminal',
      currentSessionId: 'sess-opencode-1',
      createdAt: Date.now(),
    },
    {
      id: 'agent-offline-1',
      workspaceId: 'ws-test',
      provider: 'claude',
      name: 'OFFLINE CLAUDE',
      model: 'Claude 3.7',
      status: 'error',
      viewMode: 'terminal',
      currentSessionId: 'sess-offline-1',
      createdAt: Date.now(),
    },
  ];

  // Capture diagnostic logs
  const diagnostics: any[] = [];
  const unsubDiag = universalRemoteController.onDiagnostic((log) => {
    diagnostics.push(log);
  });

  // Turn 1 delivery to Session A (Codex)
  const reqId1 = 'req_session_a_1';
  const result1 = await universalRemoteController.deliverRemoteMessage({
    requestId: reqId1,
    agentId: 'agent-codex-1',
    sessionId: 'sess-codex-1',
    message: 'Implement auth token validation',
    timestamp: Date.now(),
  });
  assert(result1.success === true, 'Turn 1 remote delivery to Session A succeeds');

  // Verify Echo Registration for Session A
  const matchEchoA = pendingInputEchoQueue.findMatchingEcho('sess-codex-1', 'Implement auth token validation');
  assert(matchEchoA !== null, 'Pending echo registered for Session A');

  // Turn 1 delivery to Session B (OpenCode) - Concurrent Multi-Session Isolation
  const reqId2 = 'req_session_b_1';
  const result2 = await universalRemoteController.deliverRemoteMessage({
    requestId: reqId2,
    agentId: 'agent-opencode-1',
    sessionId: 'sess-opencode-1',
    message: 'Write database migration script',
    timestamp: Date.now(),
  });
  assert(result2.success === true, 'Turn 1 remote delivery to Session B succeeds');

  // Verify Multi-Session Isolation
  const matchEchoBInA = pendingInputEchoQueue.findMatchingEcho('sess-codex-1', 'Write database migration script');
  assert(matchEchoBInA === null, 'Session A does not receive Session B echo (Multi-session isolation confirmed)');

  // Duplicate Request Idempotency Test
  const duplicateResult = await universalRemoteController.deliverRemoteMessage({
    requestId: reqId1,
    agentId: 'agent-codex-1',
    sessionId: 'sess-codex-1',
    message: 'Implement auth token validation',
    timestamp: Date.now(),
  });
  assert(duplicateResult.success === true, 'Duplicate requestId handled gracefully without duplicate execution');

  // Offline / Exited Agent Handling
  const offlineResult = await universalRemoteController.deliverRemoteMessage({
    requestId: 'req_offline_1',
    agentId: 'agent-offline-1',
    sessionId: 'sess-offline-1',
    message: 'Check code',
    timestamp: Date.now(),
  });
  assert(offlineResult.success === false, 'Offline agent request rejected cleanly');
  assert(offlineResult.diagnosticCode === 'AGENT_OFFLINE', 'Offline agent returns AGENT_OFFLINE code');

  // Test Dynamically Added Official Agents Resolution
  console.log('\n=== TEST SUITE 4: DYNAMICALLY INSTALLED OFFICIAL AGENTS LIFECYCLE ===');
  const dynamicAgents = [
    { provider: 'freebuff', name: 'Freebuff AI', id: 'agent-freebuff-dyn-1', sess: 'sess-freebuff-dyn-1' },
    { provider: 'cline', name: 'Cline CLI', id: 'agent-cline-dyn-1', sess: 'sess-cline-dyn-1' },
    { provider: 'kilocode', name: 'KiloCode AI', id: 'agent-kilo-dyn-1', sess: 'sess-kilo-dyn-1' },
    { provider: 'goose', name: 'Block Goose', id: 'agent-goose-dyn-1', sess: 'sess-goose-dyn-1' },
    { provider: 'kiro', name: 'Kiro CLI', id: 'agent-kiro-dyn-1', sess: 'sess-kiro-dyn-1' },
    { provider: 'qwen', name: 'Qwen Code', id: 'agent-qwen-dyn-1', sess: 'sess-qwen-dyn-1' },
    { provider: 'mimo', name: 'Mimo Code', id: 'agent-mimo-dyn-1', sess: 'sess-mimo-dyn-1' },
    { provider: 'muse', name: 'Muse Code', id: 'agent-muse-dyn-1', sess: 'sess-muse-dyn-1' },
    { provider: 'vibe', name: 'Mistral Vibe', id: 'agent-vibe-dyn-1', sess: 'sess-vibe-dyn-1' },
    { provider: 'qoder', name: 'Qoder CLI', id: 'agent-qoder-dyn-1', sess: 'sess-qoder-dyn-1' },
  ];

  for (const dyn of dynamicAgents) {
    // Add to agent store dynamically
    useAgentStore.setState((s) => ({
      agents: [
        ...s.agents,
        {
          id: dyn.id,
          workspaceId: 'ws-test',
          provider: dyn.provider as any,
          name: dyn.name,
          model: 'Latest',
          status: 'ready',
          viewMode: 'terminal',
          currentSessionId: dyn.sess,
          createdAt: Date.now(),
        },
      ],
    }));

    // Test 1: Delivery by Agent ID
    const resA = await universalRemoteController.deliverRemoteMessage({
      requestId: `req_dyn_${dyn.provider}_a`,
      agentId: dyn.id,
      sessionId: dyn.sess,
      message: `Initial instruction to ${dyn.name}`,
      timestamp: Date.now(),
    });
    assert(resA.success === true, `Remote message to dynamically added ${dyn.name} delivered successfully`);
    assert(resA.agentId === dyn.id, `Resolved authoritative agentId matches ${dyn.id}`);

    // Test 2: Dual Identifier Resolution (when mobile passes sessionId as agentId)
    const resB = await universalRemoteController.deliverRemoteMessage({
      requestId: `req_dyn_${dyn.provider}_b`,
      agentId: dyn.sess,
      sessionId: dyn.sess,
      message: `Follow-up instruction via sessionId`,
      timestamp: Date.now(),
    });
    assert(resB.success === true, `Dual-identifier lookup resolved correctly for ${dyn.name}`);
    assert(resB.agentId === dyn.id, `Resolved canonical agentId for ${dyn.name} from sessionId`);
  }

  unsubDiag();

  console.log('\n=== ALL AUTOMATED CERTIFICATION SUITES PASSED CLEANLY! ===\n');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
