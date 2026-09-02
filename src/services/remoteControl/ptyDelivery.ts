import { useAgentStore } from '../../stores/agent.store';
import { isTauriAvailable, tauriService } from '../tauri.service';
import { AgentInteractionProfile, FormattedSubmission } from './types';
import { isPtyEstablished } from './ptySpawnTracker';

// A full-screen TUI agent (Mimo, Vibe, Freebuff, …) takes ~1-2s to mount its own
// input box after the PTY process starts. Writing a message into it during the
// splash swallows the keystrokes and the agent appears frozen. Delivery gates ONLY
// on that startup window: an established, already-ready agent must receive messages
// INSTANTLY (zero added latency — remote control is expected to be immediate).
const READY_POLL_INTERVAL_MS = 120;
const READY_MAX_WAIT_MS = 3000; // best-effort cap; delivery proceeds on timeout
const ESTABLISHED_PROCESS_MS = 4000; // past this age, never gate — deliver instantly

/**
 * Best-effort readiness gate for a PTY-interactive agent's input surface.
 *
 * FAST PATH FIRST: check readiness immediately — an agent that has been running
 * (input box live for minutes) returns instantly with zero added latency. Only a
 * freshly-spawned TUI whose splash is still up falls through to a short poll, and
 * even that is capped: delivery always proceeds (never holds a user message
 * hostage), so worst-case latency is bounded to the cap and applies only to
 * agents in their first seconds of startup.
 *
 * Returns immediately when there is no Tauri runtime (web/mock) or the profile
 * has no `isReady` predicate.
 */
export async function waitForAgentReady(
  agentId: string,
  profile: AgentInteractionProfile
): Promise<void> {
  if (typeof profile.isReady !== 'function') return;
  if (!isTauriAvailable()) return;

  // Established process (running for a while): never gate — the TUI mounted long
  // ago, so deliver instantly regardless of whether the readiness heuristic can
  // parse its output. This is what keeps remote messages instant.
  if (isPtyEstablished(agentId, ESTABLISHED_PROCESS_MS)) return;

  // Fast path — freshly spawned but already showing its input surface.
  if (await isAgentReady(agentId, profile)) return;

  // Slow path — TUI still mounting its splash; poll briefly, then proceed anyway.
  const deadline = Date.now() + READY_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
    if (await isAgentReady(agentId, profile)) return;
  }
}

async function isAgentReady(agentId: string, profile: AgentInteractionProfile): Promise<boolean> {
  if (typeof profile.isReady !== 'function') return true;

  // Primary signal: the agent store's live terminal log buffer.
  const latest = useAgentStore.getState().terminalLogs[agentId];
  if (latest && latest.length > 0) {
    const tail = latest.slice(-12).map((l) => l.text).join('\n');
    if (profile.isReady(tail)) return true;
  }

  // Fallback: authoritative PTY history from the Rust runtime.
  try {
    const history = await tauriService.getAgentTerminalHistory(agentId).catch(() => '');
    if (history && history.length > 0 && profile.isReady(history)) return true;
  } catch {
    /* ignore read failures; fall through to timeout */
  }

  return false;
}

/**
 * Deliver a formatted PTY submission with the profile's submit strategy.
 *
 * Profiles may opt into paced typing via `interKeyDelayMs` (for TUI input state
 * machines that coalesce bursts). Pacing is CHUNKED, not per-character: a fixed
 * slice of characters is written per beat so total typing latency stays bounded
 * (a 300-char message at 12ms/chunk-beat ≈ 180ms, not 3.6s). Everything else is
 * written as a single burst. The submit key (`\r` / `\n`) is ALWAYS sent — without
 * it the text merely sits unsubmitted in the agent's input box and the agent
 * looks frozen (the original "Mimo stuck" desktop-chat bug).
 */
const PACED_CHUNK_CHARS = 20;
const WRITE_RETRY_DELAY_MS = 150;

async function sendInputWithRetry(agentId: string, sessionId: string, data: string): Promise<void> {
  try {
    await tauriService.sendAgentInput(agentId, sessionId, data);
  } catch (first) {
    // One bounded retry — a transient contention/teardown hiccup must not
    // silently drop a user's message. A real failure rethrows below.
    await new Promise((r) => setTimeout(r, WRITE_RETRY_DELAY_MS));
    try {
      await tauriService.sendAgentInput(agentId, sessionId, data);
    } catch (second) {
      throw second instanceof Error ? second : new Error(String(second ?? first));
    }
  }
}

export async function deliverPtySubmission(
  agentId: string,
  sessionId: string,
  submission: FormattedSubmission,
  profile: AgentInteractionProfile
): Promise<void> {
  if (profile.interKeyDelayMs && profile.interKeyDelayMs > 0) {
    const payload = submission.payload;
    for (let i = 0; i < payload.length; i += PACED_CHUNK_CHARS) {
      await sendInputWithRetry(agentId, sessionId, payload.slice(i, i + PACED_CHUNK_CHARS));
      await new Promise((r) => setTimeout(r, profile.interKeyDelayMs!));
    }
  } else {
    await sendInputWithRetry(agentId, sessionId, submission.payload);
  }

  if (submission.preSubmitDelayMs && submission.preSubmitDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, submission.preSubmitDelayMs));
  }

  await sendInputWithRetry(agentId, sessionId, submission.submitKey);
}

/**
 * One-shot convenience: wait for readiness, then format + deliver `message` to the
 * agent's PTY using its interaction profile (submit key included).
 */
export async function deliverMessageToPty(
  agentId: string,
  sessionId: string,
  message: string,
  profile: AgentInteractionProfile
): Promise<void> {
  await waitForAgentReady(agentId, profile);
  const submission = profile.formatSubmission(message);
  await deliverPtySubmission(agentId, sessionId, submission, profile);
}
