import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SkillItem, DraggedSkillPayload, SkillCategory, AgentSkillAssignment } from '../types/skills';
import { skillAggregatorService } from '../services/skillAggregator.service';
import { ProviderSkillAdapterService } from '../services/providerSkillAdapter.service';
import { tauriService } from '../services';

interface SkillState {
  installedSkills: SkillItem[];
  favoriteSkills: SkillItem[]; // Full skill objects saved for instant offline/sidebar access
  assignmentsByAgent: Record<string, Record<string, AgentSkillAssignment>>; // agentId -> skillId -> assignment
  isBrowserModalOpen: boolean;
  activeFilterCategory: SkillCategory;
  searchQuery: string;
  draggedSkill: DraggedSkillPayload | null;

  setBrowserModalOpen: (open: boolean) => void;
  setFilterCategory: (category: SkillCategory) => void;
  setSearchQuery: (query: string) => void;
  setDraggedSkill: (skill: DraggedSkillPayload | null) => void;

  toggleFavorite: (skill: SkillItem) => void;
  isFavorite: (skillId: string) => boolean;

  installSkill: (skill: SkillItem) => Promise<void>;
  uninstallSkill: (skillId: string) => Promise<void>;
  equipSkillToAgent: (agentId: string, skill: SkillItem) => Promise<AgentSkillAssignment>;
  unequipSkillFromAgent: (agentId: string, skillId: string) => Promise<void>;
  getEquippedSkills: (agentId: string) => SkillItem[];
  getAgentSkillAssignments: (agentId: string) => AgentSkillAssignment[];
  isSkillInstalled: (skillId: string) => boolean;
}

// In-flight concurrency guards for (agentId:skillId)
const inFlightEquips = new Set<string>();

export const useSkillStore = create<SkillState>()(
  persist(
    (set, get) => ({
      installedSkills: [],
      favoriteSkills: [],
      assignmentsByAgent: {},
      isBrowserModalOpen: false,
      activeFilterCategory: 'all',
      searchQuery: '',
      draggedSkill: null,

      setBrowserModalOpen: (open) => set({ isBrowserModalOpen: open }),
      setFilterCategory: (category) => set({ activeFilterCategory: category }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setDraggedSkill: (skill) => set({ draggedSkill: skill }),

      toggleFavorite: (skill) => {
        const currentFavorites = get().favoriteSkills || [];
        const exists = currentFavorites.some((s) => s.id === skill.id);

        if (exists) {
          set({
            favoriteSkills: currentFavorites.filter((s) => s.id !== skill.id),
          });
        } else {
          // Add to favorites and automatically ensure it is marked installed for drag-and-drop
          const updatedFavorites = [...currentFavorites, skill];
          const currentInstalled = get().installedSkills || [];
          const updatedInstalled = currentInstalled.some((s) => s.id === skill.id)
            ? currentInstalled
            : [...currentInstalled, { ...skill, isInstalled: true }];

          set({
            favoriteSkills: updatedFavorites,
            installedSkills: updatedInstalled,
          });
        }
      },

      isFavorite: (skillId) => {
        const currentFavorites = get().favoriteSkills || [];
        return currentFavorites.some((s) => s.id === skillId);
      },

      isSkillInstalled: (skillId) => {
        const currentInstalled = get().installedSkills || [];
        return currentInstalled.some((s) => s.id === skillId);
      },

      installSkill: async (skill) => {
        const current = get().installedSkills || [];
        if (current.some((s) => s.id === skill.id)) return;

        const newSkill: SkillItem = {
          ...skill,
          isInstalled: true,
        };

        set({ installedSkills: [...current, newSkill] });
      },

      uninstallSkill: async (skillId) => {
        set({
          installedSkills: (get().installedSkills || []).filter((s) => s.id !== skillId),
        });
      },

      equipSkillToAgent: async (agentId: string, skill: SkillItem): Promise<AgentSkillAssignment> => {
        const lockKey = `${agentId}:${skill.id}`;
        if (inFlightEquips.has(lockKey)) {
          const existing = get().assignmentsByAgent[agentId]?.[skill.id];
          if (existing) return existing;
        }

        inFlightEquips.add(lockKey);

        const now = Date.now();
        const initialAssignment: AgentSkillAssignment = {
          agentId,
          skillId: skill.id,
          skill,
          status: 'mounting',
          provider: 'terminal',
          mountedPaths: [],
          integrationMode: 'orbit-assisted',
          managedByOrbit: true,
          createdAt: now,
        };

        try {
          // 1. Resolve agent and workspace existence
          const { useAgentStore } = await import('./agent.store');
          const { useWorkspaceStore } = await import('./workspace.store');

          const agent = useAgentStore.getState().agents.find((a) => a.id === agentId);
          if (!agent) {
            throw new Error(`Agent with ID '${agentId}' not found.`);
          }

          const activeWorkspace = useWorkspaceStore.getState().getActiveWorkspace();
          const projectPath = activeWorkspace?.projectPath;
          if (!projectPath) {
            throw new Error(`No active project workspace path available for agent '${agent.name}'.`);
          }

          initialAssignment.provider = agent.provider;

          // Check if already equipped (idempotency guard)
          const existingAssignment = get().assignmentsByAgent[agentId]?.[skill.id];
          if (existingAssignment?.status === 'equipped') {
            inFlightEquips.delete(lockKey);
            return existingAssignment;
          }

          // Record mounting state
          set((state) => ({
            assignmentsByAgent: {
              ...state.assignmentsByAgent,
              [agentId]: {
                ...(state.assignmentsByAgent[agentId] || {}),
                [skill.id]: initialAssignment,
              },
            },
          }));

          // 2. Mount skill into provider discovery path
          const mountResult = await ProviderSkillAdapterService.mountSkillForProvider(
            projectPath,
            agent.provider,
            skill
          );

          initialAssignment.mountedPaths = [mountResult.mountedPath];
          initialAssignment.integrationMode = mountResult.integrationMode;

          // 3. Send lightweight progressive disclosure notification to live PTY
          if (mountResult.notification) {
            const activeSessionId = useAgentStore.getState().activeSessionIdByAgent[agentId] || 'default';
            try {
              await tauriService.sendAgentInput(agentId, activeSessionId, mountResult.notification);
            } catch (err) {
              console.warn(`PTY notification notice for skill '${skill.name}':`, err);
            }
          }

          // 4. Record successful equipped state
          const completedAssignment: AgentSkillAssignment = {
            ...initialAssignment,
            status: 'equipped',
            equippedAt: Date.now(),
          };

          set((state) => ({
            assignmentsByAgent: {
              ...state.assignmentsByAgent,
              [agentId]: {
                ...(state.assignmentsByAgent[agentId] || {}),
                [skill.id]: completedAssignment,
              },
            },
          }));

          // Automatically ensure skill is in installed list
          get().installSkill(skill);

          inFlightEquips.delete(lockKey);
          return completedAssignment;
        } catch (error: any) {
          const failedAssignment: AgentSkillAssignment = {
            ...initialAssignment,
            status: 'failed',
            error: error?.message || 'Failed to equip skill',
          };

          set((state) => ({
            assignmentsByAgent: {
              ...state.assignmentsByAgent,
              [agentId]: {
                ...(state.assignmentsByAgent[agentId] || {}),
                [skill.id]: failedAssignment,
              },
            },
          }));

          inFlightEquips.delete(lockKey);
          return failedAssignment;
        }
      },

      unequipSkillFromAgent: async (agentId: string, skillId: string) => {
        const assignment = get().assignmentsByAgent[agentId]?.[skillId];
        if (!assignment) return;

        // 1. Remove from this agent's assignment map
        set((state) => {
          const agentMap = { ...(state.assignmentsByAgent[agentId] || {}) };
          delete agentMap[skillId];
          return {
            assignmentsByAgent: {
              ...state.assignmentsByAgent,
              [agentId]: agentMap,
            },
          };
        });

        // 2. Safe shared cleanup: only remove mounted file if no OTHER agent uses this skill
        try {
          const { useWorkspaceStore } = await import('./workspace.store');
          const activeWorkspace = useWorkspaceStore.getState().getActiveWorkspace();
          const projectPath = activeWorkspace?.projectPath;

          if (projectPath && assignment.managedByOrbit) {
            const allAssignments = get().assignmentsByAgent;
            let otherAgentDependsOnSkill = false;

            for (const [aId, map] of Object.entries(allAssignments)) {
              if (aId !== agentId && map[skillId]?.status === 'equipped') {
                otherAgentDependsOnSkill = true;
                break;
              }
            }

            if (!otherAgentDependsOnSkill) {
              for (const path of assignment.mountedPaths) {
                await tauriService.removeProjectSkillFile(projectPath, path);
              }
            }
          }
        } catch (err) {
          console.warn('Safe skill cleanup notice:', err);
        }
      },

      getEquippedSkills: (agentId: string) => {
        const map = get().assignmentsByAgent[agentId] || {};
        return Object.values(map)
          .filter((a) => a.status === 'equipped' || a.status === 'mounting')
          .map((a) => a.skill);
      },

      getAgentSkillAssignments: (agentId: string) => {
        const map = get().assignmentsByAgent[agentId] || {};
        return Object.values(map);
      },
    }),
    {
      name: 'orbit-skills-storage-v2',
      partialize: (state) => ({
        installedSkills: state.installedSkills,
        favoriteSkills: state.favoriteSkills,
        assignmentsByAgent: state.assignmentsByAgent,
      }),
    }
  )
);
