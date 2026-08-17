import { Workspace } from '../types/orbit';

export const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws-music-app',
    name: 'Music App',
    projectPath: '/home/leo/projects/music-app',
    agentCount: 3,
    lastActive: '2m ago',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 120000,
  },
  {
    id: 'ws-graphflow',
    name: 'GraphFlow',
    projectPath: '/home/leo/projects/graphflow-engine',
    agentCount: 1,
    lastActive: 'Yesterday',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'ws-ecommerce',
    name: 'E-commerce API',
    projectPath: '/home/leo/projects/shopit-backend',
    agentCount: 2,
    lastActive: '3 days ago',
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 3,
  },
];
