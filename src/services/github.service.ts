import { tauriService } from './tauri.service';
import { useAuthStore } from '../stores/auth.store';

export interface GitHubRepoItem {
  id: number | string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch?: string;
  description: string | null;
  language?: string | null;
  stargazersCount?: number;
  updatedAt?: string;
}

export class GitHubService {
  /**
   * Search public GitHub repositories or user repos
   */
  public static async searchRepositories(query: string): Promise<GitHubRepoItem[]> {
    if (!query.trim()) return [];

    try {
      const { tokens } = useAuthStore.getState();
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
      };
      if (tokens?.accessToken) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }

      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query.trim())}&per_page=25&sort=stars`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        return (data.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          fullName: item.full_name,
          private: item.private ?? false,
          htmlUrl: item.html_url,
          cloneUrl: item.clone_url || item.html_url,
          defaultBranch: item.default_branch || 'main',
          description: item.description,
          language: item.language,
          stargazersCount: item.stargazers_count,
          updatedAt: item.updated_at,
        }));
      }
    } catch (err) {
      console.warn('[GitHubService] Public API search failed:', err);
    }
    return [];
  }

  /**
   * Fetch authenticated user's repositories via GitHub API, gh CLI, or cloud backend
   */
  public static async fetchUserRepositories(): Promise<GitHubRepoItem[]> {
    const repos: GitHubRepoItem[] = [];
    const seen = new Set<string>();

    // 1. Try local GitHub CLI (gh)
    try {
      const ghRepos = await tauriService.getGhCliRepos();
      for (const r of ghRepos) {
        if (!seen.has(r.nameWithOwner)) {
          seen.add(r.nameWithOwner);
          repos.push({
            id: r.nameWithOwner,
            name: r.name,
            fullName: r.nameWithOwner,
            private: r.isPrivate,
            htmlUrl: r.url,
            cloneUrl: r.url.endsWith('.git') ? r.url : `${r.url}.git`,
            description: r.description || null,
            updatedAt: r.updatedAt,
          });
        }
      }
    } catch (err) {
      console.warn('[GitHubService] Local gh CLI fetch failed:', err);
    }

    // 2. Try direct authenticated GitHub API if access token is available
    const { tokens } = useAuthStore.getState();
    if (tokens?.accessToken) {
      try {
        const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${tokens.accessToken}`,
          },
        });
        if (res.ok) {
          const items = await res.json();
          for (const item of items) {
            if (!seen.has(item.full_name)) {
              seen.add(item.full_name);
              repos.push({
                id: item.id,
                name: item.name,
                fullName: item.full_name,
                private: item.private ?? false,
                htmlUrl: item.html_url,
                cloneUrl: item.clone_url || item.html_url,
                defaultBranch: item.default_branch || 'main',
                description: item.description,
                language: item.language,
                stargazersCount: item.stargazers_count,
                updatedAt: item.updated_at,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[GitHubService] Authenticated user repos fetch failed:', err);
      }
    }

    return repos;
  }
}
