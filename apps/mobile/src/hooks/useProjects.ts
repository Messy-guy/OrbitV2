import { useLiveRelayStore } from '../stores/liveRelay.store';

export const useProjects = () => {
  const projects = useLiveRelayStore((s) => s.projects);
  const isConnected = useLiveRelayStore((s) => s.isConnected);

  return {
    data: projects,
    isLoading: !isConnected,
    isRefetching: false,
    refetch: async () => ({ data: projects }),
  };
};

export const useProjectDetail = (projectId: string) => {
  const project = useLiveRelayStore((s) => s.projects.find((p) => p.id === projectId));
  const isConnected = useLiveRelayStore((s) => s.isConnected);

  return {
    data: project,
    isLoading: !isConnected,
    isRefetching: false,
    refetch: async () => ({ data: project }),
  };
};
