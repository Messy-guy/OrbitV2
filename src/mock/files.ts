import { FileItem } from '../types/orbit';

export const INITIAL_FILES: Record<string, FileItem[]> = {
  'ws-music-app': [
    {
      id: 'f-src',
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        {
          id: 'f-comp',
          name: 'components',
          path: 'src/components',
          type: 'directory',
          children: [
            { id: 'f-player', name: 'PlayerControls.tsx', path: 'src/components/PlayerControls.tsx', type: 'file', status: 'unmodified' },
            { id: 'f-plist', name: 'PlaylistView.tsx', path: 'src/components/PlaylistView.tsx', type: 'file', status: 'unmodified' },
            { id: 'f-queue', name: 'TrackQueue.tsx', path: 'src/components/TrackQueue.tsx', type: 'file', status: 'unmodified' }
          ]
        },
        {
          id: 'f-pages',
          name: 'pages',
          path: 'src/pages',
          type: 'directory',
          children: [
            { id: 'f-p-home', name: 'Home.tsx', path: 'src/pages/Home.tsx', type: 'file', status: 'unmodified' },
            { id: 'f-p-room', name: 'Room.tsx', path: 'src/pages/Room.tsx', type: 'file', status: 'unmodified' }
          ]
        },
        {
          id: 'f-store',
          name: 'store',
          path: 'src/store',
          type: 'directory',
          children: [
            { id: 'f-pstore', name: 'playlist.store.ts', path: 'src/store/playlist.store.ts', type: 'file', status: 'modified' },
            { id: 'f-ustore', name: 'user.store.ts', path: 'src/store/user.store.ts', type: 'file', status: 'unmodified' }
          ]
        },
        {
          id: 'f-socket',
          name: 'socket',
          path: 'src/socket',
          type: 'directory',
          children: [
            { id: 'f-psock', name: 'playlist.socket.ts', path: 'src/socket/playlist.socket.ts', type: 'file', status: 'modified' },
            { id: 'f-proto', name: 'protocol.ts', path: 'src/socket/protocol.ts', type: 'file', status: 'unmodified' }
          ]
        },
        {
          id: 'f-server',
          name: 'server',
          path: 'src/server',
          type: 'directory',
          children: [
            { id: 'f-wsserver', name: 'websocket.server.ts', path: 'src/server/websocket.server.ts', type: 'file', status: 'modified' },
            { id: 'f-express', name: 'app.ts', path: 'src/server/app.ts', type: 'file', status: 'unmodified' }
          ]
        }
      ]
    },
    {
      id: 'f-tests',
      name: 'tests',
      path: 'tests',
      type: 'directory',
      children: [
        { id: 'f-t-sock', name: 'socket.test.ts', path: 'tests/socket.test.ts', type: 'file', status: 'unmodified' },
        { id: 'f-t-recon', name: 'reconnect.spec.ts', path: 'tests/reconnect.spec.ts', type: 'file', status: 'modified' }
      ]
    },
    { id: 'f-pkg', name: 'package.json', path: 'package.json', type: 'file', status: 'unmodified' },
    { id: 'f-readme', name: 'README.md', path: 'README.md', type: 'file', status: 'unmodified' },
    { id: 'f-tsconfig', name: 'tsconfig.json', path: 'tsconfig.json', type: 'file', status: 'unmodified' }
  ]
};
