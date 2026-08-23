import { secureFetch } from '../services/apiClient';
import { ENDPOINTS } from '../constants/endpoints';
import { mobileRelayService } from '../services/mobileRelay.service';
import { MobileProjectSummary } from '../types/orbit';

export const projectsModule = {
  getProjects: async (): Promise<MobileProjectSummary[]> => {
    // If we have live streamed state from your laptop via websocket, return that first
    if (mobileRelayService.latestState.projects.length > 0) {
      return mobileRelayService.latestState.projects;
    }
    try {
      return await secureFetch<MobileProjectSummary[]>(ENDPOINTS.PROJECTS.BASE);
    } catch {
      return [];
    }
  },

  getProjectDetail: async (id: string): Promise<MobileProjectSummary> => {
    const fromRelay = mobileRelayService.latestState.projects.find((p) => p.id === id);
    if (fromRelay) return fromRelay;

    return await secureFetch<MobileProjectSummary>(ENDPOINTS.PROJECTS.DETAIL(id));
  },
};
