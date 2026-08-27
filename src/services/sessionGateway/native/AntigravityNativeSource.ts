import { isTauriAvailable } from '../../tauri.service';
import { OrbitSessionMessage } from '../types';

export class AntigravityNativeSource {
  static async loadHistory(_agentId: string, _workspacePath?: string): Promise<OrbitSessionMessage[]> {
    if (!isTauriAvailable()) return [];

    // Native transcript discovery for AGY
    return [];
  }
}
