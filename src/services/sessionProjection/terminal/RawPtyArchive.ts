export interface RawPtyChunk {
  sequence: number;
  sessionId: string;
  bytes: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}

class RawPtyArchive {
  private chunksBySession: Map<string, RawPtyChunk[]> = new Map();
  private chunkCounters: Map<string, number> = new Map();

  append(sessionId: string, bytes: string, stream: 'stdout' | 'stderr' = 'stdout'): RawPtyChunk {
    const list = this.chunksBySession.get(sessionId) || [];
    const seq = (this.chunkCounters.get(sessionId) || 0) + 1;
    this.chunkCounters.set(sessionId, seq);

    const chunk: RawPtyChunk = {
      sequence: seq,
      sessionId,
      bytes,
      stream,
      timestamp: Date.now(),
    };

    list.push(chunk);
    // Keep max 5,000 raw chunks in memory per agent
    if (list.length > 5000) {
      list.shift();
    }
    this.chunksBySession.set(sessionId, list);
    return chunk;
  }

  getHistory(sessionId: string): string {
    const list = this.chunksBySession.get(sessionId) || [];
    return list.map((c) => c.bytes).join('');
  }

  getChunks(sessionId: string): RawPtyChunk[] {
    return this.chunksBySession.get(sessionId) || [];
  }

  clear(sessionId: string) {
    this.chunksBySession.delete(sessionId);
    this.chunkCounters.delete(sessionId);
  }
}

export const rawPtyArchive = new RawPtyArchive();
