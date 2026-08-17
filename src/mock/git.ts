import { GitState } from '../types/orbit';

export const INITIAL_GIT_STATE: Record<string, GitState> = {
  'ws-music-app': {
    currentBranch: 'playlist-sync',
    branches: [
      { name: 'main', isCurrent: false, lastCommit: 'Merge pull request #12 from feature/auth' },
      { name: 'playlist-sync', isCurrent: true, lastCommit: 'WIP: socket state resync protocol on peer reconnect' },
      { name: 'fix/reconnect', isCurrent: false, lastCommit: 'Add exponential backoff jitter calculation' },
    ],
    modifiedFiles: [
      { path: 'src/store/playlist.store.ts', status: 'M' },
      { path: 'src/socket/playlist.socket.ts', status: 'M' },
      { path: 'src/server/websocket.server.ts', status: 'M' },
      { path: 'tests/reconnect.spec.ts', status: 'M' },
    ]
  }
};
