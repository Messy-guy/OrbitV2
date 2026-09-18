/**
 * Zero-dependency, universal path and filesystem utilities that execute
 * safely in both browser/Tauri webview bundles (no Node.js built-ins)
 * and Node.js test runners (vitest, tsx).
 */

export function pathNormalize(pathStr: string): string {
  if (!pathStr) return '';
  // Replace backslashes with forward slashes
  let p = pathStr.replace(/\\/g, '/');
  
  // Collapse multiple slashes (preserve leading double slash for network paths if any)
  const isNet = p.startsWith('//');
  p = p.replace(/\/+/g, '/');
  if (isNet) p = '/' + p;

  // Resolve . and .. segments
  const isAbsolute = p.startsWith('/') || p.startsWith('~') || /^[a-zA-Z]:\//.test(p);
  const segments = p.split('/');
  const resolved: string[] = [];

  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else if (!isAbsolute) {
        resolved.push('..');
      }
    } else {
      resolved.push(seg);
    }
  }

  let result = resolved.join('/');
  if (p.startsWith('/')) {
    result = '/' + result;
  } else if (/^[a-zA-Z]:\//.test(p)) {
    const drive = p.match(/^[a-zA-Z]:/)?.[0] || '';
    if (!result.startsWith(drive)) {
      result = drive + '/' + result;
    }
  }
  return result || (isAbsolute ? '/' : '.');
}

export function pathJoin(...parts: (string | undefined | null)[]): string {
  const validParts = parts.filter((p): p is string => typeof p === 'string' && p.length > 0);
  if (validParts.length === 0) return '.';

  const joined = validParts.join('/');
  return pathNormalize(joined);
}

export function pathDirname(filePath: string): string {
  if (!filePath || filePath === '.' || filePath === '/') return filePath || '.';
  const normalized = pathNormalize(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  if (lastSlash === 0) return '/';
  return normalized.substring(0, lastSlash);
}

export function pathBasename(filePath: string, ext?: string): string {
  if (!filePath) return '';
  const normalized = pathNormalize(filePath);
  const clean = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  const lastSlash = clean.lastIndexOf('/');
  let base = lastSlash === -1 ? clean : clean.substring(lastSlash + 1);

  if (ext && base.endsWith(ext)) {
    base = base.substring(0, base.length - ext.length);
  }
  return base;
}

export function isAbsolutePath(filePath: string): boolean {
  if (!filePath) return false;
  return (
    filePath.startsWith('/') ||
    filePath.startsWith('~') ||
    /^[a-zA-Z]:[/\\]/.test(filePath) ||
    filePath.startsWith('\\\\')
  );
}

export function getOrbitHomeDir(): string {
  if (typeof process !== 'undefined' && process.env) {
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) return home;
  }
  return '~';
}

/**
 * Asynchronously returns Node's native 'fs' module, or null in browser environments.
 *
 * Uses `new Function('return import("node:fs")')` to create a dynamic import that:
 * 1. Works in Node.js ESM (the project is "type":"module" so require is undefined)
 * 2. Is NOT statically analyzable by Vite — the string literal hides the import
 *    specifier from Vite's rollup plugin, so it is NOT bundled or stubbed
 * 3. Returns null naturally in browsers (Node built-ins are unavailable)
 *
 * All callers (appendEvent, getEvents, etc.) are already async, so they can await this.
 */
export async function getNodeFs(): Promise<any> {
  try {
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('return import("node:fs")');
    const mod = await dynamicImport();
    // ESM default export or named exports — fs exports are on .default or the module itself
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

/** @deprecated Use getNodeFs() (async). Kept for backward-compat — always returns null. */
export function getNodeFsSync(): any {
  return null;
}
