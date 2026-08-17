import { MockAgentService, IAgentService } from './agent.service';
import { MockSessionService, ISessionService } from './session.service';
import { MockContextService, IContextService } from './context.service';
import { MockHandoffService, IHandoffService } from './handoff.service';
import { MockWorkspaceService, IWorkspaceService } from './workspace.service';

export const agentService: IAgentService = new MockAgentService();
export const sessionService: ISessionService = new MockSessionService();
export const contextService: IContextService = new MockContextService();
export const handoffService: IHandoffService = new MockHandoffService();
export const workspaceService: IWorkspaceService = new MockWorkspaceService();

export * from './agent.service';
export * from './session.service';
export * from './context.service';
export * from './handoff.service';
export * from './workspace.service';
