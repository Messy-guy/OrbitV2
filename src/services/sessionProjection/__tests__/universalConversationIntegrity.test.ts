import assert from 'node:assert';
import { PtyCaptureSession } from '../state/PtyCaptureSession';
import { ScreenFingerprint } from '../state/ScreenFingerprint';
import { IncrementalOutputDiffer } from '../state/IncrementalOutputDiffer';
import { PtyConversationClassifier } from '../classification/PtyConversationClassifier';

console.log('🧪 Starting Universal CLI Conversation Integrity & Stateful PTY Capture Test Suite...\n');

// ----------------------------------------------------------------------------
// TEST 1: Single-Turn Response Capture
// ----------------------------------------------------------------------------
{
  console.log('Test 1: Single-Turn Response Capture');
  const session = new PtyCaptureSession('sess-1', 30, 100);
  
  session.startTurn('turn-1', 'Hello', 'msg-1');
  const result = session.processPtyBytes('> Hello\r\nHello! How can I help you today?\r\n> ');

  assert.strictEqual(result.userFacingText, 'Hello! How can I help you today?');
  assert.strictEqual(result.hasNewContent, true);
  session.commitTurn('turn-1');
  console.log('  ✓ Clean assistant response extracted without prompt echo');
}

// ----------------------------------------------------------------------------
// TEST 2: Multi-Turn Conversation Isolation (Zero Historical Leakage)
// ----------------------------------------------------------------------------
{
  console.log('Test 2: Multi-Turn Isolation (Zero Historical Leakage)');
  const session = new PtyCaptureSession('sess-2', 30, 100);

  // Turn 1
  session.startTurn('turn-1', 'Hello', 'msg-1');
  const res1 = session.processPtyBytes('> Hello\r\nHello! How can I help you today?\r\n> ');
  assert.strictEqual(res1.userFacingText, 'Hello! How can I help you today?');
  session.commitTurn('turn-1');

  // Turn 2
  session.startTurn('turn-2', 'Who are you', 'msg-2');
  const res2 = session.processPtyBytes('Who are you\r\nI am OpenCode, an open source AI coding agent.\r\n> ');
  assert.strictEqual(res2.userFacingText, 'I am OpenCode, an open source AI coding agent.');
  assert.strictEqual(res2.userFacingText.includes('Hello'), false, 'Turn 2 must NOT contain Turn 1 text');
  session.commitTurn('turn-2');

  // Turn 3
  session.startTurn('turn-3', 'What can you do?', 'msg-3');
  const res3 = session.processPtyBytes('What can you do?\r\nI can edit code, run tests, and debug errors.\r\n> ');
  assert.strictEqual(res3.userFacingText, 'I can edit code, run tests, and debug errors.');
  assert.strictEqual(res3.userFacingText.includes('OpenCode'), false, 'Turn 3 must NOT contain Turn 2 text');
  assert.strictEqual(res3.userFacingText.includes('Hello'), false, 'Turn 3 must NOT contain Turn 1 text');
  session.commitTurn('turn-3');

  console.log('  ✓ 3 consecutive turns isolated with zero historical leakage');
}

// ----------------------------------------------------------------------------
// TEST 3: Full Screen Redraw / Clear-and-Repaint (\x1b[2J\x1b[H)
// ----------------------------------------------------------------------------
{
  console.log('Test 3: Full-Screen Redraw Suppression');
  const session = new PtyCaptureSession('sess-3', 30, 100);

  // Turn 1
  session.startTurn('turn-1', 'Hello', 'msg-1');
  session.processPtyBytes('> Hello\r\nHello! How can I help you today?\r\n');
  session.commitTurn('turn-1');

  // Turn 2 starts
  session.startTurn('turn-2', 'Hi', 'msg-2');

  // CLI clears screen and redraws entire session history + new response
  const tuiRedraw = '\x1b[2J\x1b[H' +
    'OpenCode CLI v1.0\r\n' +
    '-----------------\r\n' +
    '> Hello\r\n' +
    'Hello! How can I help you today?\r\n' +
    '> Hi\r\n' +
    'Hi there! What are we building?\r\n' +
    '> ';

  const res = session.processPtyBytes(tuiRedraw);

  assert.strictEqual(res.userFacingText, 'Hi there! What are we building?');
  assert.strictEqual(res.userFacingText.includes('Hello'), false, 'Redrawn Turn 1 must NOT appear in Turn 2');
  assert.strictEqual(res.userFacingText.includes('OpenCode CLI'), false, 'Banner metadata must be filtered');
  session.commitTurn('turn-2');
  console.log('  ✓ Full-screen repaint suppression verified');
}

// ----------------------------------------------------------------------------
// TEST 4: Legitimate Repeated Output vs Repaint
// ----------------------------------------------------------------------------
{
  console.log('Test 4: Legitimate Repeated Output Preservation');
  const session = new PtyCaptureSession('sess-4', 30, 100);

  // Turn 1
  session.startTurn('turn-1', 'Run tests', 'msg-1');
  const res1 = session.processPtyBytes('> Run tests\r\nAll tests passed.\r\n> ');
  assert.strictEqual(res1.userFacingText, 'All tests passed.');
  session.commitTurn('turn-1');

  // Turn 2 generates the EXACT SAME response legitimately
  session.startTurn('turn-2', 'Run tests again', 'msg-2');
  const res2 = session.processPtyBytes('\r> Run tests again\r\nAll tests passed.\r\n> ');
  assert.strictEqual(res2.userFacingText, 'All tests passed.', 'Legitimate identical response must be captured');
  session.commitTurn('turn-2');

  // Late redraw without new generation
  const lateRedraw = session.processPtyBytes('\x1b[2J\x1b[HAll tests passed.\r\nAll tests passed.\r\n> ');
  assert.strictEqual(lateRedraw.userFacingText, '', 'Repaint of existing occurrences must be suppressed');
  console.log('  ✓ Multiset accounting differentiates legitimate repeats from redraws');
}

// ----------------------------------------------------------------------------
// TEST 5: Prompt Echo Variations & Prefixes
// ----------------------------------------------------------------------------
{
  console.log('Test 5: Prompt Echo Variations');
  const session = new PtyCaptureSession('sess-5', 30, 100);

  const prefixes = ['> ', '❯ ', '│ ', '$ ', ''];
  for (let i = 0; i < prefixes.length; i++) {
    const pfx = prefixes[i];
    session.startTurn(`turn-${i}`, 'Fix the login bug', `msg-${i}`);
    const res = session.processPtyBytes(`${pfx}Fix the login bug\r\nBug is resolved in auth.ts\r\n> `);
    assert.strictEqual(res.userFacingText, 'Bug is resolved in auth.ts');
    session.commitTurn(`turn-${i}`);
  }
  console.log('  ✓ All common CLI prompt prefixes suppressed from assistant prose');
}

// ----------------------------------------------------------------------------
// TEST 6: Thinking and Status Ephemeral Updates
// ----------------------------------------------------------------------------
{
  console.log('Test 6: Thinking and Status Updates');
  const session = new PtyCaptureSession('sess-6', 30, 100);

  session.startTurn('turn-1', 'Analyze performance', 'msg-1');
  const res = session.processPtyBytes(
    'Thought for 704ms\r\n' +
    'Thinking...\r\n' +
    'The bottleneck is in database indexing.\r\n'
  );

  assert.strictEqual(res.userFacingText, 'The bottleneck is in database indexing.');
  assert.strictEqual(Boolean(res.thought && (res.thought.includes('Thought for 704ms') || res.thought.includes('Thinking'))), true);
  session.commitTurn('turn-1');
  console.log('  ✓ Thinking steps extracted as structured activities, not prose pollution');
}

// ----------------------------------------------------------------------------
// TEST 7: Tool Activities & File Operations
// ----------------------------------------------------------------------------
{
  console.log('Test 7: Tool Activity Classification');
  const session = new PtyCaptureSession('sess-7', 30, 100);

  session.startTurn('turn-1', 'Refactor auth', 'msg-1');
  const res = session.processPtyBytes(
    'Reading src/auth.ts\r\n' +
    'Running cargo test\r\n' +
    'PASS src/auth.rs (12ms)\r\n' +
    'Authentication refactor complete.\r\n'
  );

  assert.strictEqual(res.userFacingText, 'Authentication refactor complete.');
  assert.strictEqual(res.activities.length >= 2, true);
  session.commitTurn('turn-1');
  console.log('  ✓ File reads, commands, and test passes converted to structured activities');
}

// ----------------------------------------------------------------------------
// TEST 8: Multiline Code & Markdown Formatting Preservation
// ----------------------------------------------------------------------------
{
  console.log('Test 8: Multiline Code & Markdown Preservation');
  const session = new PtyCaptureSession('sess-8', 30, 100);

  session.startTurn('turn-1', 'Show helper', 'msg-1');
  const markdownCode =
    'Here is the solution:\r\n' +
    '```typescript\r\n' +
    'export function computeTotal(a: number, b: number): number {\r\n' +
    '  // calculate sum\r\n' +
    '  return a + b;\r\n' +
    '}\r\n' +
    '```\r\n' +
    '- List item 1\r\n' +
    '- List item 2\r\n';

  const res = session.processPtyBytes(markdownCode);

  assert.strictEqual(res.userFacingText.includes('computeTotal(a: number, b: number)'), true);
  assert.strictEqual(res.userFacingText.includes('  return a + b;'), true, 'Code indentation must be preserved');
  assert.strictEqual(res.userFacingText.includes('- List item 1'), true, 'Markdown lists must be preserved');
  session.commitTurn('turn-1');
  console.log('  ✓ Exact indentation, syntax, and markdown formatting preserved');
}

// ----------------------------------------------------------------------------
// TEST 9: Streaming Chunk Assembly
// ----------------------------------------------------------------------------
{
  console.log('Test 9: Streaming Chunk Assembly');
  const session = new PtyCaptureSession('sess-9', 30, 100);

  session.startTurn('turn-1', 'Stream greeting', 'msg-1');
  const chunk1 = session.processPtyBytes('Hello');
  const chunk2 = session.processPtyBytes(', how');
  const chunk3 = session.processPtyBytes(' can I help?');

  assert.strictEqual(chunk3.userFacingText, 'Hello, how can I help?');
  session.commitTurn('turn-1');
  console.log('  ✓ Streaming text assembled monotonically without fragment duplication');
}

// ----------------------------------------------------------------------------
// TEST 10: Late PTY Output After Turn Commit
// ----------------------------------------------------------------------------
{
  console.log('Test 10: Late PTY Output After Commit');
  const session = new PtyCaptureSession('sess-10', 30, 100);

  session.startTurn('turn-1', 'Ping', 'msg-1');
  session.processPtyBytes('Pong\r\n> ');
  session.commitTurn('turn-1');

  // Redraw happens when no turn is active
  const late = session.processPtyBytes('\x1b[2J\x1b[HPong\r\n> ');
  assert.strictEqual(late.userFacingText, '', 'Late output without new turn must not produce text');
  console.log('  ✓ Late PTY redraws cannot resurrect completed turns');
}

// ----------------------------------------------------------------------------
// TEST 11: Alternate Screen Buffer Switches (\x1b[?1049h / \x1b[?1049l)
// ----------------------------------------------------------------------------
{
  console.log('Test 11: Alternate Screen Buffer Switches');
  const session = new PtyCaptureSession('sess-11', 30, 100);

  session.startTurn('turn-1', 'Open interactive view', 'msg-1');
  // Enter alternate screen, render TUI, output text, exit alternate screen
  const tuiStream = '\x1b[?1049h\x1b[H\x1b[2J' +
    '┌──────────────────────────────┐\r\n' +
    '│ KiloCode TUI View            │\r\n' +
    '└──────────────────────────────┘\r\n' +
    'Interactive session initialized.\r\n' +
    '\x1b[?1049l';

  const res = session.processPtyBytes(tuiStream);
  assert.strictEqual(res.userFacingText.includes('Interactive session initialized.'), true);
  assert.strictEqual(res.userFacingText.includes('┌───'), false, 'TUI borders must be stripped');
  session.commitTurn('turn-1');
  console.log('  ✓ Alternate screen buffer switches handled cleanly');
}

// ----------------------------------------------------------------------------
// TEST 12: Assistant Quoting Previous User Message (Legitimate Context)
// ----------------------------------------------------------------------------
{
  console.log('Test 12: Assistant Quoting Previous User Message');
  const session = new PtyCaptureSession('sess-12', 30, 100);

  // Turn 1
  session.startTurn('turn-1', 'My name is Alice', 'msg-1');
  session.processPtyBytes('Nice to meet you Alice!\r\n> ');
  session.commitTurn('turn-1');

  // Turn 2: Assistant legitimately quotes "Alice" and "My name is Alice"
  session.startTurn('turn-2', 'Who am I?', 'msg-2');
  const res2 = session.processPtyBytes('\r> Who am I?\r\nYou mentioned earlier: "My name is Alice".\r\n> ');
  assert.strictEqual(res2.userFacingText, 'You mentioned earlier: "My name is Alice".');
  session.commitTurn('turn-2');
  console.log('  ✓ Legitimate assistant quotation of previous turns preserved');
}

// ----------------------------------------------------------------------------
// TEST 13: Prompt Wrapped Across Multiple Terminal Lines
// ----------------------------------------------------------------------------
{
  console.log('Test 13: Wrapped Multiline User Prompt Echo');
  const session = new PtyCaptureSession('sess-13', 30, 40); // 40 cols narrow screen

  const longPrompt = 'Please optimize the recursive Fibonacci algorithm to use dynamic programming memoization';
  session.startTurn('turn-1', longPrompt, 'msg-1');

  // Terminal wraps long prompt into 3 lines
  const wrappedTerminalOutput =
    '> Please optimize the recursive \r\n' +
    'Fibonacci algorithm to use dynamic \r\n' +
    'programming memoization\r\n' +
    'Here is the memoized version using Map.\r\n' +
    '> ';

  const res = session.processPtyBytes(wrappedTerminalOutput);
  assert.strictEqual(res.userFacingText, 'Here is the memoized version using Map.');
  session.commitTurn('turn-1');
  console.log('  ✓ Multiline wrapped user prompt suppressed from assistant output');
}

// ----------------------------------------------------------------------------
// TEST 14: Terminal Resizing
// ----------------------------------------------------------------------------
{
  console.log('Test 14: Terminal Resizing Stability');
  const session = new PtyCaptureSession('sess-14', 30, 100);

  session.startTurn('turn-1', 'Check status', 'msg-1');
  session.processPtyBytes('System is healthy.\r\n> ');
  session.commitTurn('turn-1');

  // Terminal resizes and repaints at new dimensions (e.g. 24x80)
  const resizedRepaint = '\x1b[8;24;80t\x1b[2J\x1b[HSystem is healthy.\r\n> ';
  const res = session.processPtyBytes(resizedRepaint);
  assert.strictEqual(res.userFacingText, '', 'Resize repaint must not duplicate output');
  console.log('  ✓ Terminal resize events do not leak duplicate messages');
}

console.log('\n✨ ALL 14 UNIVERSAL CONVERSATION INTEGRITY TEST SUITES PASSED (100% OK)\n');
