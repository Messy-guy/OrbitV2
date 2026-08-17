import { create } from 'zustand';
import { Activity, FileItem, GitState } from '../types/orbit';
import { INITIAL_ACTIVITIES } from '../mock/activities';
import { INITIAL_FILES } from '../mock/files';
import { INITIAL_GIT_STATE } from '../mock/git';

interface ActivityState {
  activities: Record<string, Activity[]>;
  files: Record<string, FileItem[]>;
  gitStates: Record<string, GitState>;

  // Actions
  loadWorkspaceData: (workspaceId: string) => void;
  addActivity: (workspaceId: string, activity: Omit<Activity, 'id' | 'workspaceId' | 'timestamp' | 'timeString'>) => void;
  getActivities: (workspaceId: string) => Activity[];
  getFiles: (workspaceId: string) => FileItem[];
  getGitState: (workspaceId: string) => GitState | undefined;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: { ...INITIAL_ACTIVITIES },
  files: { ...INITIAL_FILES },
  gitStates: { ...INITIAL_GIT_STATE },

  loadWorkspaceData: (workspaceId: string) => {
    const { activities, files, gitStates } = get();
    if (!activities[workspaceId]) {
      set(state => ({
        activities: {
          ...state.activities,
          [workspaceId]: [
            {
              id: `act-${Date.now()}`,
              workspaceId,
              type: 'agent_started',
              description: 'Workspace initialized',
              timestamp: Date.now(),
              timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          ],
        },
        files: {
          ...state.files,
          [workspaceId]: files['ws-music-app'] || [],
        },
        gitStates: {
          ...state.gitStates,
          [workspaceId]: gitStates['ws-music-app'] || {
            currentBranch: 'main',
            branches: [{ name: 'main', isCurrent: true, lastCommit: 'Initial commit' }],
            modifiedFiles: [],
          },
        }
      }));
    }
  },

  addActivity: (workspaceId: string, activity) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newActivity: Activity = {
      ...activity,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      workspaceId,
      timestamp: Date.now(),
      timeString,
    };

    set(state => ({
      activities: {
        ...state.activities,
        [workspaceId]: [newActivity, ...(state.activities[workspaceId] || [])],
      },
    }));
  },

  getActivities: (workspaceId: string) => {
    return get().activities[workspaceId] || [];
  },

  getFiles: (workspaceId: string) => {
    return get().files[workspaceId] || [];
  },

  getGitState: (workspaceId: string) => {
    return get().gitStates[workspaceId];
  },
}));
