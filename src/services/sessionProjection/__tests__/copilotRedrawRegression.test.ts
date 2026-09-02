// ============================================================================
// COPILOT REDRAW REGRESSION — exact defects from the user screenshot:
//   1. Broken characters: "Hi! 👋 What c" / "ought 1s n i help you with today."
//      (escape sequences split across IPC chunks were dropped, losing erases)
//   2. Historical prompt ("hello") and old chat content rendered inside the
//      agent's NEW reply bubble.
//   3. TUI chrome inside replies: footers, counters, model chips, status dots.
// ============================================================================
import assert from 'node:assert';
import { PtyCaptureSession } from '../state/PtyCaptureSession';
import { HeadlessTerminalInterpreter } from '../terminal/HeadlessTerminalInterpreter';
import { ScreenFingerprint } from '../state/ScreenFingerprint';

console.log('🧪 Copilot redraw + echo-identity regression suite...\n');

// ----------------------------------------------------------------------------
// TEST 1 — ANSI sequence SPLIT across chunks (root cause of broken characters)
// ----------------------------------------------------------------------------
{
  console.log('Test 1: Escape sequence split across PTY chunk boundary');
  const t = new HeadlessTerminalInterpreter(10, 80);

  // Color sequence split mid-parameters, then visible text.
  t.processBytes('Hi! \x1b[38;5');
  t.processBytes(';208mWhat can I help you with?\x1b[0m\r\n');
  const row = t.captureSnapshot().lines[0];

  assert.strictEqual(row, 'Hi! What can I help you with?', `No parameter bytes may leak, got: ${JSON.stringify(row)}`);
  assert.strictEqual(row.includes('['), false, 'CSI brackets must never render');

  // Cursor-position + erase sequence split across chunks (the "ought for 1s" class:
  // the TUI repositions and rewrites a row; a dropped CSI loses the ERASE and two
  // writes overlay one grid row).
  const t2 = new HeadlessTerminalInterpreter(10, 80);
  t2.processBytes('Thought for 1s, working on it.\x1b[2K');        // erase line (complete)
  t2.processBytes('\x1b[');                                       // split: start of cursor-home
  t2.processBytes('HCan I help you with today?\r\n');             // completed: ESC[H then text
  const row2 = t2.captureSnapshot().lines[0];
  assert.strictEqual(
    row2.includes('Thought for') || row2.includes('['),
    false,
    `Erase must not be lost to a chunk split, got: ${JSON.stringify(row2)}`
  );
  assert.strictEqual(row2.trim(), 'Can I help you with today?');
  console.log('  ✓ Split CSI/OSC sequences parsed statefully; no parameter leakage, erases preserved');
}

// ----------------------------------------------------------------------------
// TEST 2 — partial rewrite then completion → ONE clean line, never both
// ----------------------------------------------------------------------------
{
  console.log('Test 2: Progressive in-place rewrite collapses to the completed line');
  const capture = new PtyCaptureSession('sess-redraw', 30, 100);
  capture.startTurn('t1', 'hello', 'm1');

  // Frame A: Copilot paints a partial answer row (TUI mid-write)
  capture.processPtyBytes('Hi! 👋 What c\r\n');
  // Frame B: full-screen repaint with the completed row (partial erased)
  const done = capture.processPtyBytes(
    '\x1b[2K\rHi! 👋 What can I help you with today?\r\n'
  );

  const text = done.userFacingText;
  assert.strictEqual(text.includes('Hi! 👋 What can I help you with today?'), true, 'Completed line must be captured');
  assert.strictEqual(
    text.split('\n').some((l) => l.trim().endsWith('What c')),
    false,
    `Partial fragment must not survive next to its completion, got: ${JSON.stringify(text)}`
  );
  capture.commitTurn('t1');
  console.log('  ✓ Fragment replaced by completion (vanish-prune + fingerprint replace)');
}

// ----------------------------------------------------------------------------
// TEST 3 — historical prompt echo variants inside the reply area → suppressed
// ----------------------------------------------------------------------------
{
  console.log('Test 3: Prompt echo identity — bare, decorated, timestamped');
  const capture = new PtyCaptureSession('sess-echo', 30, 100);
  capture.startTurn('t1', 'hello', 'm1');

  // Copilot re-renders the prompt three ways in one resume repaint.
  const res = capture.processPtyBytes(
    '❯ hello\r\n' +        // decorated
    'hello    19:05 d\r\n' + // right-aligned frame timestamp + cursor artifact
    '│ hello │\r\n' +        // boxed
    'Hi there! How can I help?\r\n'
  );

  const text = res.userFacingText;
  for (const variant of ['❯ hello', 'hello    19:05 d', '│ hello │']) {
    assert.strictEqual(
      text.toLowerCase().includes(variant.toLowerCase()),
      false,
      `Echo variant "${variant}" must not be captured as prose`
    );
  }
  // The bare prompt identity must also never appear as a standalone captured line
  assert.strictEqual(
    text.split('\n').filter((l) => ScreenFingerprint.terminalEchoFingerprint(l) === 'hello').length,
    0,
    'Any line whose echo-identity is the prompt must be suppressed'
  );
  assert.strictEqual(text, 'Hi there! How can I help?');
  capture.commitTurn('t1');
  console.log('  ✓ hello / ❯ hello / hello 19:05 d / │hello│ all resolve to one prompt identity');
}

// ----------------------------------------------------------------------------
// TEST 4 — full resume repaint (previous conversation) → nothing captured
// ----------------------------------------------------------------------------
{
  console.log('Test 4: Copilot full-screen resume repaint before/without a new answer');
  const capture = new PtyCaptureSession('sess-repaint', 30, 100);
  capture.primeFromHistory(
    '❯ gfrfgn\r\nHello! How can I help with your project or code today?\r\n❯ '
  );
  capture.seedPromptFingerprints(['gfrfgn']);

  // The exact junk frame from the screenshot, with a NEW user message arriving.
  capture.startTurn('t1', 'hello', 'm1');
  const res = capture.processPtyBytes(
    'MCP Servers reloaded: 1 server connected\r\n' +
      '~/Desktop/personal_projects/orbit    Session: 0.34 AIC used\r\n' +
      'Resuming session...\r\n' +
      'hello    19:05 d\r\n' +
      '⏺\r\n' +
      '── open sidebar · / commands · ? help · tab next tab\r\n' +
      'Auto — claude-haiku-4.5\r\n' +
      'Working esc interrupt\r\n' +
      '41 B esc interrupt\r\n' +
      '95\r\n' +
      '292    2.92\r\n' +
      'ought for 1s nI help you with today?\r\n' +
      'Working·1na low·~/Desktop/personal_projects/orbit\r\n' +
      'gpt-5.6-luna low · ~/Desktop/personal_projects/orbit\r\n' +
      'Hi! 👋 What can I help you with today?\r\n'
  );

  const text = res.userFacingText;
  for (const bad of [
    'luna low',
    'Working·1na',
    'MCP Servers',
    'AIC used',
    'Resuming session',
    '19:05',
    'open sidebar',
    'claude-haiku',
    'esc interrupt',
    'ought for',
  ]) {
    assert.strictEqual(text.includes(bad), false, `Screenshot artifact "${bad}" must be filtered`);
  }
  assert.strictEqual(
    text.split('\n').filter((l) => /^[\d\s.]+$/.test(l.trim()) && l.trim().length > 0).length,
    0,
    'Bare counters must be filtered'
  );
  assert.strictEqual(text, 'Hi! 👋 What can I help you with today?');
  capture.commitTurn('t1');
  console.log('  ✓ Full junk frame → only the real reply line captured');
}

// ----------------------------------------------------------------------------
// TEST 5 — thought spam + status dots inside a turn → collapsed
// ----------------------------------------------------------------------------
{
  console.log('Test 5: Thought-chip spam and lone status symbols');
  const capture = new PtyCaptureSession('sess-think', 30, 100);
  capture.startTurn('t1', 'who are you', 'm1');

  let activities = 0;
  for (let i = 0; i < 8; i++) {
    const r = capture.processPtyBytes(`Thought for 1s\r\n⏺\r\n`);
    activities += r.activities.length;
  }
  const r = capture.processPtyBytes("I'm the GitHub Copilot CLI terminal assistant.\r\n");
  activities += r.activities.length;

  assert.strictEqual(activities, 0, `Thought/status spam must not become activity chips, got ${activities}`);
  assert.strictEqual(r.userFacingText, "I'm the GitHub Copilot CLI terminal assistant.");
  capture.commitTurn('t1');
  console.log('  ✓ 8 spinner frames + status dots collapsed; reply captured cleanly');
}

// ----------------------------------------------------------------------------
// TEST 6 — legitimate repeated text is NOT blacklisted
// ----------------------------------------------------------------------------
{
  console.log('Test 6: Legitimate identical replies still captured each turn');
  const capture = new PtyCaptureSession('sess-rep', 30, 100);
  capture.startTurn('t1', 'run tests', 'm1');
  const r1 = capture.processPtyBytes('> run tests\r\nAll tests passed.\r\n> ');
  capture.commitTurn('t1');
  capture.startTurn('t2', 'run tests again', 'm2');
  const r2 = capture.processPtyBytes('\r> run tests again\r\nAll tests passed.\r\n> ');
  capture.commitTurn('t2');
  assert.strictEqual(r2.userFacingText, 'All tests passed.', 'No global content blacklisting');
  console.log('  ✓ Identity-based (not content-based) suppression only');
}

// ----------------------------------------------------------------------------
// TEST 7 — bootstrap screen (no active turn) stays inert with the new parser
// ----------------------------------------------------------------------------
{
  console.log('Test 7: Bootstrap screen with split ANSI — zero events without a turn');
  const capture = new PtyCaptureSession('sess-boot', 30, 100);
  capture.primeFromHistory('❯ old\r\nOld reply.\r\n❯ ');
  const res = capture.processPtyBytes('\x1b[2J\x1b[H❯ old\r\nOld reply.\r\n❯ ');
  assert.strictEqual(res.userFacingText, '');
  assert.strictEqual(res.turnId, null);
  console.log('  ✓ Bootstrap + repaint → zero conversation events');
}

console.log('\n✨ ALL 7 COPILOT REDRAW REGRESSION SUITES PASSED (100% OK)\n');
