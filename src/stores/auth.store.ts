import { create } from 'zustand';
import { AuthState, AuthUser, AuthTokens } from '../types/auth';

const STORAGE_KEY = 'orbit_auth_session';

const loadPersistedSession = (): { user: AuthUser | null; tokens: AuthTokens | null; isAuthenticated: boolean } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.user && parsed.tokens) {
        return {
          user: parsed.user,
          tokens: parsed.tokens,
          isAuthenticated: true,
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load persisted auth session:', e);
  }
  return { user: null, tokens: null, isAuthenticated: false };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadPersistedSession(),
  isLoading: false,
  isAuthModalOpen: false,

  setAuthModalOpen: (isAuthModalOpen: boolean) => set({ isAuthModalOpen }),

  setSession: (user: AuthUser, tokens: AuthTokens) => {
    set({
      user,
      tokens,
      isAuthenticated: true,
      isLoading: false,
      isAuthModalOpen: false,
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }));
    } catch {}
  },

  logout: () => {
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  },

  updateUserPlan: (plan: 'FREE' | 'PRO' | 'ENTERPRISE') => {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, plan };
      set({ user: updated });
      try {
        const tokens = get().tokens;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: updated, tokens }));
      } catch {}
    }
  },
}));
