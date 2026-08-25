import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SkillItem, DraggedSkillPayload, SkillCategory } from '../types/skills';
import { skillAggregatorService } from '../services/skillAggregator.service';
import { tauriService } from '../services';

interface SkillState {
  installedSkills: SkillItem[];
  favoriteSkills: SkillItem[]; // Full skill objects saved for instant offline/sidebar access
  equippedSkillsByAgent: Record<string, SkillItem[]>; // agentId -> skills
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
  equipSkillToAgent: (agentId: string, skill: SkillItem) => Promise<void>;
  unequipSkillFromAgent: (agentId: string, skillId: string) => void;
  getEquippedSkills: (agentId: string) => SkillItem[];
  isSkillInstalled: (skillId: string) => boolean;
}

export const useSkillStore = create<SkillState>()(
  persist(
    (set, get) => ({
      installedSkills: [],
      favoriteSkills: [],
      equippedSkillsByAgent: {},
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
        const exists = currentFavorites.some(s => s.id === skill.id);

        if (exists) {
          set({
            favoriteSkills: currentFavorites.filter(s => s.id !== skill.id),
          });
        } else {
          // Add to favorites and automatically ensure it is marked installed for drag-and-drop
          const updatedFavorites = [...currentFavorites, skill];
          const currentInstalled = get().installedSkills || [];
          const updatedInstalled = currentInstalled.some(s => s.id === skill.id)
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
        return currentFavorites.some(s => s.id === skillId);
      },

      isSkillInstalled: (skillId) => {
        const currentInstalled = get().installedSkills || [];
        return currentInstalled.some(s => s.id === skillId);
      },

      installSkill: async (skill) => {
        const current = get().installedSkills || [];
        if (current.some(s => s.id === skill.id)) return;

        const newSkill: SkillItem = {
          ...skill,
          isInstalled: true,
        };

        set({ installedSkills: [...current, newSkill] });

        // If in an active workspace, automatically mount the skill into project discovery directories
        try {
          const { useWorkspaceStore } = await import('./workspace.store');
          const activeWorkspace = useWorkspaceStore.getState().getActiveWorkspace();
          if (activeWorkspace?.projectPath) {
            const { ProviderSkillAdapterService } = await import('../services/providerSkillAdapter.service');
            await ProviderSkillAdapterService.mountSkillsForProvider(
              activeWorkspace.projectPath,
              'antigravity',
              [newSkill]
            );
            await ProviderSkillAdapterService.mountSkillsForProvider(
              activeWorkspace.projectPath,
              'claude',
              [newSkill]
            );
          }
        } catch (e) {
          console.warn('Native skill install auto-mount notice:', e);
        }
      },

      uninstallSkill: async (skillId) => {
        set({
          installedSkills: (get().installedSkills || []).filter(s => s.id !== skillId),
        });
      },

      equipSkillToAgent: async (agentId, skill) => {
        const currentEquipped = get().equippedSkillsByAgent[agentId] || [];
        if (currentEquipped.some(s => s.id === skill.id)) return;

        const updated = [...currentEquipped, skill];
        set({
          equippedSkillsByAgent: {
            ...get().equippedSkillsByAgent,
            [agentId]: updated,
          },
        });

        // 1. Mount into provider-native progressive disclosure path (.agents/skills or .claude/skills)
        try {
          const { useWorkspaceStore } = await import('./workspace.store');
          const { useAgentStore } = await import('./agent.store');
          const agent = useAgentStore.getState().agents.find(a => a.id === agentId);
          const activeWorkspace = useWorkspaceStore.getState().getActiveWorkspace();
          if (agent && activeWorkspace?.projectPath) {
            const { ProviderSkillAdapterService } = await import('../services/providerSkillAdapter.service');
            await ProviderSkillAdapterService.mountSkillsForProvider(
              activeWorkspace.projectPath,
              agent.provider,
              [skill]
            );
          }
        } catch (e) {
          console.warn('Progressive disclosure mount notice on equip:', e);
        }

        // 2. Stream natural provider-tailored command or mention directly into target PTY
        try {
          const { useAgentStore } = await import('./agent.store');
          const agent = useAgentStore.getState().agents.find(a => a.id === agentId);
          const slugName = (skill.shortLabel || skill.name)
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .replace(/-+/g, '-');

          let injectionText = '';
          if (agent?.provider === 'claude') {
            // Claude Code uses slash-command /skill or .claude/skills reference
            injectionText = `\n/use-skill ${slugName}\n[SKILL MOUNTED: .claude/skills/${slugName}/SKILL.md]\n`;
          } else if (agent?.provider === 'antigravity') {
            // Antigravity progressive disclosure standard reference
            injectionText = `\n[EQUIPPED SKILL: ${skill.name}]\nRead .agents/skills/${slugName}/SKILL.md for instructions and rules when relevant.\n`;
          } else {
            // Universal reference
            injectionText = `\n[EQUIPPED SKILL: ${skill.name}]\nLocation: .agents/skills/${slugName}/SKILL.md\nInstruction: Follow all guidelines in this skill for upcoming tasks.\n`;
          }

          await tauriService.sendAgentInput(agentId, 'default', injectionText);
        } catch (err) {
          console.warn('PTY skill stream injection notice:', err);
        }
      },

      unequipSkillFromAgent: (agentId, skillId) => {
        const currentEquipped = get().equippedSkillsByAgent[agentId] || [];
        set({
          equippedSkillsByAgent: {
            ...get().equippedSkillsByAgent,
            [agentId]: currentEquipped.filter(s => s.id !== skillId),
          },
        });
      },

      getEquippedSkills: (agentId) => {
        return get().equippedSkillsByAgent[agentId] || [];
      },
    }),
    {
      name: 'orbit-skills-storage-v2',
      partialize: (state) => ({
        installedSkills: state.installedSkills,
        favoriteSkills: state.favoriteSkills,
        equippedSkillsByAgent: state.equippedSkillsByAgent,
      }),
    }
  )
);
