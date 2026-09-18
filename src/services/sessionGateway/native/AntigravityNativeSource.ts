import { isTauriAvailable, tauriService } from '../../tauri.service';
import { OrbitSessionMessage } from '../types';
import { AgyAdapter } from '../../conversation/adapters/AgyAdapter';

export class AntigravityNativeSource {
  static async loadHistory(agentId: string, workspacePath?: string): Promise<OrbitSessionMessage[]> {
    if (!isTauriAvailable()) return [];

    try {
      const rawJsonl = await tauriService.getRecentAntigravityTranscript(workspacePath);
      if (!rawJsonl || !rawJsonl.trim()) return [];

      const canonicalTurns = AgyAdapter.parseNativeJsonl(rawJsonl, agentId);
      const messages: OrbitSessionMessage[] = [];

      for (const turn of canonicalTurns) {
        let text = '';
        for (const msg of turn.messages) {
          for (const item of msg.content) {
            if (item.type === 'text') text += (text ? '\n' : '') + (item.text || '');
            else if (item.type === 'markdown') text += (text ? '\n' : '') + (item.markdown || '');
          }
        }

        if (text.trim()) {
          messages.push({
            id: turn.id,
            agentId,
            sender: turn.role === 'user' ? 'user' : 'agent',
            content: text.trim(),
            timestamp: turn.startedAt || Date.now(),
          });
        }
      }

      return messages;
    } catch (e) {
      console.warn('Failed to load native Antigravity transcript:', e);
      return [];
    }
  }
}
