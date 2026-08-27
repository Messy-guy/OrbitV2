import { ISessionAdapter, OrbitSessionCapabilities, OrbitSessionMessage } from '../types';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class ClaudeAdapter implements ISessionAdapter {
  readonly provider = 'claude';
  readonly transport = 'native';

  getCapabilities(): OrbitSessionCapabilities {
    return {
      sendMessage: true,
      resume: true,
      history: true,
      approvals: true,
      fileChanges: true,
      structuredEvents: true,
    };
  }

  async getHistory(agentId: string, workspacePath?: string, nativeSessionId?: string): Promise<OrbitSessionMessage[]> {
    if (isTauriAvailable()) {
      try {
        const raw = await tauriService.getAgentTerminalHistory(agentId);
        if (raw && raw.trim().length > 0) {
          return this.parseClaudeHistory(raw, agentId);
        }
      } catch {}
    }
    return [];
  }

  async sendMessage(agentId: string, message: string, workspacePath?: string, nativeSessionId?: string): Promise<void> {
    if (isTauriAvailable()) {
      await tauriService.sendAgentInput(agentId, nativeSessionId || 'default', `${message}\r`);
    }
  }

  async resumeSession(agentId: string, nativeSessionId: string, workspacePath?: string): Promise<void> {
    if (isTauriAvailable() && workspacePath) {
      await tauriService.startAgentSession(
        workspacePath,
        agentId,
        nativeSessionId,
        'claude',
        undefined,
        undefined,
        undefined
      );
    }
  }

  private parseClaudeHistory(rawHistory: string, agentId: string): OrbitSessionMessage[] {
    const cleanStr = rawHistory
      .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
      .replace(/\[\?2026[hl]/g, '')
      .replace(/\[\?25[hl]/g, '')
      .replace(/\[\d+;\d+[Hfm]/g, '')
      .replace(/\[\d+m/g, '')
      .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
      .trim();

    const lines = cleanStr.split('\n').map((l) => l.trim()).filter(Boolean);
    const messages: OrbitSessionMessage[] = [];
    let currentBlock: string[] = [];
    let currentSender: 'user' | 'agent' = 'agent';
    let blockIndex = 0;

    for (const line of lines) {
      if (line.startsWith('>') || line.startsWith('❯') || line.startsWith('Claude:')) {
        if (currentBlock.length > 0) {
          messages.push({
            id: `claude-${agentId}-${blockIndex++}`,
            agentId,
            sender: currentSender,
            content: currentBlock.join('\n'),
            timestamp: Date.now() - (lines.length - blockIndex) * 1000,
          });
          currentBlock = [];
        }
        currentSender = line.startsWith('Claude:') ? 'agent' : 'user';
        currentBlock.push(line.replace(/^[>❯]\s*|^Claude:\s*/, ''));
      } else {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      messages.push({
        id: `claude-${agentId}-${blockIndex++}`,
        agentId,
        sender: currentSender,
        content: currentBlock.join('\n'),
        timestamp: Date.now(),
      });
    }

    return messages;
  }
}
