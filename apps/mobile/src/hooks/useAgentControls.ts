import { useState } from 'react';
import { useLiveRelayStore } from '../stores/liveRelay.store';
import { mobileRelayService } from '../services/mobileRelay.service';

export const useAgents = () => {
  const agents = useLiveRelayStore((s) => s.agents);
  const isConnected = useLiveRelayStore((s) => s.isConnected);

  return {
    data: agents,
    isLoading: !isConnected,
    isRefetching: false,
    refetch: async () => ({ data: agents }),
  };
};

export const useAgentsByProject = (projectId: string) => {
  const agents = useLiveRelayStore((s) => s.agents);
  const isConnected = useLiveRelayStore((s) => s.isConnected);

  return {
    data: agents,
    isLoading: !isConnected,
    isRefetching: false,
    refetch: async () => ({ data: agents }),
  };
};

export const usePendingApprovals = () => {
  const isConnected = useLiveRelayStore((s) => s.isConnected);

  return {
    data: [] as any[],
    isLoading: !isConnected,
    isRefetching: false,
    refetch: async () => ({ data: [] }),
  };
};

export const useAgentControls = (projectId?: string) => {
  const [isPausing, setIsPausing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const pauseAgent = async (agentId: string) => {
    setIsPausing(true);
    try {
      mobileRelayService.sendAction('PAUSE', agentId, projectId);
    } finally {
      setIsPausing(false);
    }
  };

  const stopAgent = async (agentId: string) => {
    setIsStopping(true);
    try {
      mobileRelayService.sendAction('STOP', agentId, projectId);
    } finally {
      setIsStopping(false);
    }
  };

  const approveAction = async (payload: { agentId?: string; approvalId: string; decision: 'APPROVE' | 'REJECT' }) => {
    setIsApproving(true);
    try {
      mobileRelayService.sendAction('APPROVE', payload.agentId, projectId, payload);
    } finally {
      setIsApproving(false);
    }
  };

  return {
    pauseAgent,
    stopAgent,
    approveAction,
    isPausing,
    isStopping,
    isApproving,
  };
};
