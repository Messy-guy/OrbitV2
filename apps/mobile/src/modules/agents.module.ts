import { secureFetch } from '../services/apiClient';
import { ENDPOINTS } from '../constants/endpoints';
import { mobileRelayService } from '../services/mobileRelay.service';
import { MobileAgentDetail, MobilePendingApproval } from '../types/orbit';

export const agentsModule = {
  getAgentsByProject: async (projectId: string): Promise<MobileAgentDetail[]> => {
    // If live agents are streamed via websocket from your desktop, return them directly
    if (mobileRelayService.latestState.agents.length > 0) {
      return mobileRelayService.latestState.agents;
    }
    try {
      return await secureFetch<MobileAgentDetail[]>(ENDPOINTS.AGENTS.BY_PROJECT(projectId));
    } catch {
      return [];
    }
  },

  pauseAgent: async (agentId: string): Promise<{ success: boolean; status: string }> => {
    return await secureFetch(ENDPOINTS.AGENTS.PAUSE(agentId), { method: 'POST' });
  },

  stopAgent: async (agentId: string): Promise<{ success: boolean; status: string }> => {
    return await secureFetch(ENDPOINTS.AGENTS.STOP(agentId), { method: 'POST' });
  },

  approveAction: async (
    agentId: string,
    approvalId: string,
    decision: 'APPROVE' | 'REJECT',
    customReply?: string
  ): Promise<{ success: boolean }> => {
    return await secureFetch(ENDPOINTS.AGENTS.APPROVE(agentId), {
      method: 'POST',
      body: JSON.stringify({ approvalId, decision, customReply }),
    });
  },

  handoffContext: async (
    sourceAgentId: string,
    targetAgentId: string,
    directive?: string
  ): Promise<{ success: boolean; handoffId: string }> => {
    return await secureFetch(ENDPOINTS.AGENTS.HANDOFF(sourceAgentId), {
      method: 'POST',
      body: JSON.stringify({ targetAgentId, directive }),
    });
  },

  getPendingApprovals: async (): Promise<MobilePendingApproval[]> => {
    try {
      return await secureFetch<MobilePendingApproval[]>(ENDPOINTS.AGENTS.PENDING_APPROVALS);
    } catch {
      return [];
    }
  },
};
