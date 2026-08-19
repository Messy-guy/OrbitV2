import { create } from 'zustand';
import {
  ProjectContext,
  Checkpoint,
  HandoffSelection,
  ProjectDecision,
  ProjectIssue,
  GitState,
  HandoffRecord,
  ContextPackage,
  ChangedFileItem,
  ProjectActivityState,
  ContextDraft,
} from '../types/orbit';
import { contextService, handoffService } from '../services';
import { tauriService, isTauriAvailable } from '../services/tauri.service';
import { useAgentStore } from './agent.store';
import { useActivityStore } from './activity.store';

interface ContextState {
  currentContext: ProjectContext | null;
  checkpoints: Checkpoint[];
  gitState: GitState | null;
  handoffHistory: HandoffRecord[];
  isGeneratingHandoff: boolean;
  activityState: ProjectActivityState | null;
  contextDraft: ContextDraft | null;
  isDraftModalOpen: boolean;
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
  loadContextForWorkspace: (workspaceId: string, projectPath?: string) => Promise<void>;
  loadActivityState: (workspaceId: string) => Promise<void>;
  generateDraft: (workspaceId: string, projectPath: string) => Promise<ContextDraft | null>;
  setDraftModalOpen: (open: boolean) => void;
  applyDraft: (workspaceId: string, task: string, progress: number, activeWork: string) => Promise<void>;
  recordDecision: (workspaceId: string, title: string, description?: string, authorAgent?: string) => Promise<void>;
  resolveIssue: (workspaceId: string, issueId: string) => Promise<void>;
  loadGitState: (projectPath: string) => Promise<GitState>;
  loadHandoffHistory: (workspaceId: string) => Promise<void>;
  updateCurrentTask: (workspaceId: string, currentTask: string) => Promise<void>;
  updateGoal: (workspaceId: string, goal: string) => Promise<void>;
  updateProgress: (workspaceId: string, progress: number) => Promise<void>;
  updateActiveWork: (workspaceId: string, activeWork: string) => Promise<void>;
  addDecision: (workspaceId: string, decision: Omit<ProjectDecision, 'id' | 'timestamp'>) => Promise<void>;
  addIssue: (workspaceId: string, issue: Omit<ProjectIssue, 'id'>) => Promise<void>;
  createCheckpoint: (params: {
    workspaceId: string;
    name: string;
    task: string;
    progress: string;
    decisions: string[];
    knownIssues: string[];
    notes?: string;
    changedFiles: ChangedFileItem[];
    agentId?: string;
    agentName?: string;
  }) => Promise<Checkpoint>;
  deleteCheckpoint: (workspaceId: string, id: string) => Promise<void>;
  generateHandoffPreview: (
    sourceAgentName: string,
    sourceSessionTitle: string,
    targetAgentName: string,
    selection: HandoffSelection
  ) => any;
  executeHandoff: (params: {
    workspaceId: string;
    workspaceName: string;
    projectPath: string;
    sourceAgentId: string;
    sourceAgentName: string;
    sourceSessionId: string;
    targetAgentId: string;
    targetAgentName: string;
    targetProvider: string;
    targetSessionId: string;
    checkpointId?: string;
    selection: HandoffSelection;
    previewSummary: any;
  }) => Promise<void>;
  dismissHandoffAnimation: () => void;
}

export const useContextStore = create<ContextState>((set, get) => ({
  currentContext: null,
  checkpoints: [],
  gitState: null,
  handoffHistory: [],
  isGeneratingHandoff: false,
  activityState: null,
  contextDraft: null,
  isDraftModalOpen: false,
  activeHandoffAnimation: null,

  setDraftModalOpen: (open: boolean) => set({ isDraftModalOpen: open }),

  loadActivityState: async (workspaceId: string) => {
    const activity = await tauriService.getProjectActivity(workspaceId);
    if (activity) {
      set({ activityState: activity });
    }
  },

  generateDraft: async (workspaceId: string, projectPath: string) => {
    const draft = await tauriService.generateContextDraft(workspaceId, projectPath);
    if (draft) {
      set({ contextDraft: draft });
    }
    return draft;
  },

  applyDraft: async (workspaceId: string, task: string, progress: number, activeWork: string) => {
    const updated = await tauriService.applyContextDraft(workspaceId, task, progress, activeWork);
    if (updated) {
      set({ currentContext: updated, isDraftModalOpen: false });
    }
  },

  recordDecision: async (workspaceId: string, title: string, description?: string, authorAgent?: string) => {
    const dec = await tauriService.recordUserDecision(workspaceId, title, description, authorAgent);
    if (dec && get().currentContext) {
      set((state) => ({
        currentContext: state.currentContext
          ? { ...state.currentContext, decisions: [...state.currentContext.decisions, dec] }
          : null,
      }));
    }
  },

  resolveIssue: async (workspaceId: string, issueId: string) => {
    await tauriService.resolveProjectIssue(workspaceId, issueId);
    set((state) => ({
      currentContext: state.currentContext
        ? {
            ...state.currentContext,
            issues: state.currentContext.issues.map((i) =>
              i.id === issueId ? { ...i, status: 'resolved' as const } : i
            ),
          }
        : null,
    }));
  },

  loadContextForWorkspace: async (workspaceId: string, projectPath?: string) => {
    try {
      const ctx = await contextService.getContext(workspaceId);
      const chks = await contextService.getCheckpoints(workspaceId);
      const history = await handoffService.getHandoffHistory(workspaceId);
      let git: GitState | null = null;
      if (projectPath) {
        git = await contextService.getGitState(projectPath);
      }
      set({
        currentContext: ctx || null,
        checkpoints: chks,
        handoffHistory: history,
        gitState: git,
      });
    } catch (e) {
      console.error('Failed to load project context', e);
    }
  },

  loadGitState: async (projectPath: string) => {
    const git = await contextService.getGitState(projectPath);
    set({ gitState: git });
    return git;
  },

  loadHandoffHistory: async (workspaceId: string) => {
    const history = await handoffService.getHandoffHistory(workspaceId);
    set({ handoffHistory: history });
  },

  updateCurrentTask: async (workspaceId: string, currentTask: string) => {
    const { currentContext } = get();
    if (!currentContext) return;
    const updated = { ...currentContext, currentTask, updatedAt: Date.now() };
    await contextService.updateContext(updated);
    set({ currentContext: updated });
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

  updateActiveWork: async (workspaceId: string, activeWork: string) => {
    const { currentContext } = get();
    if (!currentContext) return;
    const updated = { ...currentContext, activeWork, updatedAt: Date.now() };
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

  createCheckpoint: async (params) => {
    const newChk: Checkpoint = {
      id: `chk-${Date.now()}`,
      workspaceId: params.workspaceId,
      name: params.name,
      task: params.task,
      progress: params.progress,
      decisions: params.decisions,
      knownIssues: params.knownIssues,
      notes: params.notes,
      changedFiles: params.changedFiles,
      agentId: params.agentId,
      agentName: params.agentName,
      createdAt: Date.now(),
    };

    await contextService.saveCheckpoint(newChk);
    set((state) => ({
      checkpoints: [newChk, ...state.checkpoints],
      currentContext: state.currentContext
        ? {
            ...state.currentContext,
            currentTask: params.task || state.currentContext.currentTask,
            lastCheckpointTime: 'Just now',
          }
        : null,
    }));

    useActivityStore.getState().addActivity(params.workspaceId, {
      type: 'checkpoint',
      agentId: params.agentId,
      agentName: params.agentName,
      description: `Checkpoint created: "${params.name}"`,
      details: params.progress,
    });

    return newChk;
  },

  deleteCheckpoint: async (workspaceId: string, id: string) => {
    await contextService.deleteCheckpoint(id);
    set((state) => ({
      checkpoints: state.checkpoints.filter((c) => c.id !== id),
    }));
  },

  generateHandoffPreview: (
    sourceAgentName: string,
    sourceSessionTitle: string,
    targetAgentName: string,
    selection: HandoffSelection
  ) => {
    const { currentContext, gitState } = get();
    if (!currentContext) return null;
    return handoffService.generateHandoffPreview(
      currentContext,
      sourceAgentName,
      sourceSessionTitle,
      targetAgentName,
      selection,
      gitState || undefined
    );
  },

  executeHandoff: async (params) => {
    set({ isGeneratingHandoff: true });
    const { currentContext, gitState } = get();

    // 1. Build formal ContextPackage
    const rawContextPackage: ContextPackage = await handoffService.buildContextPackage({
      sourceAgent: params.sourceAgentName,
      sourceSessionId: params.sourceSessionId,
      targetAgent: params.targetAgentName,
      workspaceId: params.workspaceId,
      workspaceName: params.workspaceName,
      projectPath: params.projectPath,
      checkpointId: params.checkpointId,
      currentTask: params.previewSummary.task,
      progress: params.previewSummary.progress,
      decisions: params.selection.includeDecisions
        ? (params.previewSummary.decisions?.length ? params.previewSummary.decisions : currentContext?.decisions.map((d) => d.title) || [])
        : [],
      changedFiles: params.selection.includeChangedFiles
        ? (params.previewSummary.relevantFiles?.map((f: string) => ({ path: f, status: 'modified' })) || gitState?.modifiedFiles || [])
        : [],
      knownIssues: params.selection.includeKnownIssues
        ? (params.previewSummary.currentIssue ? [params.previewSummary.currentIssue] : currentContext?.issues.map((i) => i.title) || [])
        : [],
      gitState: params.selection.includeGitState ? gitState || undefined : undefined,
      relevantHistory: params.previewSummary.summaryNarrative ? [params.previewSummary.summaryNarrative] : undefined,
    });

    const contextPackage: ContextPackage = {
      ...rawContextPackage,
      formattedInstruction: params.previewSummary.formattedInstruction || rawContextPackage.formattedInstruction,
      estimatedTokens: params.previewSummary.estimatedTokens || rawContextPackage.estimatedTokens,
    };

    // 2. Execute Handoff
    const { handoffRecord, targetMessage, agentReply } = await handoffService.executeHandoff(
      params.workspaceId,
      params.sourceAgentId,
      params.sourceAgentName,
      params.sourceSessionId,
      params.targetAgentId,
      params.targetAgentName,
      params.targetProvider,
      params.targetSessionId,
      params.selection,
      params.previewSummary,
      contextPackage
    );

    // 3. Inject message into target agent session & UI store
    const agentStore = useAgentStore.getState();
    agentStore.addDirectMessage(params.targetSessionId, targetMessage);

    // 4. Update handoff history state
    set((state) => ({
      handoffHistory: [handoffRecord, ...state.handoffHistory],
      isGeneratingHandoff: false,
      activeHandoffAnimation: {
        active: true,
        sourceAgentName: params.sourceAgentName,
        targetAgentName: params.targetAgentName,
        tokenCount: contextPackage.estimatedTokens || params.previewSummary.estimatedTokens || 2100,
        decisionCount: contextPackage.decisions.length,
        issueCount: contextPackage.knownIssues.length,
        fileCount: contextPackage.changedFiles.length,
      },
    }));

    // Record Activity
    const desc = `Context shared: ${params.sourceAgentName} → ${params.targetAgentName} (~${((contextPackage.estimatedTokens || 2100) / 1000).toFixed(1)}k tokens)`;
    useActivityStore.getState().addActivity(params.workspaceId, {
      type: 'handoff',
      agentId: params.sourceAgentId,
      agentName: params.sourceAgentName,
      description: desc,
    });
  },

  dismissHandoffAnimation: () => {
    set({ activeHandoffAnimation: null });
  },
}));
