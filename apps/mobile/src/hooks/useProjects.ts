import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { QUERY_KEYS } from '../constants/query-keys';
import { projectsModule } from '../modules/projects.module';
import { mobileRelayService } from '../services/mobileRelay.service';

export const useProjects = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    mobileRelayService.connect();
    const unsubscribe = mobileRelayService.subscribe((data) => {
      if (data.projects && data.projects.length > 0) {
        queryClient.setQueryData(QUERY_KEYS.PROJECTS.LIST, data.projects);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  return useQuery({
    queryKey: QUERY_KEYS.PROJECTS.LIST,
    queryFn: projectsModule.getProjects,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
};

export const useProjectDetail = (projectId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    mobileRelayService.connect();
    const unsubscribe = mobileRelayService.subscribe((data) => {
      if (data.projects) {
        const found = data.projects.find((p) => p.id === projectId);
        if (found) {
          queryClient.setQueryData(QUERY_KEYS.PROJECTS.DETAIL(projectId), found);
        }
      }
    });
    return unsubscribe;
  }, [projectId, queryClient]);

  return useQuery({
    queryKey: QUERY_KEYS.PROJECTS.DETAIL(projectId),
    queryFn: () => projectsModule.getProjectDetail(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 15,
  });
};
