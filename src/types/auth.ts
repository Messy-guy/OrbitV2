export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  githubId?: string;
  googleId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;

  setAuthModalOpen: (open: boolean) => void;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  logout: () => void;
  updateUserPlan: (plan: 'FREE' | 'PRO' | 'ENTERPRISE') => void;
}
