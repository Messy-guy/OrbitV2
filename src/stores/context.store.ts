import { create } from 'zustand';
import { ProjectContext, Checkpoint, HandoffSelection, ProjectDecision, ProjectIssue } from '../types/orbit';
import { contextService, handoffService } from '../services';
import { useAgentStore } from './agent.store';
import { useActivityStore } from './activity.store';

interface ContextState {
  currentContext: ProjectContext | null;
  checkpoints: Checkpoint[];
  isGeneratingHandoff: boolean;
  activeHandoffAnimation: {
    active: boolean;
    sourceAgentName: string;
    targetAgentName: string;
    tokenCount: number;
    decisionCount: number;
    issueCount: number;
    fileCount: number;
  } | null;

  // Actions
  loadContextForWorkspace: (workspaceId: string) => Promise<void>;
  updateGoal: (workspaceId: string, goal: string) => Promise<void>;
  updateProgress: (workspaceId: string, progress: number) => Promise<void>;
  addDecision: (workspaceId: string, decision: Omit<ProjectDecision, 'id' | 'timestamp'>) => Promise<void>;
  addIssue: (workspaceId: string, issue: Omit<ProjectIssue, 'id'>) => Promise<void>;
  createCheckpoint: (workspaceId: string, name: string, summary: string, agentId?: string) => Promise<Checkpoint>;
  generateHandoffPreview: (
    sourceAgentName: string,
    sourceSessionTitle: string,
    targetAgentName: string,
    selection: HandoffSelection
  ) => any;
  executeHandoff: (
    workspaceId: string,
    sourceAgentId: string,
    sourceAgentName: string,
    sourceSessionId: string,
    targetAgentId: string,
    targetAgentName: string,
    targetSessionId: string,
    selection: HandoffSelection,
    previewSummary: any
  ) => Promise<void>;
  dismissHandoffAnimation: () => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
  currentContext: null,
  checkpoints: [],
  isGeneratingHandoff: false,
  activeHandoffAnimation: null,

  loadContextForWorkspace: async (workspaceId: string) => {
    try {
      const ctx = await contextService.getContext(workspaceId);
      const chks = await contextService.getCheckpoints(workspaceId);
      set({ currentContext: ctx || null, checkpoints: chks });
    } catch (e) {
      console.error('Failed to load project context', e);
    }
  },

  updateGoal: async (workspaceId: string, goal: string) => {
    const { currentContext } = get();
    if (!currentContext) return;
    const updated = { ...currentContext, goal, updatedAt: Date.now() };
    await contextService.updateContext(updated);
    set({ currentContext: updated });
  },

  updateProgress: async (workspaceId: string, progress: number) => {
    const { currentContext } = get();
    if (!currentContext) return;
    const updated = { ...currentContext, progress, updatedAt: Date.now() };
    await contextService.updateContext(updated);
    set({ currentContext: updated });
  },

  addDecision: async (workspaceId: string, decision: Omit<ProjectDecision, 'id' | 'timestamp'>) => {
    await contextService.addDecision(workspaceId, decision);
    await get().loadContextForWorkspace(workspaceId);
  },

  addIssue: async (workspaceId: string, issue: Omit<ProjectIssue, 'id'>) => {
    await contextService.addIssue(workspaceId, issue);
    await get().loadContextForWorkspace(workspaceId);
  },

  createCheckpoint: async (workspaceId: string, name: string, summary: string, agentId?: string) => {
    const newChk = await contextService.createCheckpoint(workspaceId, name, summary, agentId);
    set(state => ({
      checkpoints: [newChk, ...state.checkpoints],
      currentContext: state.currentContext ? { ...state.currentContext, lastCheckpointTime: 'Just now' } : null,
    }));

    // Record activity
    useActivityStore.getState().addActivity(workspaceId, {
      type: 'checkpoint',
      agentId,
      description: `Checkpoint created: "${name}"`,
      details: summary,
    });

    return newChk;
  },

  generateHandoffPreview: (
    sourceAgentName: string,
    sourceSessionTitle: string,
    targetAgentName: string,
    selection: HandoffSelection
  ) => {
    const { currentContext } = get();
    if (!currentContext) return null;
    return handoffService.generateHandoffPreview(
      currentContext,
      sourceAgentName,
      sourceSessionTitle,
      targetAgentName,
      selection
    );
  },

  executeHandoff: async (
    workspaceId: string,
    sourceAgentId: string,
    sourceAgentName: string,
    sourceSessionId: string,
    targetAgentId: string,
    targetAgentName: string,
    targetSessionId: string,
    selection: HandoffSelection,
    previewSummary: any
  ) => {
    set({ isGeneratingHandoff: true });

    // 1. Perform mock handoff transfer
    const { targetMessage, agentReply } = await handoffService.executeHandoff(
      workspaceId,
      sourceAgentId,
      sourceSessionId,
      targetAgentId,
      targetSessionId,
      selection,
      previewSummary
    );

    // 2. Inject handoff into Target Agent's session
    const agentStore = useAgentStore.getState();
    agentStore.addDirectMessage(targetSessionId, targetMessage);

    // Set target agent status to working
    await agentStore.setAgentStatus(targetAgentId, 'working');

    // Deliver Agent acknowledgement after brief delay
    setTimeout(async () => {
      agentStore.addDirectMessage(targetSessionId, agentReply);
      await agentStore.setAgentStatus(targetAgentId, 'ready');
    }, 1200);

    // 3. Record Activity
    const desc = `Context shared → ${targetAgentName} (${get().currentContext?.decisions.length || 3} decisions, ${get().currentContext?.issues.length || 1} issue, ${previewSummary.relevantFiles.length} files, ${((previewSummary.estimatedTokens || 2900) / 1000).toFixed(1)}k tokens)`;
    useActivityStore.getState().addActivity(workspaceId, {
      type: 'handoff',
      agentId: sourceAgentId,
      agentName: sourceAgentName,
      description: desc,
    });

    // 4. Trigger Handoff Animation Overlay
    set({
      isGeneratingHandoff: false,
      activeHandoffAnimation: {
        active: true,
        sourceAgentName,
        targetAgentName,
        tokenCount: previewSummary.estimatedTokens || 2900,
        decisionCount: get().currentContext?.decisions.length || 3,
        issueCount: get().currentContext?.issues.length || 1,
        fileCount: previewSummary.relevantFiles.length || 4,
      }
    });
  },

  dismissHandoffAnimation: () => {
    set({ activeHandoffAnimation: null });
  }
}));
