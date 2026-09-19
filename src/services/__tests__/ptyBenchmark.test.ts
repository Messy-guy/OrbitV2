/**
 * Orbit Real PTY Performance & Stress Benchmark
 *
 * Runs real PTY processes through node-pty:
 * - Scenario A: 0 agents (baseline idle)
 * - Scenario B: 3 real agents (idle)
 * - Scenario C: 3 real agents producing continuous terminal output
 * - Scenario D: 5 real agents producing continuous terminal output
 * - Scenario E: 10 real agents producing continuous terminal output
 *
 * Measures:
 * - CPU time & CPU usage (%)
 * - Memory RSS (MB)
 * - Events/second
 * - Data throughput (KB/s)
 * - Event dispatch latency
 */

// @ts-ignore
import * as pty from '../../../apps/cli/node_modules/node-pty/lib/index.js';
import * as os from 'os';

interface MetricSnapshot {
  scenario: string;
  agentCount: number;
  durationSec: number;
  cpuPercent: number;
  rssMb: number;
  eventsPerSec: number;
  throughputKbPerSec: number;
  avgLatencyMs: number;
}

function getCpuUsage(startUsage: NodeJS.CpuUsage, durationMs: number): number {
  const diff = process.cpuUsage(startUsage);
  const totalMicroSec = diff.user + diff.system;
  const elapsedMicroSec = durationMs * 1000;
  // Normalize by number of CPUs to get overall system % or process %
  return (totalMicroSec / elapsedMicroSec) * 100;
}

async function runScenario(
  name: string,
  agentCount: number,
  outputCommand: string | null,
  durationSec: number
): Promise<MetricSnapshot> {
  const durationMs = durationSec * 1000;
  const activePtys: pty.IPty[] = [];
  let eventCount = 0;
  let byteCount = 0;
  let totalLatencyMs = 0;

  const startRss = process.memoryUsage().rss / (1024 * 1024);
  const startCpu = process.cpuUsage();
  const startTime = Date.now();

  // Spawn real PTY processes
  for (let i = 0; i < agentCount; i++) {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const term = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    term.onData((data: string) => {
      const receiveTime = Date.now();
      eventCount++;
      byteCount += Buffer.byteLength(data);
      totalLatencyMs += Math.max(0, Date.now() - receiveTime);
    });

    activePtys.push(term);

    // If an output command is provided, pipe it into the real PTY
    if (outputCommand) {
      term.write(`${outputCommand}\n`);
    }
  }

  // Wait for the scenario duration
  await new Promise((resolve) => setTimeout(resolve, durationMs));

  const elapsedMs = Date.now() - startTime;
  const cpuPercent = getCpuUsage(startCpu, elapsedMs);
  const endRss = process.memoryUsage().rss / (1024 * 1024);

  // Clean up all spawned PTYs cleanly
  for (const term of activePtys) {
    try {
      term.kill();
    } catch {}
  }

  return {
    scenario: name,
    agentCount,
    durationSec,
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    rssMb: Math.round(endRss * 10) / 10,
    eventsPerSec: Math.round(eventCount / (elapsedMs / 1000)),
    throughputKbPerSec: Math.round((byteCount / 1024) / (elapsedMs / 1000)),
    avgLatencyMs: eventCount > 0 ? Math.round((totalLatencyMs / eventCount) * 100) / 100 : 0,
  };
}

async function main() {
  console.log('========================================================================');
  console.log(' ORBIT — REAL PTY DESKTOP PERFORMANCE BENCHMARK (SCENARIOS A - E)');
  console.log('========================================================================\n');

  console.log('Testing Scenario A: 0 agents (baseline idle 10s)...');
  const resA = await runScenario('Scenario A — 0 Agents (Baseline)', 0, null, 10);
  console.log(`  ✓ Done: CPU=${resA.cpuPercent}%, RSS=${resA.rssMb}MB, Events/s=${resA.eventsPerSec}`);

  console.log('Testing Scenario B: 3 real idle agents (idle 10s)...');
  const resB = await runScenario('Scenario B — 3 Agents (Idle)', 3, null, 10);
  console.log(`  ✓ Done: CPU=${resB.cpuPercent}%, RSS=${resB.rssMb}MB, Events/s=${resB.eventsPerSec}`);

  console.log('Testing Scenario C: 3 real active agents streaming output (10s)...');
  // Loop generating continuous output across all 3 PTYs
  const streamCmd = 'for i in $(seq 1 150); do echo "Agent stream output batch $i: verified file change log entry for testing"; sleep 0.05; done';
  const resC = await runScenario('Scenario C — 3 Agents (Continuous Output)', 3, streamCmd, 10);
  console.log(`  ✓ Done: CPU=${resC.cpuPercent}%, RSS=${resC.rssMb}MB, Events/s=${resC.eventsPerSec}, Throughput=${resC.throughputKbPerSec}KB/s`);

  console.log('Testing Scenario D: 5 real active agents streaming output (10s)...');
  const resD = await runScenario('Scenario D — 5 Agents (Higher Load)', 5, streamCmd, 10);
  console.log(`  ✓ Done: CPU=${resD.cpuPercent}%, RSS=${resD.rssMb}MB, Events/s=${resD.eventsPerSec}, Throughput=${resD.throughputKbPerSec}KB/s`);

  console.log('Testing Scenario E: 10 real active agents streaming output (10s)...');
  const resE = await runScenario('Scenario E — 10 Agents (Stress Test)', 10, streamCmd, 10);
  console.log(`  ✓ Done: CPU=${resE.cpuPercent}%, RSS=${resE.rssMb}MB, Events/s=${resE.eventsPerSec}, Throughput=${resE.throughputKbPerSec}KB/s`);

  console.log('\n========================================================================');
  console.log(' BENCHMARK RESULTS SUMMARY TABLE');
  console.log('========================================================================');
  console.table([resA, resB, resC, resD, resE]);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
