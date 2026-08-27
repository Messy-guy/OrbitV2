import { EngineAdapter } from './adapters/EngineAdapter';
import { acpAdapter } from './adapters/AcpAdapter';
import { jsonlAdapter } from './adapters/JsonlAdapter';
import { genericPtyAdapter } from './adapters/GenericPtyAdapter';
import { agyAdapter } from './adapters/AgyAdapter';
import { TransportType, EngineManifest } from '../../types/conversation';

class ProtocolRegistry {
  private adapters: Map<string, EngineAdapter> = new Map();

  constructor() {
    this.registerAdapter(acpAdapter);
    this.registerAdapter(jsonlAdapter);
    this.registerAdapter(genericPtyAdapter);
    this.registerAdapter(agyAdapter);
  }

  registerAdapter(adapter: EngineAdapter) {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  getAdapterForTransport(transport: TransportType): EngineAdapter {
    const found = this.adapters.get(transport.toLowerCase());
    return found || genericPtyAdapter;
  }

  getAdapterForManifest(manifest: EngineManifest): EngineAdapter {
    if (manifest.id === 'antigravity' || manifest.id === 'agy') {
      return agyAdapter;
    }
    return this.getAdapterForTransport(manifest.transport);
  }

  getAllSupportedProtocols(): { id: string; name: string }[] {
    return Array.from(this.adapters.values()).map((a) => ({ id: a.id, name: a.name }));
  }
}

export const protocolRegistry = new ProtocolRegistry();
