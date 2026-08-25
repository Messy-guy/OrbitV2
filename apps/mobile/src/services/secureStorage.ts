import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'orbit_mobile_access_token';
const REFRESH_TOKEN_KEY = 'orbit_mobile_refresh_token';
const WORKSTATION_PAIRING_KEY = 'orbit_mobile_workstation_key';
const RELAY_URL_KEY = 'orbit_mobile_relay_url';

let inMemoryAccessToken: string | null = null;
let inMemoryRelayUrl: string | null = null;

export const secureStorage = {
  getAccessToken: async (): Promise<string | null> => {
    if (inMemoryAccessToken) return inMemoryAccessToken;
    try {
      const stored = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (stored) inMemoryAccessToken = stored;
      return stored;
    } catch (e) {
      console.warn('SecureStore getAccessToken error:', e);
      return inMemoryAccessToken;
    }
  },

  setAccessToken: async (token: string): Promise<void> => {
    inMemoryAccessToken = token;
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    } catch (e) {
      console.error('SecureStore setAccessToken error:', e);
    }
  },

  getRelayUrl: async (): Promise<string | null> => {
    if (inMemoryRelayUrl) return inMemoryRelayUrl;
    try {
      const stored = await SecureStore.getItemAsync(RELAY_URL_KEY);
      if (stored) inMemoryRelayUrl = stored;
      return stored;
    } catch (e) {
      return inMemoryRelayUrl;
    }
  },

  setRelayUrl: async (url: string): Promise<void> => {
    inMemoryRelayUrl = url;
    try {
      await SecureStore.setItemAsync(RELAY_URL_KEY, url);
    } catch (e) {
      console.error('SecureStore setRelayUrl error:', e);
    }
  },

  getRefreshToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setRefreshToken: async (token: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch (e) {
      console.error('SecureStore setRefreshToken error:', e);
    }
  },

  clearTokens: async (): Promise<void> => {
    inMemoryAccessToken = null;
    inMemoryRelayUrl = null;
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(WORKSTATION_PAIRING_KEY);
      await SecureStore.deleteItemAsync(RELAY_URL_KEY);
    } catch (e) {
      console.warn('SecureStore clearTokens error:', e);
    }
  },
};
