import { MobileAgentDetail } from '../types/orbit';
import { useLiveRelayStore } from '../stores/liveRelay.store';

export const agentsModule = {
  getAgents: async (): Promise<MobileAgentDetail[]> => {
    return useLiveRelayStore.getState().agents;
  },

  getAgentsByProject: async (projectId: string): Promise<MobileAgentDetail[]> => {
    return useLiveRelayStore.getState().agents.filter((a) => (a as any).workspaceId === projectId || true);
  },
};
