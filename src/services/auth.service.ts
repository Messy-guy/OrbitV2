import { useAuthStore } from '../stores/auth.store';
import { isTauriAvailable, tauriService } from './tauri.service';

const BACKEND_API_URL = (import.meta as any).env?.VITE_API_URL || 'https://orbit-cloud-backend.onrender.com';

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  description: string | null;
  updatedAt: string;
}

export class AuthService {
  /**
   * Triggers GitHub OAuth 2.0 PKCE loopback login flow
   */
  public static async loginWithGitHub(): Promise<void> {
    const loopbackRedirect = 'http://127.0.0.1:49152/callback';
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `${BACKEND_API_URL}/v1/auth/github?redirect_uri=${encodeURIComponent(loopbackRedirect)}&state=${encodeURIComponent(state)}`;

    await tauriService.openExternalUrl(authUrl);
    AuthService.pollSession(state);
  }

  /**
   * Triggers Google OAuth 2.0 login
   */
  public static async loginWithGoogle(): Promise<void> {
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `${BACKEND_API_URL}/v1/auth/google`;
    await tauriService.openExternalUrl(authUrl);
  }

  /**
   * Polls Redis session state every 1 second until authenticated
   */
  private static pollSession(state: string): void {
    const { setSession } = useAuthStore.getState();
    let attempts = 0;
    const maxAttempts = 90;

    console.log(`[Orbit Auth] Started polling for session state: ${state}`);

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        console.warn('[Orbit Auth] Polling timeout exceeded');
        return;
      }

      try {
        const res = await fetch(`${BACKEND_API_URL}/v1/auth/session/${state}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.user && data.accessToken) {
            console.log('[Orbit Auth] Session retrieved successfully:', data.user);
            clearInterval(interval);
            setSession(data.user, {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresIn: data.expiresIn,
            });
          }
        }
      } catch (err: any) {
        console.warn('[Orbit Auth] Polling fetch error:', err.message);
      }
    }, 1000);
  }

  /**
   * Fetches user's GitHub repositories via the backend SSRF-protected proxy
   */
  public static async fetchUserRepositories(userId: string): Promise<GitHubRepo[]> {
    const res = await fetch(`${BACKEND_API_URL}/v1/github/repos/user/${userId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch GitHub repositories (${res.status})`);
    }
    return res.json();
  }

  /**
   * Refreshes access tokens when expired
   */
  public static async refreshAccessToken(): Promise<string | null> {
    const { tokens, setSession, logout } = useAuthStore.getState();
    if (!tokens?.refreshToken) return null;

    try {
      const res = await fetch(`${BACKEND_API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        setSession(data.user, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
        });
        return data.accessToken;
      } else {
        logout();
      }
    } catch {
      logout();
    }
    return null;
  }
}
