import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { QUERY_KEYS } from '../constants/query-keys';
import { agentsModule } from '../modules/agents.module';
import { mobileRelayService } from '../services/mobileRelay.service';
import { MobileAgentDetail } from '../types/orbit';
import * as Haptics from 'expo-haptics';

export const useAgentsByProject = (projectId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    mobileRelayService.connect();
    const unsubscribe = mobileRelayService.subscribe((data) => {
      if (data.agents && data.agents.length > 0) {
        queryClient.setQueryData(QUERY_KEYS.AGENTS.BY_PROJECT(projectId), data.agents);
      }
    });
    return unsubscribe;
  }, [projectId, queryClient]);

  return useQuery({
    queryKey: QUERY_KEYS.AGENTS.BY_PROJECT(projectId),
    queryFn: () => agentsModule.getAgentsByProject(projectId),
    enabled: !!projectId,
    refetchInterval: 4000,
  });
};

export const usePendingApprovals = () => {
  return useQuery({
    queryKey: QUERY_KEYS.AGENTS.PENDING_APPROVALS,
    queryFn: agentsModule.getPendingApprovals,
    refetchInterval: 3000,
  });
};

export const useAgentControls = (projectId?: string) => {
  const queryClient = useQueryClient();

  const pauseMutation = useMutation({
    mutationFn: async (agentId: string) => {
      // Dispatches directly via live WebSocket tunnel to Desktop
      mobileRelayService.sendAction('PAUSE', agentId, projectId);
      return { success: true, status: 'paused' };
    },
    onMutate: async (agentId) => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.AGENTS.BY_PROJECT(projectId) });
      const previous = queryClient.getQueryData<MobileAgentDetail[]>(QUERY_KEYS.AGENTS.BY_PROJECT(projectId));

      // Optimistically mark as paused
      if (previous) {
        queryClient.setQueryData<MobileAgentDetail[]>(
          QUERY_KEYS.AGENTS.BY_PROJECT(projectId),
          previous.map((a) => (a.id === agentId ? { ...a, status: 'paused' } : a))
        );
      }
      return { previous };
    },
    onError: (_err, _agentId, context) => {
      if (projectId && context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.AGENTS.BY_PROJECT(projectId), context.previous);
      }
    },
    onSettled: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENTS.BY_PROJECT(projectId) });
      }
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (agentId: string) => {
      mobileRelayService.sendAction('STOP', agentId, projectId);
      return { success: true, status: 'stopped' };
    },
    onMutate: async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    },
    onSettled: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENTS.BY_PROJECT(projectId) });
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      agentId,
      approvalId,
      decision,
      customReply,
    }: {
      agentId: string;
      approvalId: string;
      decision: 'APPROVE' | 'REJECT';
      customReply?: string;
    }) => {
      mobileRelayService.sendAction('APPROVE', agentId, projectId, { approvalId, decision, customReply });
      return { success: true };
    },
    onSuccess: async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENTS.PENDING_APPROVALS });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENTS.BY_PROJECT(projectId) });
      }
    },
  });

  return {
    pauseAgent: pauseMutation.mutateAsync,
    isPausing: pauseMutation.isPending,
    stopAgent: stopMutation.mutateAsync,
    isStopping: stopMutation.isPending,
    approveAction: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
  };
};
