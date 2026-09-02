// Tracks when each agent's PTY process was (re)spawned, so PTY delivery can treat
// long-running sessions differently from freshly-spawned ones:
//   - Established process (older than the startup window) → messages deliver
//     INSTANTLY (remote control must not add latency to a ready agent).
//   - Fresh spawn → short best-effort readiness gate while the TUI mounts.
// Kept as a tiny standalone module (no store imports) to avoid import cycles —
// it is written by tauri.service (the single funnel for every startAgentSession
// call) and read by remoteControl/ptyDelivery.
const spawnTimes = new Map<string, number>();

/** Record the moment an agent's PTY process started. */
export function markPtySpawn(agentId: string): void {
  if (agentId) spawnTimes.set(agentId, Date.now());
}

/** Milliseconds since the agent's PTY process started, or null if unknown. */
export function getPtySpawnAgeMs(agentId: string): number | null {
  const t = spawnTimes.get(agentId);
  if (t === undefined) return null;
  return Date.now() - t;
}

/** True when the process is older than `minAgeMs` (i.e. past its startup window). */
export function isPtyEstablished(agentId: string, minAgeMs: number): boolean {
  const age = getPtySpawnAgeMs(agentId);
  return age !== null && age >= minAgeMs;
}
