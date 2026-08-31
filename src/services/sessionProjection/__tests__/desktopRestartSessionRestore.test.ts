import assert from 'node:assert';
import { conversationStore } from '../../conversation/ConversationStore';
import { sessionService } from '../../session.service';
import { OrbitSession } from '../../../types/conversation';

console.log('🧪 Starting Desktop Restart Session Restoration & Conversation Identity Test Suite...\n');

// Helper to simulate full localStorage export/import cycle during restart
function simulateDesktopRestart() {
  const serialized = JSON.stringify(conversationStore.getAllSessions());
  conversationStore.clearAll();
  const restoredList: OrbitSession[] = JSON.parse(serialized);
  conversationStore.rehydrateFromList(restoredList);
}

// ----------------------------------------------------------------------------
// TEST 1 — Basic Restart
// ----------------------------------------------------------------------------
{
  console.log('Test 1: Basic Restart (Session & Conversation Identity Persistence)');
  conversationStore.clearAll();

  const sessId = 'sess-kilo-001';
  const session = conversationStore.getOrCreateSession(
    sessId,
    'ws-1',
    'ws-1',
    { id: 'agent-kilo-1', name: 'KiloCode', provider: 'kilocode' }
  );

  // Turn 1
  conversationStore.addUserMessage(sessId, 'Hello');
  conversationStore.startAgentTurn(sessId);
  conversationStore.updateStreamingAssistant(sessId, 'Hello! How can I help you today?');
  conversationStore.completeAgentMessage(sessId, 'Hello! How can I help you today?');

  const beforeTurns = JSON.parse(JSON.stringify(session.conversation.turns));
  const beforeMsgCount = session.conversation.turns.length;

  // Simulate Desktop Restart
  simulateDesktopRestart();

  // Restore Session
  const restoredSession = conversationStore.getSession(sessId);
  assert.ok(restoredSession, 'Session must exist after restart');
  assert.strictEqual(restoredSession.id, sessId, 'sessionId before must equal sessionId after');
  assert.strictEqual(restoredSession.engine.id, 'agent-kilo-1');
  assert.strictEqual(restoredSession.conversation.turns.length, beforeMsgCount, 'Message turn count must match');
  assert.deepStrictEqual(restoredSession.conversation.turns, beforeTurns, 'Conversation history must match exactly');

  console.log('  ✓ Session ID and full conversation preserved across restart');
}

// ----------------------------------------------------------------------------
// TEST 2 — Same Agent After Restart (No Duplicate Session)
// ----------------------------------------------------------------------------
{
  console.log('Test 2: Same Agent After Restart (No Duplicate Session)');
  conversationStore.clearAll();

  const agentId = 'agent-kilocode-42';
  const sessId = 'sess-kilo-42-01';

  conversationStore.getOrCreateSession(
    sessId,
    'ws-1',
    'ws-1',
    { id: agentId, name: 'KiloCode', provider: 'kilocode' }
  );
  conversationStore.addUserMessage(sessId, 'Initial prompt');
  conversationStore.completeAgentMessage(sessId, 'Initial response');

  // Restart Desktop
  simulateDesktopRestart();

  // Agent discovery on restart checks existing session
  const agentSessions = conversationStore.getSessionsForAgent(agentId);
  assert.strictEqual(agentSessions.length, 1, 'Exactly one session should exist for agent');
  assert.strictEqual(agentSessions[0].id, sessId, 'Discovered agent must reattach to existing session');

  // getOrCreateSession with existing ID must return existing session without resetting
  const reattached = conversationStore.getOrCreateSession(
    sessId,
    'ws-1',
    'ws-1',
    { id: agentId, name: 'KiloCode', provider: 'kilocode' }
  );
  assert.strictEqual(reattached.id, sessId);
  assert.strictEqual(reattached.conversation.turns.length, 2);

  console.log('  ✓ Discovered agent reattached to existing session without creating a new session');
}

// ----------------------------------------------------------------------------
// TEST 3 — Multiple Sessions For Same Agent Provider
// ----------------------------------------------------------------------------
{
  console.log('Test 3: Multiple Sessions For Same Agent Provider');
  conversationStore.clearAll();

  const sessA = 'sess-kilo-A';
  const sessB = 'sess-kilo-B';

  conversationStore.getOrCreateSession(sessA, 'ws-1', 'ws-1', { id: 'agent-A', name: 'KiloCode Worker A', provider: 'kilocode' });
  conversationStore.addUserMessage(sessA, 'Task A prompt');
  conversationStore.completeAgentMessage(sessA, 'Task A output');

  conversationStore.getOrCreateSession(sessB, 'ws-1', 'ws-1', { id: 'agent-B', name: 'KiloCode Worker B', provider: 'kilocode' });
  conversationStore.addUserMessage(sessB, 'Task B prompt');
  conversationStore.completeAgentMessage(sessB, 'Task B output');

  // Restart Desktop
  simulateDesktopRestart();

  const restoredA = conversationStore.getSession(sessA);
  const restoredB = conversationStore.getSession(sessB);

  assert.ok(restoredA && restoredB);
  assert.strictEqual(restoredA.id, sessA);
  assert.strictEqual(restoredB.id, sessB);
  assert.strictEqual(restoredA.conversation.turns[0].messages[0].content[0].type === 'text' && (restoredA.conversation.turns[0].messages[0].content[0] as any).text, 'Task A prompt');
  assert.strictEqual(restoredB.conversation.turns[0].messages[0].content[0].type === 'text' && (restoredB.conversation.turns[0].messages[0].content[0] as any).text, 'Task B prompt');

  console.log('  ✓ Multiple sessions for same agent provider remain strictly isolated');
}

// ----------------------------------------------------------------------------
// TEST 4 — Different Agents Retain Identities
// ----------------------------------------------------------------------------
{
  console.log('Test 4: Different Agents (OpenCode, KiloCode, Codex)');
  conversationStore.clearAll();

  const openCodeSess = 'sess-opencode-1';
  const kiloCodeSess = 'sess-kilocode-1';
  const codexSess = 'sess-codex-1';

  conversationStore.getOrCreateSession(openCodeSess, 'ws-1', 'ws-1', { id: 'agent-open', name: 'OpenCode', provider: 'opencode' });
  conversationStore.addUserMessage(openCodeSess, 'OpenCode prompt');
  conversationStore.completeAgentMessage(openCodeSess, 'OpenCode response');

  conversationStore.getOrCreateSession(kiloCodeSess, 'ws-1', 'ws-1', { id: 'agent-kilo', name: 'KiloCode', provider: 'kilocode' });
  conversationStore.addUserMessage(kiloCodeSess, 'KiloCode prompt');
  conversationStore.completeAgentMessage(kiloCodeSess, 'KiloCode response');

  conversationStore.getOrCreateSession(codexSess, 'ws-1', 'ws-1', { id: 'agent-codex', name: 'Codex', provider: 'codex' });
  conversationStore.addUserMessage(codexSess, 'Codex prompt');
  conversationStore.completeAgentMessage(codexSess, 'Codex response');

  // Restart Desktop
  simulateDesktopRestart();

  assert.strictEqual(conversationStore.getAllSessions().length, 3);
  assert.strictEqual(conversationStore.getSession(openCodeSess)?.engine.provider, 'opencode');
  assert.strictEqual(conversationStore.getSession(kiloCodeSess)?.engine.provider, 'kilocode');
  assert.strictEqual(conversationStore.getSession(codexSess)?.engine.provider, 'codex');

  console.log('  ✓ OpenCode, KiloCode, and Codex sessions all retained distinct identities');
}

// ----------------------------------------------------------------------------
// TEST 5 — Mobile Reconnect & Telemetry Sync
// ----------------------------------------------------------------------------
{
  console.log('Test 5: Mobile Reconnect & Telemetry Sync');
  conversationStore.clearAll();

  const sessId = 'sess-active-100';
  const session = conversationStore.getOrCreateSession(sessId, 'ws-1', 'ws-1', { id: 'agent-100', name: 'KiloCode', provider: 'kilocode' });
  conversationStore.addUserMessage(sessId, 'Message 1');
  conversationStore.completeAgentMessage(sessId, 'Response 1');

  // Restart Desktop
  simulateDesktopRestart();

  // Mobile connects and requests telemetry
  const restoredSession = conversationStore.getSession(sessId)!;
  const mappedChatHistory: any[] = [];

  for (const turn of restoredSession.conversation.turns) {
    for (const msg of turn.messages) {
      mappedChatHistory.push({
        id: msg.id,
        agentId: restoredSession.id,
        sender: msg.role === 'user' ? 'user' : 'agent',
        content: msg.content.map((c: any) => c.text || c.markdown || '').join('\n'),
        timestamp: msg.createdAt,
      });
    }
  }

  assert.strictEqual(mappedChatHistory.length, 2, 'Mobile must receive exactly 2 historical messages');
  assert.strictEqual(mappedChatHistory[0].content, 'Message 1');
  assert.strictEqual(mappedChatHistory[1].content, 'Response 1');

  console.log('  ✓ Mobile receives canonical chat history exactly once upon reconnect');
}

// ----------------------------------------------------------------------------
// TEST 6 — Duplicate Startup Events (Idempotency)
// ----------------------------------------------------------------------------
{
  console.log('Test 6: Duplicate Startup Events (Idempotency)');
  conversationStore.clearAll();

  const sessId = 'sess-idem-1';
  conversationStore.getOrCreateSession(sessId, 'ws-1', 'ws-1', { id: 'agent-idem', name: 'OpenCode', provider: 'opencode' });
  conversationStore.addUserMessage(sessId, 'Run tests');
  conversationStore.completeAgentMessage(sessId, 'Tests passed');

  // Simulate multiple duplicate restore calls
  conversationStore.restoreSession(sessId);
  conversationStore.restoreSession(sessId);
  conversationStore.restoreSession(sessId);

  const session = conversationStore.getSession(sessId)!;
  assert.strictEqual(session.conversation.turns.length, 2, 'Multiple restore calls must not duplicate turns');

  console.log('  ✓ Repeated session restore calls are completely idempotent');
}

// ----------------------------------------------------------------------------
// TEST 7 — Dead Process Handling After Restart
// ----------------------------------------------------------------------------
{
  console.log('Test 7: Dead Process Handling After Restart');
  conversationStore.clearAll();

  const sessId = 'sess-dead-1';
  const session = conversationStore.getOrCreateSession(sessId, 'ws-1', 'ws-1', { id: 'agent-dead', name: 'Codex', provider: 'codex' });
  conversationStore.addUserMessage(sessId, 'Heavy compute task');
  // Mark running before shutdown
  conversationStore.setRuntimeAlive(sessId, true, 45123, 'working');

  // Simulate Desktop Restart when OS killed the previous PID
  simulateDesktopRestart();

  const restored = conversationStore.getSession(sessId)!;
  // Initially loaded sessions are marked offline until verified
  assert.strictEqual(restored.runtime.isAlive, false, 'Restored session must not falsely claim to be alive');
  assert.strictEqual(restored.status === 'offline' || restored.status === 'waiting', true);

  console.log('  ✓ Terminated/dead processes correctly initialized as offline until verified');
}

// ----------------------------------------------------------------------------
// TEST 8 — Actual Explicit New Session Spawn
// ----------------------------------------------------------------------------
{
  console.log('Test 8: Explicit New Session Spawn');
  conversationStore.clearAll();

  const agentId = 'agent-user-kilo';
  const session1Id = 'sess-kilo-old';
  const session2Id = 'sess-kilo-new';

  // 1. Session 1 created and completed
  conversationStore.getOrCreateSession(session1Id, 'ws-1', 'ws-1', { id: agentId, name: 'KiloCode', provider: 'kilocode' }, 'Session 01');
  conversationStore.addUserMessage(session1Id, 'Old conversation');
  conversationStore.completeAgentMessage(session1Id, 'Old response');

  // 2. User explicitly spawns Session 2
  conversationStore.getOrCreateSession(session2Id, 'ws-1', 'ws-1', { id: agentId, name: 'KiloCode', provider: 'kilocode' }, 'Session 02');
  conversationStore.addUserMessage(session2Id, 'Brand new conversation');
  conversationStore.completeAgentMessage(session2Id, 'Brand new response');

  const allAgentSessions = conversationStore.getSessionsForAgent(agentId);
  assert.strictEqual(allAgentSessions.length, 2, 'Both distinct sessions must exist for agent');

  const oldSess = conversationStore.getSession(session1Id)!;
  const newSess = conversationStore.getSession(session2Id)!;

  assert.strictEqual(oldSess.title, 'Old conversation');
  assert.strictEqual(newSess.title, 'Brand new conversation');
  assert.notStrictEqual(oldSess.id, newSess.id);
  assert.strictEqual((oldSess.conversation.turns[0].messages[0].content[0] as any).text, 'Old conversation');
  assert.strictEqual((newSess.conversation.turns[0].messages[0].content[0] as any).text, 'Brand new conversation');

  console.log('  ✓ Explicit new session spawn correctly isolates history and generates distinct session ID');
}

console.log('\n✨ ALL 8 DESKTOP RESTART SESSION RESTORATION TEST SUITES PASSED (100% OK)\n');
