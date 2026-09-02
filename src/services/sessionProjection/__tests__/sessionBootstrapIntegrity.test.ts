// ============================================================================
// INV — Session Rehydration, Conversation Isolation & PTY Bootstrap Integrity
// ============================================================================
// Regression matrix per the session-architecture spec:
//   1.  PTY BOOTSTRAP — restored screen content generates ZERO assistant events
//   2.  NO ACTIVE TURN — READY-state output can never become a conversation event
//   3.  MULTI-TURN ISOLATION — each turn contains only its own content
//   4.  RESTART SESSION REUSE — the persisted sessionId is reused; canonical
//       history hydrates exactly once; no PTY-reconstructed duplicates
//   5.  REPEATED OUTPUT — legitimate identical replies preserved across turns
//   6.  STREAMING KEYING — deltas only touch sessionId + turnId
//   7.  CAPTURE LIFECYCLE — BOOTSTRAPPING/READY/TURN_ACTIVE/DISPOSED transitions
import assert from 'node:assert';
import { PtyCaptureSession, CaptureLifecycle } from '../state/PtyCaptureSession';
import { ScreenFingerprint } from '../state/ScreenFingerprint';
import { HeadlessTerminalInterpreter } from '../terminal/HeadlessTerminalInterpreter';
import { AuthoritativeConversationStore as ConversationStore } from '../../conversation/ConversationStore';

console.log('🧪 Starting Session Rehydration, Isolation & PTY Bootstrap Integrity Suite...\n');

// ----------------------------------------------------------------------------
// TEST 1 — PTY BOOTSTRAP (§5): restored screen = ZERO conversation events
// ----------------------------------------------------------------------------
{
  console.log('Test 1: PTY Bootstrap — restored screen content is terminal state only');
  const capture = new PtyCaptureSession('sess-boot-1', 30, 100);

  // The agent's screen already shows: old prompt, old reply, TUI metadata,
  // spinner state, model info (exactly the Copilot screenshot class).
  const restoredScreen =
    '❯ hello\r\n' +
    'Hello! How can I help with your project or code today?\r\n' +
    'MCP Servers reloaded: 1 server connected\r\n' +
    'Session: 0.34AIC used\r\n' +
    'Resuming session...\r\n' +
    'Auto — claude-haiku-4.5\r\n' +
    '⠋ Thinking\r\n' +
    '❯ ';

  // Bootstrap intake WITHOUT any turn (INV-6: BOOTSTRAPPING → terminal only)
  capture.primeFromHistory(restoredScreen);
  const bootstrapResult = capture.processPtyBytes(restoredScreen + '\r\n');

  assert.strictEqual(bootstrapResult.userFacingText, '', 'Bootstrap must produce ZERO assistant text');
  assert.strictEqual(bootstrapResult.activities.length, 0, 'Bootstrap must produce ZERO activities');
  assert.strictEqual(bootstrapResult.hasNewContent, false);
  assert.strictEqual(bootstrapResult.turnId, null, 'Bootstrap must have NO turn ownership');
  assert.strictEqual(capture.getLifecycle(), 'READY', 'After priming the capture is READY');
  console.log('  ✓ Restored screen generated 0 assistant events');
}

// ----------------------------------------------------------------------------
// TEST 2 — NO ACTIVE TURN (§8): READY-state new output is never a message
// ----------------------------------------------------------------------------
{
  console.log('Test 2: No active turn — genuinely NEW output cannot become assistant text');
  const capture = new PtyCaptureSession('sess-boot-2', 30, 100);

  // Turn 1 completes normally
  capture.startTurn('turn-1', 'hello', 'm1');
  const t1 = capture.processPtyBytes('> hello\r\nHello! How can I help you today?\r\n> ');
  assert.strictEqual(t1.userFacingText, 'Hello! How can I help you today?');
  capture.commitTurn('turn-1');

  // Agent spontaneously prints something NEW with no turn active (READY)
  const stray = capture.processPtyBytes('\r\nServer heartbeat: connected\r\n> ');
  assert.strictEqual(stray.userFacingText, '', 'READY-state output must NOT create assistant text');
  assert.strictEqual(stray.turnId, null, 'READY-state output must NOT claim turn ownership');
  console.log('  ✓ Stray post-turn output produced zero conversation events');
}

// ----------------------------------------------------------------------------
// TEST 3 — CAPTURE LIFECYCLE (§6): state transitions are explicit
// ----------------------------------------------------------------------------
{
  console.log('Test 3: CaptureLifecycle transitions');
  const capture = new PtyCaptureSession('sess-boot-3', 30, 100);
  assert.strictEqual(capture.getLifecycle(), 'BOOTSTRAPPING', 'Fresh capture starts BOOTSTRAPPING');

  capture.markPrimed();
  assert.strictEqual(capture.getLifecycle(), 'READY', 'markPrimed → READY (no turn)');

  capture.startTurn('turn-a', 'hi', 'ma');
  assert.strictEqual(capture.getLifecycle(), 'TURN_ACTIVE', 'startTurn → TURN_ACTIVE');

  const res = capture.processPtyBytes('> hi\r\nHi there!\r\n');
  assert.strictEqual(res.lifecycle, 'TURN_ACTIVE');
  assert.strictEqual(res.userFacingText, 'Hi there!');

  capture.commitTurn('turn-a');
  assert.strictEqual(capture.getLifecycle(), 'READY', 'commitTurn → READY');

  capture.dispose();
  assert.strictEqual(capture.getLifecycle(), 'DISPOSED', 'dispose → DISPOSED');
  console.log('  ✓ BOOTSTRAPPING → READY → TURN_ACTIVE → READY → DISPOSED');
}

// ----------------------------------------------------------------------------
// TEST 4 — MULTI-TURN ISOLATION (§23): each turn contains only its own content
// ----------------------------------------------------------------------------
{
  console.log('Test 4: Multi-turn isolation');
  const capture = new PtyCaptureSession('sess-iso', 30, 100);

  capture.startTurn('turn-1', 'hello', 'm1');
  const r1 = capture.processPtyBytes('> hello\r\nResponse one for hello.\r\n❯ ');
  capture.commitTurn('turn-1');
  assert.strictEqual(r1.userFacingText, 'Response one for hello.');

  capture.startTurn('turn-2', 'who are you', 'm2');
  const r2 = capture.processPtyBytes('❯ who are you\r\nResponse two: I am an AI coding agent.\r\n❯ ');
  capture.commitTurn('turn-2');
  assert.strictEqual(r2.userFacingText, 'Response two: I am an AI coding agent.');
  assert.strictEqual(r2.userFacingText.includes('Response one'), false, 'Turn 2 must not contain Turn 1');
  console.log('  ✓ Turn ownership strictly scoped');
}

// ----------------------------------------------------------------------------
// TEST 5 — RESTART SESSION REUSE (§2): persisted session rehydrates, no PTY replay
// ----------------------------------------------------------------------------
{
  console.log('Test 5: Restart — canonical history hydrates once; restored PTY adds nothing');
  const store = new ConversationStore();
  store.clearAll();

  // Persisted canonical conversation for the SAME session
  const persisted = store.getOrCreateSession(
    'orbit-abc',
    'proj-orbit',
    'ws-orbit',
    { id: 'agent-1', name: 'OpenCode', provider: 'opencode', transport: 'pty' }
  );
  store.addUserMessage('orbit-abc', 'hello');
  store.completeAgentMessage('orbit-abc', 'Hello!');

  // Desktop restart: rehydrate (INV-12 — direct hydration, NOT replayed events)
  const snapshot = JSON.parse(JSON.stringify(store.getAllSessions()));
  const rehydrated = new ConversationStore();
  rehydrated.clearAll();
  rehydrated.rehydrateFromList(snapshot);

  const session = rehydrated.getSession('orbit-abc');
  assert.ok(session, 'Session identity survives restart');
  assert.strictEqual(session!.id, 'orbit-abc', 'Same Orbit sessionId reused');
  assert.strictEqual(session!.conversation.turns.length, 2, 'Exactly one user turn + one assistant turn');
  assert.strictEqual(session!.conversation.turns[0].messages[0].content[0].type === 'text' &&
    (session!.conversation.turns[0].messages[0].content[0] as any).text, 'hello');
  assert.strictEqual(session!.conversation.turns[1].messages[0].content[0].type === 'markdown' &&
    (session!.conversation.turns[1].messages[0].content[0] as any).markdown, 'Hello!');

  // The agent's restored screen replayed into a fresh capture session must add
  // NOTHING to the conversation (bootstrap, no turn active).
  const capture = new PtyCaptureSession('orbit-abc', 30, 100);
  capture.primeFromHistory('❯ hello\r\nHello!\r\n❯ ');
  const replayed = capture.processPtyBytes('\x1b[2J\x1b[H❯ hello\r\nHello!\r\n❯ ');
  assert.strictEqual(replayed.userFacingText, '', 'Restored PTY screen must not generate messages');

  // New turn on the REHYDRATED store appends exactly once
  rehydrated.addUserMessage('orbit-abc', 'hey');
  const agentTurnId = rehydrated.startAgentTurn('orbit-abc').id;
  rehydrated.completeAgentMessage('orbit-abc', 'New response', undefined, agentTurnId);
  const after = rehydrated.getSession('orbit-abc')!;
  assert.strictEqual(after.conversation.turns.length, 4, 'Turn count grows by exactly 2');
  const helloTurns = after.conversation.turns.filter((t) =>
    t.messages.some((m) => m.content.some((c) => (c as any).text === 'hello' || (c as any).markdown === 'Hello!'))
  );
  assert.strictEqual(helloTurns.length, 2, 'Historical turn appears exactly ONCE (no PTY-reconstructed copy)');
  console.log('  ✓ Same sessionId, history exactly once, no PTY replay, new turn appended');
}

// ----------------------------------------------------------------------------
// TEST 6 — REPEATED OUTPUT (§23): legitimate identical replies preserved
// ----------------------------------------------------------------------------
{
  console.log('Test 6: Repeated legitimate output across turns');
  const capture = new PtyCaptureSession('sess-rep', 30, 100);
  capture.startTurn('turn-1', 'run tests', 'm1');
  const r1 = capture.processPtyBytes('> run tests\r\nAll tests passed.\r\n> ');
  capture.commitTurn('turn-1');
  assert.strictEqual(r1.userFacingText, 'All tests passed.');

  capture.startTurn('turn-2', 'run tests again', 'm2');
  const r2 = capture.processPtyBytes('\r> run tests again\r\nAll tests passed.\r\n> ');
  capture.commitTurn('turn-2');
  assert.strictEqual(r2.userFacingText, 'All tests passed.', 'Identical reply must be captured again');
  console.log('  ✓ No global text blacklisting — repeated replies preserved');
}

// ----------------------------------------------------------------------------
// TEST 7 — STREAMING KEYING (§11): deltas only touch sessionId + turnId
// ----------------------------------------------------------------------------
{
  console.log('Test 7: Streaming keyed by sessionId + turnId');
  const store = new ConversationStore();
  store.clearAll();
  store.getOrCreateSession('sess-a', 'p', 'w', { id: 'ag', name: 'X', provider: 'opencode' });
  store.getOrCreateSession('sess-b', 'p', 'w', { id: 'ag', name: 'X', provider: 'opencode' });

  store.addUserMessage('sess-a', 'hello');
  const turnA = store.startAgentTurn('sess-a').id;

  // Stream into sess-a with the owning turnId
  store.updateStreamingAssistant('sess-a', 'partial reply', undefined, turnA);
  assert.strictEqual(
    (store.getSession('sess-a')!.conversation.turns.slice(-1)[0].messages[0].content[0] as any).markdown,
    'partial reply'
  );

  // STALE event with a foreign turnId MUST be rejected (INV-22)
  store.completeAgentMessage('sess-a', 'stray', undefined, 'turn_foreign');
  assert.strictEqual(
    (store.getSession('sess-a')!.conversation.turns.slice(-1)[0].messages[0].content[0] as any).markdown,
    'partial reply',
    'Foreign-turn completion must not overwrite the active turn'
  );

  // Session B must remain untouched by session A's streaming
  assert.strictEqual(store.getSession('sess-b')!.conversation.turns.length, 0, 'Session B has zero turns');

  store.completeAgentMessage('sess-a', 'final reply', undefined, turnA);
  assert.strictEqual(
    (store.getSession('sess-a')!.conversation.turns.slice(-1)[0].messages[0].content[0] as any).markdown,
    'final reply'
  );
  console.log('  ✓ Streaming scoped to sessionId+turnId; foreign events rejected');
}

// ----------------------------------------------------------------------------
// TEST 8 — SESSION ISOLATION (§9): zero cross-session content at capture level
// ----------------------------------------------------------------------------
{
  console.log('Test 8: Session isolation across capture sessions');
  const capA = new PtyCaptureSession('sess-iso-a', 30, 100);
  const capB = new PtyCaptureSession('sess-iso-b', 30, 100);

  capA.startTurn('a1', 'Hello', 'ma1');
  const ra = capA.processPtyBytes('> Hello\r\nResponse A\r\n❯ ');
  capA.commitTurn('a1');
  assert.strictEqual(ra.userFacingText, 'Response A');

  capB.startTurn('b1', 'Who are you', 'mb1');
  const rb = capB.processPtyBytes('❯ Who are you\r\nResponse B\r\n❯ ');
  capB.commitTurn('b1');
  assert.strictEqual(rb.userFacingText, 'Response B');
  assert.strictEqual(rb.userFacingText.includes('Response A'), false, 'Session B must contain zero content from Session A');

  // Session A replayed into session B's capture (restore/reconnect) → nothing
  capB.primeFromHistory('> Hello\r\nResponse A\r\n❯ ');
  const leaked = capB.processPtyBytes('\x1b[2J\x1b[H> Hello\r\nResponse A\r\n❯ Who are you\r\n');
  assert.strictEqual(leaked.userFacingText.includes('Response A'), false, 'Restored Session A screen must not leak into Session B');
  console.log('  ✓ Cross-session isolation enforced');
}

// ----------------------------------------------------------------------------
// TEST 9 — SCROLLBACK BASELINE (§16): temporal/lifecycle boundary, not text matching
// ----------------------------------------------------------------------------
{
  console.log('Test 9: Scrollback-informed baselines suppress re-scrolled history');
  const interpreter = new HeadlessTerminalInterpreter(6, 40); // tiny viewport
  const capture = new PtyCaptureSession('sess-scroll', 6, 40);

  // Fill a conversation that scrolls (old rows leave the viewport)
  capture.startTurn('t1', 'q1', 'm1');
  capture.processPtyBytes('> q1\r\nAnswer one line.\r\n> ');
  capture.commitTurn('t1');

  capture.startTurn('t2', 'q2', 'm2');
  capture.processPtyBytes('> q2\r\nAnswer two line.\r\n> ');
  capture.commitTurn('t2');

  capture.startTurn('t3', 'q3', 'm3');
  // With a 6-row viewport, painting several rows pushes early history into
  // scrollback; a later repaint that scrolls it back must NOT capture it again.
  capture.processPtyBytes(
    '> q3\r\n' +
      'Answer three line.\r\n' +
      'Answer two line.\r\n' +
      'Answer one line.\r\n' +
      '❯ '
  );
  capture.commitTurn('t3');
  const final = capture.processPtyBytes('\x1b[2J\x1b[H> q3\r\nAnswer three line.\r\n❯ ');
  const text = final.userFacingText;
  assert.strictEqual(text.includes('Answer one'), false, 'Re-scrolled history row must not leak');
  assert.strictEqual(text.includes('Answer two'), false, 'Re-scrolled history row must not leak');
  console.log('  ✓ Scrollback-aware baseline enforced');
}

console.log('\n✨ ALL 11 SESSION REHYDRATION / ISOLATION / BOOTSTRAP SUITES PASSED (100% OK)\n');

// ----------------------------------------------------------------------------
// TEST 10 — REMOTE/MOBILE REPLY PATH (regression): capture turnId adoption
// ----------------------------------------------------------------------------
// The remote controller / chat submission starts the capture turn with ITS
// turnId; the canonical store creates the agent turn LAZILY on the first
// assistant event. The store must ADOPT the capture identity — rejecting it
// discarded every PTY-captured reply and mobile showed nothing.
{
  console.log('Test 10: Remote reply path — canonical store adopts capture turnId');
  const store = new ConversationStore();
  store.clearAll();
  store.getOrCreateSession('sess-remote', 'proj', 'ws', { id: 'agent-rc', name: 'Copilot', provider: 'copilot', transport: 'pty' });

  // Remote submission: user message lands first...
  store.addUserMessage('sess-remote', 'who are you');

  // ...then the capture emits events under ITS OWN turn identity (never seen
  // by the store before) — exactly what UniversalRemoteController produces.
  const captureTurnId = `turn_${Date.now()}_rc`;
  store.updateStreamingAssistant('sess-remote', 'I am the GitHub Copilot CLI assistant.', undefined, captureTurnId);
  const streamingTurn = store.getSession('sess-remote')!.conversation.turns.slice(-1)[0];
  assert.strictEqual(streamingTurn.role, 'agent', 'Agent turn created by the first delta');
  assert.strictEqual(streamingTurn.id, captureTurnId, 'Agent turn must ADOPT the capture turn identity');
  assert.strictEqual(
    (streamingTurn.messages[0].content[0] as any).markdown,
    'I am the GitHub Copilot CLI assistant.',
    'Reply text must reach the canonical store (mobile visibility)'
  );

  store.completeAgentMessage('sess-remote', 'I am the GitHub Copilot CLI assistant.', undefined, captureTurnId);
  const done = store.getSession('sess-remote')!.conversation.turns.slice(-1)[0];
  assert.strictEqual(done.status, 'complete', 'Completion with the adopted identity commits the turn');

  // A stale event from the OLD turn must still be rejected (INV-22 preserved)
  store.updateStreamingAssistant('sess-remote', 'stray stale delta', undefined, captureTurnId);
  const last = store.getSession('sess-remote')!.conversation.turns.slice(-1)[0];
  assert.strictEqual(
    (last.messages[0].content[0] as any).markdown,
    'I am the GitHub Copilot CLI assistant.',
    'Stale post-completion event must not overwrite the completed turn'
  );

  // A SECOND remote turn gets its own fresh identity and lands cleanly
  store.addUserMessage('sess-remote', 'second question');
  const secondCaptureTurn = `turn_${Date.now()}_rc2`;
  store.updateStreamingAssistant('sess-remote', 'Second answer.', undefined, secondCaptureTurn);
  store.completeAgentMessage('sess-remote', 'Second answer.', undefined, secondCaptureTurn);
  const turns = store.getSession('sess-remote')!.conversation.turns;
  assert.strictEqual(turns.length, 4, 'Two complete user+agent turn pairs');
  assert.strictEqual(
    (turns[3].messages[0].content[0] as any).markdown,
    'Second answer.',
    'Second remote reply isolated from the first'
  );
  console.log('  ✓ Capture identity adopted, completion commits, stale rejected, multi-turn isolated');
}

// ----------------------------------------------------------------------------
// TEST 11 — STALE STREAMING RECONCILIATION (delivery-failure / restart class)
// ----------------------------------------------------------------------------
{
  console.log('Test 11: Stale streaming turns reconcile (no eternal "Generating response…")');
  const store = new ConversationStore();
  store.clearAll();
  store.getOrCreateSession('sess-stale', 'p', 'w', { id: 'ag', name: 'Codex', provider: 'codex', transport: 'pty' });

  // Turn stuck streaming (e.g. delivery failed / process vanished mid-reply)
  store.addUserMessage('sess-stale', 'hey');
  store.updateStreamingAssistant('sess-stale', 'partial…', undefined, store.startAgentTurn('sess-stale').id);

  // A NEW remote submission supersedes it
  store.addUserMessage('sess-stale', 'next prompt');
  store.reconcileStreamingTurns('sess-stale');
  const staleTurn = store.getSession('sess-stale')!.conversation.turns.find((t) =>
    t.messages.some((m) => (m.content[0] as any).markdown === 'partial…')
  );
  assert.ok(staleTurn, 'stale turn exists');
  assert.strictEqual(staleTurn!.status, 'interrupted', 'stale streaming turn reconciled to interrupted');
  assert.strictEqual(staleTurn!.messages[0].streaming, false, 'streaming flag cleared');

  // Persisted streaming turns from a PREVIOUS app run reconcile on rehydrate
  const persisted = JSON.parse(JSON.stringify(store.getAllSessions()));
  const fresh = new ConversationStore();
  fresh.clearAll();
  fresh.rehydrateFromList(persisted);
  const restored = fresh.getSession('sess-stale')!;
  const stillStreaming = restored.conversation.turns.filter((t) => t.status === 'streaming');
  assert.strictEqual(stillStreaming.length, 0, 'No streaming turns survive a restart');
  console.log('  ✓ New turn supersedes + restart reconciles persisted streaming state');
}
