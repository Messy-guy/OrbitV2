export const QUERY_KEYS = {
  AUTH: {
    ME: ['auth', 'me'] as const,
    PAIRING_STATUS: ['auth', 'pairing-status'] as const,
  },
  PROJECTS: {
    LIST: ['projects', 'list'] as const,
    DETAIL: (id: string) => ['projects', 'detail', id] as const,
    SUMMARY: (id: string) => ['projects', 'summary', id] as const,
    DIFFS: (id: string) => ['projects', 'diffs', id] as const,
  },
  AGENTS: {
    BY_PROJECT: (projectId: string) => ['agents', 'project', projectId] as const,
    DETAIL: (agentId: string) => ['agents', 'detail', agentId] as const,
    PENDING_APPROVALS: ['agents', 'pending-approvals'] as const,
  },
  RELAY: {
    TUNNEL_STATUS: ['relay', 'tunnel-status'] as const,
    ACTIVE_WORKSTATIONS: ['relay', 'workstations'] as const,
  },
} as const;
