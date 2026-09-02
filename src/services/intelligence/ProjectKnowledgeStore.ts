import { KnowledgeItem, KnowledgeStatus, PROJECT_INTELLIGENCE_SCHEMA_VERSION } from '../../types/intelligence';

/**
 * Authoritative Project Knowledge Store
 *
 * Core Invariant:
 * Every lookup, mutation, and query requires `projectId`.
 * Cross-project queries are strictly forbidden.
 */
export class ProjectKnowledgeStore {
  private itemsByProject: Map<string, Map<string, KnowledgeItem>> = new Map();
  private storagePrefix = 'orbit_project_knowledge_v1_';

  constructor() {
    this.loadAllFromStorage();
  }

  private loadAllFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          const projectId = key.slice(this.storagePrefix.length);
          const raw = localStorage.getItem(key);
          if (raw) {
            const list: KnowledgeItem[] = JSON.parse(raw);
            const projectMap = new Map<string, KnowledgeItem>();
            for (const item of list) {
              if (item.projectId === projectId) {
                projectMap.set(item.id, item);
              }
            }
            this.itemsByProject.set(projectId, projectMap);
          }
        }
      }
    } catch (e) {
      console.warn('[ProjectKnowledgeStore] Failed to load from storage:', e);
    }
  }

  private saveProjectToStorage(projectId: string) {
    if (typeof localStorage === 'undefined') return;
    try {
      const projectMap = this.itemsByProject.get(projectId);
      if (!projectMap) return;
      const list = Array.from(projectMap.values());
      localStorage.setItem(`${this.storagePrefix}${projectId}`, JSON.stringify(list));
    } catch (e) {
      console.warn(`[ProjectKnowledgeStore] Failed to save project ${projectId}:`, e);
    }
  }

  /**
   * Strictly project-scoped query (§2, §22)
   */
  getProjectKnowledge(projectId: string, filterStatus?: KnowledgeStatus): KnowledgeItem[] {
    if (!projectId) return [];
    const projectMap = this.itemsByProject.get(projectId);
    if (!projectMap) return [];

    let list = Array.from(projectMap.values());
    if (filterStatus) {
      list = list.filter((item) => item.status === filterStatus);
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getKnowledgeItem(projectId: string, id: string): KnowledgeItem | undefined {
    if (!projectId || !id) return undefined;
    return this.itemsByProject.get(projectId)?.get(id);
  }

  /**
   * Save or incrementally update a knowledge item
   */
  upsertKnowledgeItem(item: KnowledgeItem): KnowledgeItem {
    if (!item.projectId) {
      throw new Error('Attempted to store knowledge item without a projectId');
    }

    let projectMap = this.itemsByProject.get(item.projectId);
    if (!projectMap) {
      projectMap = new Map();
      this.itemsByProject.set(item.projectId, projectMap);
    }

    const existing = projectMap.get(item.id);
    const updated: KnowledgeItem = {
      ...item,
      createdAt: existing?.createdAt || item.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    projectMap.set(updated.id, updated);
    this.saveProjectToStorage(item.projectId);
    return updated;
  }

  /**
   * Detect and record knowledge conflicts (§8)
   */
  registerConflict(projectId: string, itemAId: string, itemBId: string) {
    const itemA = this.getKnowledgeItem(projectId, itemAId);
    const itemB = this.getKnowledgeItem(projectId, itemBId);
    if (!itemA || !itemB) return;

    itemA.status = 'conflicting';
    itemA.conflictsWith = Array.from(new Set([...(itemA.conflictsWith || []), itemBId]));

    itemB.status = 'conflicting';
    itemB.conflictsWith = Array.from(new Set([...(itemB.conflictsWith || []), itemAId]));

    this.upsertKnowledgeItem(itemA);
    this.upsertKnowledgeItem(itemB);
  }

  /**
   * Human confirmation of candidate knowledge (§25)
   */
  confirmKnowledge(projectId: string, id: string, confirmedBy = 'user'): KnowledgeItem | undefined {
    const item = this.getKnowledgeItem(projectId, id);
    if (!item) return undefined;

    item.status = 'confirmed';
    item.confidence = 1.0;
    item.confirmedBy = confirmedBy;
    item.confirmedAt = Date.now();
    return this.upsertKnowledgeItem(item);
  }

  /**
   * Human deprecation / rejection
   */
  setKnowledgeStatus(projectId: string, id: string, status: KnowledgeStatus): KnowledgeItem | undefined {
    const item = this.getKnowledgeItem(projectId, id);
    if (!item) return undefined;

    item.status = status;
    return this.upsertKnowledgeItem(item);
  }
}

export const projectKnowledgeStore = new ProjectKnowledgeStore();
