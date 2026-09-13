import { HandoffPayload, OrbitSession } from '../types.js';
import { getGitContext } from '../context/git.js';
import { readProjectMemory } from '../context/memory.js';

export class HandoffEngine {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  public createHandoff(
    fromSession: OrbitSession,
    toSession: OrbitSession,
    customTask?: string
  ): HandoffPayload {
    const git = getGitContext(this.cwd);
    const memory = readProjectMemory(this.cwd);

    const payload: HandoffPayload = {
      fromSessionId: fromSession.id,
      fromProvider: fromSession.provider,
      toSessionId: toSession.id,
      toProvider: toSession.provider,
      taskSummary: customTask || `Handoff from ${fromSession.provider} (${fromSession.name}) to ${toSession.provider} (${toSession.name})`,
      decisions: memory.decisions.slice(-5),
      modifiedFiles: git.modifiedFiles,
      gitBranch: git.branch,
      gitDiffSummary: git.diffSummary,
      blockers: memory.blockers.slice(-5),
      timestamp: new Date().toISOString()
    };

    return payload;
  }

  public formatHandoffPrompt(payload: HandoffPayload): string {
    let prompt = `\n--- [ORBIT CROSS-AGENT HANDOFF] ---\n`;
    prompt += `Origin Agent: ${payload.fromProvider} (${payload.fromSessionId})\n`;
    prompt += `Task: ${payload.taskSummary}\n`;
    prompt += `Git Branch: ${payload.gitBranch}\n`;

    if (payload.modifiedFiles.length > 0) {
      prompt += `Modified Files:\n${payload.modifiedFiles.map((f) => `  - ${f}`).join('\n')}\n`;
    }

    if (payload.decisions.length > 0) {
      prompt += `Recent Decisions:\n${payload.decisions.map((d) => `  - ${d}`).join('\n')}\n`;
    }

    if (payload.gitDiffSummary && payload.gitDiffSummary !== 'No staged/unstaged diff') {
      prompt += `Git Diff Summary:\n${payload.gitDiffSummary}\n`;
    }

    if (payload.blockers.length > 0) {
      prompt += `Blockers / Open Issues:\n${payload.blockers.map((b) => `  - ${b}`).join('\n')}\n`;
    }

    prompt += `Please inspect the current workspace state and continue from where ${payload.fromProvider} left off.\n`;
    prompt += `------------------------------------\n`;

    return prompt;
  }
}
