import { OperationalMode, OperationalRole, OperationalModeSessionState, EnforcementStrategy } from './types';
import { OPERATIONAL_MODE_PROFILES, resolveEnforcementStrategy } from './OperationalModeRegistry';
import { ModeWorkspacePolicy } from './ModeWorkspacePolicy';
import { OperationalCommandPolicy } from './OperationalModePolicy';

export class UniversalModeEnforcer {
  private static instance: UniversalModeEnforcer;
  private sessionModes: Map<string, OperationalModeSessionState> = new Map();

  private constructor() {
    this.restoreFromLocalStorage();
  }

  public static getInstance(): UniversalModeEnforcer {
    if (!UniversalModeEnforcer.instance) {
      UniversalModeEnforcer.instance = new UniversalModeEnforcer();
    }
    return UniversalModeEnforcer.instance;
  }

  public registerSession(
    sessionId: string,
    agentId: string,
    provider: string,
    projectId: string,
    workspacePath: string,
    mode: OperationalMode = 'code'
  ): OperationalModeSessionState {
    const strategy = resolveEnforcementStrategy(provider, mode);
    const state: OperationalModeSessionState = {
      sessionId,
      agentId,
      provider,
      projectId,
      workspacePath,
      operationalMode: mode,
      enforcementStrategy: strategy,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.sessionModes.set(sessionId, state);
    this.persistToLocalStorage();
    return state;
  }

  public getSessionMode(sessionId: string): OperationalModeSessionState | undefined {
    return this.sessionModes.get(sessionId);
  }

  public setSessionMode(sessionId: string, newMode: OperationalMode): OperationalModeSessionState | undefined {
    const existing = this.sessionModes.get(sessionId);
    if (!existing) return undefined;

    const strategy = resolveEnforcementStrategy(existing.provider, newMode);
    existing.operationalMode = newMode;
    existing.enforcementStrategy = strategy;
    existing.updatedAt = Date.now();

    this.persistToLocalStorage();
    return existing;
  }

  public getBootstrapContract(mode: OperationalMode): string {
    const profile = OPERATIONAL_MODE_PROFILES[mode] || OPERATIONAL_MODE_PROFILES.code;
    return profile.bootstrapContract;
  }

  public evaluateTerminalInput(sessionId: string, input: string): { allowed: boolean; reason?: string } {
    const session = this.sessionModes.get(sessionId);
    if (!session || session.operationalMode === 'code') {
      return { allowed: true };
    }

    // Evaluate against OperationalCommandPolicy
    const evalResult = OperationalCommandPolicy.evaluateCommand(session.operationalMode, input);
    return {
      allowed: evalResult.allowed,
      reason: evalResult.reason
    };
  }

  private persistToLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const obj = Object.fromEntries(this.sessionModes.entries());
        localStorage.setItem('orbit_operational_modes_v1', JSON.stringify(obj));
      }
    } catch {}
  }

  private restoreFromLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem('orbit_operational_modes_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const [k, v] of Object.entries(parsed)) {
            this.sessionModes.set(k, v as OperationalModeSessionState);
          }
        }
      }
    } catch {}
  }
}

export const universalModeEnforcer = UniversalModeEnforcer.getInstance();
