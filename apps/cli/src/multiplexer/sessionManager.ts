import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { OrbitSession, AgentProvider } from '../types.js';
import { getProjectOrbitDir } from '../context/memory.js';

export const PROVIDER_COMMANDS: Record<AgentProvider, string[]> = {
  claude: ['claude'],
  codex: ['codex'],
  opencode: ['opencode'],
  agy: ['agy', 'antigravity'],
  gemini: ['gemini'],
  aider: ['aider'],
  kilo: ['kilo', 'kilocode'],
  custom: ['bash']
};

export class SessionManager {
  private cwd: string;
  private sessionFile: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.sessionFile = path.join(getProjectOrbitDir(cwd), 'sessions.json');
  }

  public detectAvailableProviders(): Array<{ provider: AgentProvider; executable: string }> {
    const available: Array<{ provider: AgentProvider; executable: string }> = [];

    for (const [provider, binaries] of Object.entries(PROVIDER_COMMANDS)) {
      for (const bin of binaries) {
        try {
          const resolved = execSync(`which ${bin}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
          if (resolved) {
            available.push({ provider: provider as AgentProvider, executable: resolved });
            break;
          }
        } catch {}
      }
    }

    if (!available.some((a) => a.provider === 'custom')) {
      available.push({ provider: 'custom', executable: '/bin/bash' });
    }

    return available;
  }

  public listSessions(): OrbitSession[] {
    if (!fs.existsSync(this.sessionFile)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.sessionFile, 'utf8');
      const sessions: OrbitSession[] = JSON.parse(content);
      
      // Update process running status
      return sessions.map((s) => {
        if (s.pid) {
          try {
            // Check if PID is still alive
            process.kill(s.pid, 0);
            return s;
          } catch {
            return { ...s, status: 'stopped' };
          }
        }
        return s;
      });
    } catch {
      return [];
    }
  }

  public saveSessions(sessions: OrbitSession[]) {
    fs.writeFileSync(this.sessionFile, JSON.stringify(sessions, null, 2), 'utf8');
  }

  public createSession(provider: AgentProvider, name: string, customExecutable?: string, args: string[] = []): OrbitSession {
    const available = this.detectAvailableProviders();
    const found = available.find((a) => a.provider === provider);
    const executable = customExecutable || (found ? found.executable : provider);

    const session: OrbitSession = {
      id: `${provider}-${Date.now().toString(36)}`,
      name: name || `${provider}-session`,
      provider,
      executable,
      args,
      cwd: this.cwd,
      status: 'idle',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };

    const sessions = this.listSessions();
    sessions.push(session);
    this.saveSessions(sessions);
    return session;
  }

  public getSession(idOrName: string): OrbitSession | undefined {
    const sessions = this.listSessions();
    return sessions.find((s) => s.id === idOrName || s.name.toLowerCase() === idOrName.toLowerCase());
  }

  public removeSession(id: string): boolean {
    const sessions = this.listSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length !== sessions.length) {
      this.saveSessions(filtered);
      return true;
    }
    return false;
  }

  public updateSessionStatus(id: string, status: OrbitSession['status'], pid?: number) {
    const sessions = this.listSessions();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sessions[idx].status = status;
      if (pid !== undefined) sessions[idx].pid = pid;
      sessions[idx].lastActiveAt = new Date().toISOString();
      this.saveSessions(sessions);
    }
  }
}
