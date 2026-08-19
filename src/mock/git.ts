import { GitState } from '../types/orbit';

export const MOCK_GIT_STATE: Record<string, GitState> = {
  'ws-music-app': {
    currentBranch: 'main',
    headCommit: 'a82f31c',
    recentCommits: [
      'a82f31c Add socket reconnection backoff',
      '9d01e12 Initialize playlist store slice',
      '4b33a01 Add audio buffer decoders',
    ],
    modifiedFiles: [
      { path: 'src/store/playlist.store.ts', status: 'modified' },
      { path: 'src/socket/playlist.socket.ts', status: 'modified' },
      { path: 'src/server/websocket.server.ts', status: 'modified' },
      { path: 'tests/reconnect.spec.ts', status: 'modified' },
    ],
  },
};

export const INITIAL_GIT_STATE = MOCK_GIT_STATE;
