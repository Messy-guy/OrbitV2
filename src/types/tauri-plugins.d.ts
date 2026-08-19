declare module '@tauri-apps/plugin-updater' {
  export interface Update {
    available: boolean;
    currentVersion: string;
    version: string;
    date?: string;
    body?: string;
    downloadAndInstall: (onEvent?: (event: any) => void) => Promise<void>;
    close: () => Promise<void>;
  }

  export function check(): Promise<Update | null>;
}

declare module '@tauri-apps/plugin-process' {
  export function relaunch(): Promise<void>;
  export function exit(code?: number): Promise<void>;
}
