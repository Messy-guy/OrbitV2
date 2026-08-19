import { HybridAgentService, IAgentService } from './agent.service';
import { HybridSessionService, ISessionService } from './session.service';
import { HybridContextService, IContextService } from './context.service';
import { HybridHandoffService, IHandoffService } from './handoff.service';
import { HybridWorkspaceService, IWorkspaceService } from './workspace.service';

export const agentService: IAgentService = new HybridAgentService();
export const sessionService: ISessionService = new HybridSessionService();
export const contextService: IContextService = new HybridContextService();
export const handoffService: IHandoffService = new HybridHandoffService();
export const workspaceService: IWorkspaceService = new HybridWorkspaceService();

export * from './agent.service';
export * from './session.service';
export * from './context.service';
export * from './handoff.service';
export * from './workspace.service';
export * from './tauri.service';
