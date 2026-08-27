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
    state = {
      ...state,
      isConnected: true,
      projects: payload.projects !== undefined ? payload.projects : state.projects,
      agents: payload.agents !== undefined ? payload.agents : state.agents,
      activeWorkspaceId: payload.activeWorkspaceId !== undefined ? payload.activeWorkspaceId : state.activeWorkspaceId,
      device: payload.device !== undefined ? payload.device : state.device,
    };
    emitChange();
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
