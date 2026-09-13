// Data types for Orbit Skill Intelligence & Aggregator System
import { AgentProvider } from './orbit';

export type SkillSource = 'vercel' | 'skills_sh' | 'github' | 'official' | 'local' | 'codex' | 'agy' | 'custom';

export type SkillCategory = 'popular' | 'favorites' | 'all' | 'framework' | 'testing' | 'security' | 'design' | 'backend' | 'workflow';

export type SkillIntegrationMode = 'native' | 'orbit-assisted' | 'filesystem';

export type SkillAssignmentStatus = 'pending' | 'mounting' | 'equipped' | 'failed' | 'removed';

export interface SkillItem {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  source: SkillSource;
  sourceLabel: string;
  category: SkillCategory;
  author?: string;
  tags: string[];
  rawContent?: string;
  rawUrl?: string;
  directive: string;
  isInstalled?: boolean;
  isPopular?: boolean;
  installedPath?: string;
  icon?: string;
  /** Complete files for multi-file skills imported from GitHub. */
  files?: SkillBundleFile[];
  sourceRef?: string;
  commitSha?: string;
  trust?: 'bundled' | 'verified' | 'community' | 'unreviewed';
  dependencies?: SkillDependency[];
}

export interface SkillBundleFile {
  relativePath: string;
  content: string;
  size: number;
}

export interface SkillDependency {
  name: string;
  kind: 'tool' | 'service' | 'runtime' | 'command';
  required: boolean;
}

export interface DraggedSkillPayload {
  id: string;
  name: string;
  source: SkillSource;
  directive: string;
}

export interface AgentSkillAssignment {
  workspaceId: string;
  agentId: string;
  skillId: string;
  skill: SkillItem;
  status: SkillAssignmentStatus;
  provider: AgentProvider;
  mountedPaths: string[];
  integrationMode: SkillIntegrationMode;
  managedByOrbit: boolean;
  createdAt: number;
  equippedAt?: number;
  removedAt?: number;
  error?: string;
}

export interface ProviderSkillCapabilities {
  provider: AgentProvider;
  integrationMode: SkillIntegrationMode;
  skillDirectory: string;
  supportsNativeDiscovery: boolean;
  supportsNativeActivation: boolean;
  resolveSkillPath: (skillSlug: string) => string;
  getActivationInstruction?: (skill: SkillItem) => string | null;
  getNotification: (skill: SkillItem, mountedPath: string) => string | null;
}
