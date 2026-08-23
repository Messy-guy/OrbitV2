export const ENDPOINTS = {
  AUTH: {
    LOGIN_GITHUB: '/auth/github',
    LOGIN_GOOGLE: '/auth/google',
    ME: '/auth/me',
    PAIR_DEVICE: '/auth/pair-device',
    REFRESH: '/auth/refresh',
  },
  PROJECTS: {
    BASE: '/projects',
    DETAIL: (id: string) => `/projects/${id}`,
    SUMMARY: (id: string) => `/projects/${id}/summary`,
    DIFFS: (id: string) => `/projects/${id}/diffs`,
  },
  AGENTS: {
    BY_PROJECT: (projectId: string) => `/projects/${projectId}/agents`,
    PAUSE: (agentId: string) => `/agents/${agentId}/pause`,
    STOP: (agentId: string) => `/agents/${agentId}/stop`,
    APPROVE: (agentId: string) => `/agents/${agentId}/approve`,
    HANDOFF: (sourceId: string) => `/agents/${sourceId}/handoff`,
    PENDING_APPROVALS: '/agents/pending-approvals',
  },
  RELAY: {
    WS_TUNNEL: 'wss://api.useorbit.dev/relay/mobile',
    HEALTH: '/relay/health',
  },
} as const;
