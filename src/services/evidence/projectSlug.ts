import { useWorkspaceStore } from '../../stores/workspace.store';

/**
 * Character-for-character equivalent of Rust's slugify_project_name in project_memory.rs
 */
export function slugifyProjectName(name: string): string {
  if (!name || !name.trim()) return 'default';
  let out = '';
  const lower = name.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '_') {
      out += c;
    } else {
      out += '-';
    }
  }
  out = out.replace(/^-+|-+$/g, '');
  return out || 'default';
}

/**
 * Derives canonical project slug identical to initialize_or_load_project_memory and execute_agent_handoff.
 */
export function getCanonicalProjectSlug(workspaceName?: string, projectPath?: string): string {
  let rawName = (workspaceName && workspaceName.trim()) || '';
  if (!rawName && projectPath && projectPath.trim()) {
    const parts = projectPath.replace(/[/\\]+$/, '').split(/[/\\]/);
    rawName = parts[parts.length - 1] || 'project';
  }
  return slugifyProjectName(rawName);
}

/**
 * Resolves canonical project slug from workspace state or fallback metadata.
 * Ensures EventStore always writes to ~/.orbit/projects/<slug>/ rather than ~/.orbit/projects/ws-.../
 */
export function resolveProjectSlug(
  workspaceId?: string,
  fallbackName?: string,
  fallbackPath?: string
): string {
  try {
    const store = useWorkspaceStore.getState();
    const ws = (workspaceId ? store.workspaces?.find((w) => w.id === workspaceId) : undefined) || store.getActiveWorkspace?.();
    const name = ws?.name || fallbackName;
    const path = ws?.projectPath || fallbackPath;
    if (name || path) {
      return getCanonicalProjectSlug(name, path);
    }
  } catch {}
  return getCanonicalProjectSlug(fallbackName || workspaceId, fallbackPath);
}
