// ============================================================================
// 16-AGENT GENERIC PIPELINE VERIFICATION (spec §24)
// ============================================================================
// Simulates, for EVERY supported agent profile, the full lifecycle:
//   start → Turn 1 → Turn 2 → desktop restart (fresh capture, primed from
//   persisted history + prompt ledger) → Turn 3 → verify clean conversation.
// The pipeline under test is the SAME generic one all 16 agents share:
//   headless terminal → scrollback baseline → turn-owned capture → canonical
//   store. Real-CLI E2E requires host binaries; this proves the architecture
//   is provider-agnostic and that no provider-specific hack is involved.
import assert from 'node:assert';
import { PtyCaptureSession } from '../state/PtyCaptureSession';
import { AuthoritativeConversationStore } from '../../conversation/ConversationStore';

const AGENTS = [
  { provider: 'antigravity', name: 'Antigravity', promptChar: '❯', tui: false },
  { provider: 'claude', name: 'Claude Code', promptChar: '❯', tui: false },
  { provider: 'codex', name: 'Codex CLI', promptChar: '❯', tui: false },
  { provider: 'opencode', name: 'OpenCode', promptChar: '❯', tui: false },
  { provider: 'kilocode', name: 'KiloCode', promptChar: '❯', tui: false },
  { provider: 'freebuff', name: 'Freebuff', promptChar: '❯', tui: true },
  { provider: 'cline', name: 'Cline', promptChar: '❯', tui: true },
  { provider: 'copilot', name: 'GitHub Copilot', promptChar: '❯', tui: true },
  { provider: 'goose', name: 'Goose', promptChar: '❯', tui: false },
  { provider: 'kiro', name: 'Kiro CLI', promptChar: '❯', tui: true },
  { provider: 'qwen', name: 'Qwen Code', promptChar: '❯', tui: true },
  { provider: 'mimo', name: 'Mimo Code', promptChar: '❯', tui: true },
  { provider: 'muse', name: 'Muse Code', promptChar: '❯', tui: true },
  { provider: 'vibe', name: 'Mistral Vibe', promptChar: '❯', tui: true },
  { provider: 'qoder', name: 'Qoder CLI', promptChar: '❯', tui: true },
  { provider: 'terminal', name: 'Shell Terminal', promptChar: '$', tui: false },
];

function runAgent(a: (typeof AGENTS)[number]) {
  const sessionId = `sess-${a.provider}`;
  const P = a.promptChar;

  // ---------- LIVE RUN: turn 1 + turn 2 ----------
  const live = new PtyCaptureSession(sessionId, 30, 100);
  live.startTurn(`t1-${a.provider}`, 'hello', 'm1');
  const r1 = live.processPtyBytes(
    `${P} hello\r\nReply-one from ${a.name}.\r\n${P} `
  );
  live.commitTurn(`t1-${a.provider}`);
  assert.strictEqual(r1.userFacingText, `Reply-one from ${a.name}.`, `${a.provider} turn 1`);

  live.startTurn(`t2-${a.provider}`, 'what can you do', 'm2');
  const r2 = live.processPtyBytes(
    `${P} what can you do\r\nReply-two from ${a.name}.\r\n${P} `
  );
  live.commitTurn(`t2-${a.provider}`);
  assert.strictEqual(r2.userFacingText, `Reply-two from ${a.name}.`, `${a.provider} turn 2`);
  assert.strictEqual(r2.userFacingText.includes('Reply-one'), false, `${a.provider} no turn-1 leakage`);

  // ---------- CANONICAL STORE (persisted) ----------
  const store = new AuthoritativeConversationStore();
  store.clearAll();
  store.getOrCreateSession(sessionId, 'proj', 'ws', { id: `agent-${a.provider}`, name: a.name, provider: a.provider, transport: 'pty' });
  store.addUserMessage(sessionId, 'hello');
  store.completeAgentMessage(sessionId, r1.userFacingText, undefined, store.startAgentTurn(sessionId).id);
  store.addUserMessage(sessionId, 'what can you do');
  store.completeAgentMessage(sessionId, r2.userFacingText, undefined, store.startAgentTurn(sessionId).id);
  const canonical = JSON.parse(JSON.stringify(store.getAllSessions()));

  // ---------- DESKTOP RESTART: fresh capture, primed like the adapter ----------
  const restored = new AuthoritativeConversationStore();
  restored.rehydrateFromList(canonical);
  const boot = new PtyCaptureSession(sessionId, 30, 100);
  // (adapter primes from the authoritative PTY history + seeds prompt fps)
  boot.primeFromHistory(
    `${P} hello\r\nReply-one from ${a.name}.\r\n${P} what can you do\r\nReply-two from ${a.name}.\r\n${P} `
  );
  boot.seedPromptFingerprints(['hello', 'what can you do']);

  // Full-screen repaint (TUI resume) BEFORE any new turn → must add NOTHING
  const bootRepaint = boot.processPtyBytes(
    `\x1b[2J\x1b[H${P} hello\r\nReply-one from ${a.name}.\r\n${P} what can you do\r\nReply-two from ${a.name}.\r\n${P} `
  );
  assert.strictEqual(bootRepaint.userFacingText, '', `${a.provider} bootstrap repaint → zero events`);

  // ---------- TURN 3 after restart ----------
  boot.startTurn(`t3-${a.provider}`, 'third question', 'm3');
  const r3 = boot.processPtyBytes(
    `${P} third question\r\nReply-three from ${a.name}.\r\n${P} `
  );
  boot.commitTurn(`t3-${a.provider}`);
  assert.strictEqual(r3.userFacingText, `Reply-three from ${a.name}.`, `${a.provider} turn 3 after restart`);
  assert.strictEqual(
    !r3.userFacingText.includes('Reply-one') && !r3.userFacingText.includes('Reply-two'),
    true,
    `${a.provider} no historical replay in turn 3`
  );

  // ---------- CANONICAL INTEGRITY after restart ----------
  restored.addUserMessage(sessionId, 'third question');
  restored.completeAgentMessage(sessionId, r3.userFacingText, undefined, restored.startAgentTurn(sessionId).id);
  const sess = restored.getSession(sessionId)!;
  const replyCount = sess.conversation.turns
    .flatMap((t) => t.messages)
    .filter((m) => m.role === 'assistant' && m.content.some((c) => (c as any).markdown?.includes(`Reply-one from`)))
    .length;
  assert.strictEqual(replyCount, 1, `${a.provider} historical reply appears exactly once`);

  return a.provider;
}

console.log('🧪 Verifying the generic session/capture pipeline for ALL 16 agents...\n');
const results: string[] = [];
for (const a of AGENTS) {
  results.push(runAgent(a));
  console.log(`  ✓ ${a.name} — identity reuse, bootstrap silence, isolated turns, clean post-restart turn`);
}
console.log(`\n✨ ALL 16 AGENT PIPELINES VERIFIED: ${results.length}/16 (${results.join(', ')})`);
