import { useSyncExternalStore } from 'react';
import { MobileProjectSummary, MobileAgentDetail } from '../types/orbit';
import { ConnectedDeviceMetadata } from '../services/mobileRelay.service';

interface LiveRelayState {
  isConnected: boolean;
  device: ConnectedDeviceMetadata | null;
  projects: MobileProjectSummary[];
  agents: MobileAgentDetail[];
  activeWorkspaceId: string | null;

  // Actions
  setConnectionStatus: (connected: boolean) => void;
  setDevice: (device: ConnectedDeviceMetadata | null) => void;
  updateTelemetry: (payload: {
    projects?: MobileProjectSummary[];
    agents?: MobileAgentDetail[];
    activeWorkspaceId?: string;
    device?: ConnectedDeviceMetadata;
  }) => void;
  clearLiveState: () => void;
}

type Listener = () => void;

let state: LiveRelayState = {
  isConnected: false,
  device: null,
  projects: [],
  agents: [],
  activeWorkspaceId: null,

  setConnectionStatus: (connected: boolean) => {
    state = {
      ...state,
      isConnected: connected,
      ...(connected ? {} : { device: null, projects: [], agents: [], activeWorkspaceId: null }),
    };
    emitChange();
  },

  setDevice: (device) => {
    state = { ...state, device };
    emitChange();
  },

  updateTelemetry: (payload) => {
    try {
      const safeProjects = Array.isArray(payload.projects) ? payload.projects : state.projects;
      const safeAgents = Array.isArray(payload.agents) ? payload.agents : state.agents;
      const safeActiveWorkspaceId =
        typeof payload.activeWorkspaceId === 'string' || payload.activeWorkspaceId === null
          ? payload.activeWorkspaceId
          : state.activeWorkspaceId;
      state = {
        ...state,
        isConnected: true,
        projects: safeProjects,
        agents: safeAgents,
        activeWorkspaceId: safeActiveWorkspaceId,
        device:
          payload.device !== undefined && payload.device !== null && typeof payload.device === 'object'
            ? payload.device
            : state.device,
      };
      emitChange();
    } catch (e) {
      console.warn('[liveRelay] updateTelemetry validation failed:', e);
    }
  },

  clearLiveState: () => {
    state = {
      ...state,
      isConnected: false,
      device: null,
      projects: [],
      agents: [],
      activeWorkspaceId: null,
    };
    emitChange();
  },
};

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function useLiveRelayStore<T>(selector: (state: LiveRelayState) => T): T {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => selector(state),
    () => selector(state)
  );
}

useLiveRelayStore.getState = () => state;
useLiveRelayStore.setState = (partial: Partial<LiveRelayState>) => {
  state = { ...state, ...partial };
  emitChange();
};
