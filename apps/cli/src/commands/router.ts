import { SessionManager } from '../multiplexer/sessionManager.js';
import { SkillRegistry } from '../skills/registry.js';
import { SkillProjector } from '../skills/projector.js';
import { HandoffEngine } from '../handoff/engine.js';
import { getGitContext } from '../context/git.js';
import { readProjectMemory } from '../context/memory.js';
import { getProjectHealthSnapshot } from '../context/health.js';
import { AgentProvider, OrbitSession } from '../types.js';

export interface CommandResult {
  handled: boolean;
  message?: string;
  action?: 'switch' | 'new' | 'detach' | 'exit' | 'handoff';
  targetSession?: OrbitSession;
}

export class CommandRouter {
  private sessionManager: SessionManager;
  private skillRegistry: SkillRegistry;
  private skillProjector: SkillProjector;
  private handoffEngine: HandoffEngine;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.sessionManager = new SessionManager(cwd);
    this.skillRegistry = new SkillRegistry(cwd);
    this.skillProjector = new SkillProjector(cwd);
    this.handoffEngine = new HandoffEngine(cwd);
  }

  public isOrbitCommand(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return false;
    const cmd = trimmed.slice(1).split(/\s+/)[0].toLowerCase();
    return [
      'sessions',
      'new',
      'switch',
      'skills',
      'context',
      'health',
      'handoff',
      'status',
      'detach',
      'help',
      'orbit'
    ].includes(cmd);
  }

  public async handleCommand(input: string, currentSession?: OrbitSession): Promise<CommandResult> {
    const trimmed = input.trim();
    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'sessions': {
        const sessions = this.sessionManager.listSessions();
        if (sessions.length === 0) {
          return { handled: true, message: 'No active sessions found. Use `/new <agent> [name]` to launch one.' };
        }
        let out = '\n  Active Orbit Sessions:\n';
        sessions.forEach((s, idx) => {
          const isCurr = currentSession && currentSession.id === s.id ? ' (active)' : '';
          const dot = s.status === 'working' ? '● working' : s.status === 'idle' ? '○ idle' : '⨯ stopped';
          out += `  ${idx + 1}. [${s.provider}] ${s.name} ${dot}${isCurr}\n`;
        });
        return { handled: true, message: out };
      }

      case 'new': {
        const provider = (args[0] || 'claude').toLowerCase() as AgentProvider;
        const name = args[1] || `${provider}-${Math.floor(Math.random() * 1000)}`;
        const session = this.sessionManager.createSession(provider, name);
        return {
          handled: true,
          message: `Created session ${session.name} (${session.provider}). Switching...`,
          action: 'new',
          targetSession: session
        };
      }

      case 'switch': {
        const target = args[0];
        if (!target) {
          return { handled: true, message: 'Usage: /switch <session-id or name>' };
        }
        const session = this.sessionManager.getSession(target);
        if (!session) {
          return { handled: true, message: `Session '${target}' not found. Run /sessions to see available sessions.` };
        }
        return {
          handled: true,
          message: `Switching to ${session.name}...`,
          action: 'switch',
          targetSession: session
        };
      }

      case 'skills': {
        const sub = args[0]?.toLowerCase();
        if (sub === 'enable' && args[1]) {
          const skillId = args[1];
          const ok = this.skillRegistry.setSkillEnabled(skillId, true);
          if (ok) {
            const allSkills = this.skillRegistry.listSkills();
            const projected = this.skillProjector.projectSkills(allSkills);
            return { handled: true, message: `Enabled skill '${skillId}' and projected to: ${projected.join(', ')}` };
          }
          return { handled: true, message: `Skill '${skillId}' not found.` };
        }

        if (sub === 'disable' && args[1]) {
          const skillId = args[1];
          const ok = this.skillRegistry.setSkillEnabled(skillId, false);
          if (ok) {
            const allSkills = this.skillRegistry.listSkills();
            const projected = this.skillProjector.projectSkills(allSkills);
            return { handled: true, message: `Disabled skill '${skillId}' and updated projected files.` };
          }
          return { handled: true, message: `Skill '${skillId}' not found.` };
        }

        const skills = this.skillRegistry.listSkills();
        let out = '\n  Universal Skill Registry:\n';
        skills.forEach((s) => {
          const box = s.enabled ? '[x]' : '[ ]';
          out += `  ${box} ${s.name} (${s.id}) - ${s.description}\n`;
        });
        out += `\n  Usage: /skills enable <id> | /skills disable <id>\n`;
        return { handled: true, message: out };
      }

      case 'context': {
        const git = getGitContext(this.cwd);
        const memory = readProjectMemory(this.cwd);
        let out = `\n  Project Context:\n`;
        out += `  - Git Branch: ${git.branch}\n`;
        out += `  - Head Commit: ${git.headCommit}\n`;
        out += `  - Modified Files: ${git.modifiedFiles.length} file(s)\n`;
        if (git.modifiedFiles.length > 0) {
          git.modifiedFiles.forEach((f) => {
            out += `      • ${f}\n`;
          });
        }
        if (memory.decisions.length > 0) {
          out += `  - Active Decisions:\n`;
          memory.decisions.slice(-3).forEach((d) => {
            out += `      • ${d}\n`;
          });
        }
        return { handled: true, message: out };
      }

      case 'health': {
        const snap = getProjectHealthSnapshot(this.cwd);
        let out = `\n  ======================================================\n`;
        out += `  ORBIT PROJECT HEALTH SNAPSHOT\n`;
        out += `  ======================================================\n`;
        out += `  • Project: ${snap.projectName} (${snap.projectPath})\n`;
        out += `  • Git Branch: ${snap.gitBranch} @ ${snap.gitHead}\n`;
        out += `  • Working Tree: ${snap.workingTreeStatus.diffSummary}\n`;
        if (snap.techStack.length > 0) {
          out += `  • Tech Stack: ${snap.techStack.map((t) => `${t.name} (${t.category})`).join(', ')}\n`;
        }
        if (snap.relevantDirectories.length > 0) {
          out += `  • Directories: ${snap.relevantDirectories.join(', ')}\n`;
        }
        out += `  • Active Task: ${snap.activeTask}\n`;
        if (snap.completedWork.length > 0) {
          out += `  • Completed Work:\n`;
          snap.completedWork.forEach((w) => {
            out += `      ✓ ${w}\n`;
          });
        }
        if (snap.architecturalDecisions.length > 0) {
          out += `  • Architectural Decisions:\n`;
          snap.architecturalDecisions.forEach((d) => {
            out += `      • [${d.id}] ${d.decision}\n`;
          });
        }
        if (snap.unresolvedIssues.length > 0) {
          out += `  • Unresolved Issues:\n`;
          snap.unresolvedIssues.forEach((i) => {
            out += `      ⚠ [${i.id}] ${i.issue}\n`;
          });
        }
        if (snap.verifiedChangedFiles.length > 0) {
          out += `  • Verified Changed Files: ${snap.verifiedChangedFiles.length} file(s)\n`;
          snap.verifiedChangedFiles.slice(0, 5).forEach((f) => {
            out += `      📄 ${f.path} [${f.verificationLevel}]\n`;
          });
        }
        out += `  ======================================================\n`;
        return { handled: true, message: out };
      }

      case 'handoff': {
        if (!currentSession) {
          return { handled: true, message: 'Handoff requires an active origin session.' };
        }
        const targetName = args[0];
        if (!targetName) {
          return { handled: true, message: 'Usage: /handoff <target-session-name-or-agent>' };
        }
        const targetSession = this.sessionManager.getSession(targetName);
        if (!targetSession) {
          return { handled: true, message: `Target session '${targetName}' not found.` };
        }

        const payload = this.handoffEngine.createHandoff(currentSession, targetSession);
        const prompt = this.handoffEngine.formatHandoffPrompt(payload);
        return {
          handled: true,
          message: prompt,
          action: 'handoff',
          targetSession
        };
      }

      case 'detach': {
        return {
          handled: true,
          message: 'Detaching session...',
          action: 'detach'
        };
      }

      case 'status': {
        const git = getGitContext(this.cwd);
        const sessions = this.sessionManager.listSessions();
        const activeCount = sessions.filter((s) => s.status !== 'stopped').length;
        let out = `\n  Orbit System Status:\n`;
        out += `  - Project CWD: ${this.cwd}\n`;
        out += `  - Git Branch: ${git.branch}\n`;
        out += `  - Active Sessions: ${activeCount} / ${sessions.length}\n`;
        return { handled: true, message: out };
      }

      case 'help':
      default: {
        let out = `\n  Orbit Control Layer Commands:\n`;
        out += `  /sessions                List all active agent sessions\n`;
        out += `  /new <agent> [name]      Launch a new real CLI session\n`;
        out += `  /switch <name>           Switch active session view\n`;
        out += `  /skills                  List universal skills\n`;
        out += `  /skills enable <id>      Enable skill and project to CLI configs\n`;
        out += `  /context                 Show consolidated git & memory context\n`;
        out += `  /handoff <target>        Perform cross-agent context handoff\n`;
        out += `  /status                  Show system status\n`;
        out += `  /detach                  Detach to Orbit session picker\n`;
        out += `  /help                    Show this help message\n`;
        return { handled: true, message: out };
      }
    }
  }
}
