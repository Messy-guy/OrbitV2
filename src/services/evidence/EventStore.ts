import { OrbitEvent, OrbitEventType } from '../../types/events';
import { isTauriAvailable, tauriService } from '../tauri.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export { slugifyProjectName, getCanonicalProjectSlug, resolveProjectSlug } from './projectSlug';

export class EventStore {
  /**
   * Resolves the canonical base directory for a project's event store:
   * ~/.orbit/projects/<projectSlug>/
   */
  static getProjectDir(projectSlug: string): string {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir() || '.';
    return path.join(home, '.orbit', 'projects', projectSlug);
  }

  static getEventsFilePath(projectSlug: string): string {
    return path.join(this.getProjectDir(projectSlug), 'events.jsonl');
  }

  static getQuarantineDir(projectSlug: string): string {
    return path.join(this.getProjectDir(projectSlug), '.corrupted_events');
  }

  /**
   * Parse and validate raw JSONL content with crash recovery for partial trailing lines.
   * If the final line is incomplete, it is quarantined and omitted from returned events.
   */
  static recoverAndLoadEvents(
    rawJsonl: string,
    onCorruptedLine?: (corruptedLine: string, error: Error) => void
  ): OrbitEvent[] {
    if (!rawJsonl || !rawJsonl.trim()) return [];

    const lines = rawJsonl.split('\n');
    const events: OrbitEvent[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line) as OrbitEvent;
        if (!parsed.eventId || !parsed.type || typeof parsed.timestamp !== 'number') {
          throw new Error('Missing required event fields (eventId, type, timestamp)');
        }
        events.push(parsed);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        // If this is the trailing line or corrupt line, quarantine it
        if (onCorruptedLine) {
          onCorruptedLine(line, error);
        }
      }
    }

    return events;
  }

  /**
   * Appends an immutable event to events.jsonl atomically
   */
  static async appendEvent<T = unknown>(projectSlug: string, event: OrbitEvent<T>): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    const filePath = this.getEventsFilePath(projectSlug);
    const dir = path.dirname(filePath);

    // 1. In Tauri environment, execute atomic ledger append in Rust
    if (isTauriAvailable()) {
      try {
        const ok = await tauriService.appendProjectEvent(projectSlug, line);
        if (ok) return;
      } catch (e) {
        console.error(`[EventStore] Failed to append event ${event.eventId} via Tauri appendProjectEvent:`, e);
      }
    }

    // 2. In Node runtime (test runner / CLI scripts), use atomic appendFile
    if (typeof fs !== 'undefined' && fs.promises) {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.appendFile(filePath, line, 'utf8');
        return;
      } catch (e) {
        console.error(`[EventStore] Failed to append event via fs:`, e);
      }
    }
  }

  /**
   * Reads all valid historical events for a project with crash recovery
   */
  static async getEvents(projectSlug: string): Promise<OrbitEvent[]> {
    const filePath = this.getEventsFilePath(projectSlug);
    let raw = '';

    if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(filePath)) {
      try {
        raw = fs.readFileSync(filePath, 'utf8');
      } catch {}
    } else if (isTauriAvailable()) {
      try {
        const res = await tauriService.readWorkspaceFile(path.dirname(filePath), path.basename(filePath));
        raw = res.content || '';
      } catch {}
    }

    if (!raw.trim()) return [];

    let hasCorrupted = false;
    let corruptedLineText = '';

    const events = this.recoverAndLoadEvents(raw, (corruptedLine) => {
      hasCorrupted = true;
      corruptedLineText = corruptedLine;
      console.warn(`[EventStore] Quarantining corrupted event line: "${corruptedLine.slice(0, 80)}..."`);
    });

    // If corruption was detected at the tail, write it to .corrupted_events
    if (hasCorrupted && corruptedLineText) {
      try {
        const quarantineDir = this.getQuarantineDir(projectSlug);
        const quarantineFile = path.join(quarantineDir, `corrupt_${Date.now()}.jsonl`);
        if (typeof fs !== 'undefined' && fs.promises) {
          await fs.promises.mkdir(quarantineDir, { recursive: true });
          await fs.promises.writeFile(quarantineFile, corruptedLineText, 'utf8');
        }
      } catch {}
    }

    return events;
  }

  /**
   * Queries events by type
   */
  static async getEventsByType(projectSlug: string, type: OrbitEventType): Promise<OrbitEvent[]> {
    const all = await this.getEvents(projectSlug);
    return all.filter((e) => e.type === type);
  }

  /**
   * Finds a specific event by ID
   */
  static async getEventById(projectSlug: string, eventId: string): Promise<OrbitEvent | undefined> {
    const all = await this.getEvents(projectSlug);
    return all.find((e) => e.eventId === eventId);
  }
}
