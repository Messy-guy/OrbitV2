import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type StartupPhase =
  | 'BOOT'
  | 'CONFIG_LOADED'
  | 'STORAGE_HYDRATED'
  | 'NAVIGATION_READY'
  | 'AUTH_RESTORED'
  | 'RELAY_INITIALIZING'
  | 'RELAY_READY'
  | 'NOTIFICATIONS_INITIALIZING'
  | 'NOTIFICATIONS_READY'
  | 'APP_READY'
  | 'FAILED';

export interface StartupDiagnostic {
  phase: StartupPhase;
  timestamp: number;
  platform: string;
  appVersion: string;
  error?: string;
  stack?: string;
}

const diagnostics: StartupDiagnostic[] = [];
const MAX_DIAGNOSTICS = 40;
let currentPhase: StartupPhase = 'BOOT';

function safeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message.slice(0, 500), stack: error.stack?.slice(0, 2000) };
  }
  return { message: String(error).slice(0, 500) };
}

export function markStartupPhase(phase: StartupPhase): void {
  currentPhase = phase;
  const entry: StartupDiagnostic = {
    phase,
    timestamp: Date.now(),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version || 'unknown',
  };
  diagnostics.push(entry);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
  console.info(`[Orbit Startup] ${phase}`);
}

export function recordStartupFailure(error: unknown, phase: StartupPhase = currentPhase): void {
  const safe = safeError(error);
  const entry: StartupDiagnostic = {
    phase: 'FAILED',
    timestamp: Date.now(),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version || 'unknown',
    error: `[${phase}] ${safe.message}`,
    stack: safe.stack,
  };
  diagnostics.push(entry);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();
  console.error(`[Orbit Startup] FAILED during ${phase}: ${safe.message}`, safe.stack || '');
}

export function getStartupDiagnostics(): readonly StartupDiagnostic[] {
  return diagnostics;
}
