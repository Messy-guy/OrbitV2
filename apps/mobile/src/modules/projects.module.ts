import { MobileProjectSummary } from '../types/orbit';
import { useLiveRelayStore } from '../stores/liveRelay.store';

export const projectsModule = {
  getProjects: async (): Promise<MobileProjectSummary[]> => {
    return useLiveRelayStore.getState().projects;
  },

  getProjectById: async (id: string): Promise<MobileProjectSummary | null> => {
    return useLiveRelayStore.getState().projects.find((p) => p.id === id) || null;
  },
};
