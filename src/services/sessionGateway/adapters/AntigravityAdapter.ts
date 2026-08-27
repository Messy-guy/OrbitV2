import { ISessionAdapter, OrbitSessionCapabilities, OrbitSessionMessage } from '../types';
import { isTauriAvailable, tauriService } from '../../tauri.service';

export class AntigravityAdapter implements ISessionAdapter {
  readonly provider = 'antigravity';
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
    const messages: OrbitSessionMessage[] = [];

    if (isTauriAvailable()) {
      try {
        const rawHistory = await tauriService.getAgentTerminalHistory(agentId);
        if (rawHistory && rawHistory.trim().length > 0) {
          return this.parseAgyHistory(rawHistory, agentId);
        }
      } catch (err) {
        console.warn('[AntigravityAdapter] getAgentTerminalHistory note:', err);
      }
    }

    return messages;
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
        'antigravity',
        undefined,
        undefined,
        undefined
      );
    }
  }

  private parseAgyHistory(rawHistory: string, agentId: string): OrbitSessionMessage[] {
    const cleanStr = rawHistory
      .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
      .replace(/\x1B\([B0-9]/g, '')
      .replace(/\[\?2026[hl]/g, '')
      .replace(/\[\?25[hl]/g, '')
      .replace(/\[\d+;\d+[Hfm]/g, '')
      .replace(/\[\d+m/g, '')
      .replace(/\[\d+;\d+m/g, '')
      .replace(/\[\d+;\d+;\d+m/g, '')
      .replace(/\[\d+;\d+;\d+;\d+m/g, '')
      .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
      .trim();

    // Filter out TUI welcome banners, splash text, box-drawing characters, and shortcuts
    const lines = cleanStr
      .split('\n')
      .map((l) => l.trim())
      .filter((line) => {
        if (!line) return false;
        if (line.includes('Ask anything') || line.includes('Tip Press ctrl+b') || line.includes('OpenCode') || line.includes('Agnes Ai') || line.includes('Plan mode:')) return false;
        if (/^[|_\-—=█▀▄▌▐░▒▓#+*~\s]+$/.test(line)) return false;
        if (line.includes('tab agents') || line.includes('ctrl+p commands')) return false;
        return true;
      });

    const messages: OrbitSessionMessage[] = [];
    let currentBlock: string[] = [];
    let currentSender: 'user' | 'agent' = 'agent';
    let blockIndex = 0;

    for (const line of lines) {
      if (line.startsWith('>') || line.startsWith('❯') || line.startsWith('$ ') || line.startsWith('User:')) {
        if (currentBlock.length > 0) {
          messages.push({
            id: `agy-${agentId}-${blockIndex++}`,
            agentId,
            sender: currentSender,
            content: currentBlock.join('\n'),
            timestamp: Date.now() - (lines.length - blockIndex) * 1000,
          });
          currentBlock = [];
        }
        currentSender = 'user';
        currentBlock.push(line.replace(/^[>❯$]\s*|^User:\s*/, ''));
      } else {
        if (currentSender === 'user' && currentBlock.length > 0) {
          messages.push({
            id: `agy-${agentId}-${blockIndex++}`,
            agentId,
            sender: 'user',
            content: currentBlock.join('\n'),
            timestamp: Date.now() - (lines.length - blockIndex) * 1000,
          });
          currentBlock = [];
          currentSender = 'agent';
        }
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      messages.push({
        id: `agy-${agentId}-${blockIndex++}`,
        agentId,
        sender: currentSender,
        content: currentBlock.join('\n'),
        timestamp: Date.now(),
      });
    }

    return messages;
  }
}
