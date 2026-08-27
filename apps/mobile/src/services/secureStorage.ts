import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'orbit_mobile_access_token';
const REFRESH_TOKEN_KEY = 'orbit_mobile_refresh_token';
const WORKSTATION_PAIRING_KEY = 'orbit_mobile_workstation_key';
const RELAY_URL_KEY = 'orbit_mobile_relay_url';
const PAIRING_CODE_KEY = 'orbit_mobile_pairing_code';

let inMemoryAccessToken: string | null = null;
let inMemoryRelayUrl: string | null = null;
let inMemoryPairingCode: string | null = null;

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

  getPairingCode: async (): Promise<string | null> => {
    if (inMemoryPairingCode) return inMemoryPairingCode;
    try {
      const stored = await SecureStore.getItemAsync(PAIRING_CODE_KEY);
      if (stored) inMemoryPairingCode = stored;
      return stored;
    } catch {
      return inMemoryPairingCode;
    }
  },

  setPairingCode: async (code: string): Promise<void> => {
    inMemoryPairingCode = code;
    try {
      await SecureStore.setItemAsync(PAIRING_CODE_KEY, code);
    } catch {}
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

  hasCredentials: async (): Promise<boolean> => {
    if (inMemoryAccessToken || inMemoryPairingCode) return true;
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const code = await SecureStore.getItemAsync(PAIRING_CODE_KEY);
      return Boolean(token || code);
    } catch {
      return false;
    }
  },

  clearTokens: async (): Promise<void> => {
    // 1. Immediately wipe in-memory values synchronously to kill race conditions
    inMemoryAccessToken = null;
    inMemoryRelayUrl = null;
    inMemoryPairingCode = null;

    // 2. Parallel wipe native SecureStore disk entries
    try {
      await Promise.allSettled([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(WORKSTATION_PAIRING_KEY),
        SecureStore.deleteItemAsync(RELAY_URL_KEY),
        SecureStore.deleteItemAsync(PAIRING_CODE_KEY),
      ]);
    } catch (e) {
      console.warn('SecureStore clearTokens error:', e);
    }
  },
};
