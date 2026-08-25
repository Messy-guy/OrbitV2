// Data types for Orbit Skill Intelligence & Aggregator System

export type SkillSource = 'vercel' | 'skills_sh' | 'github' | 'official' | 'local' | 'codex' | 'agy' | 'custom';

export type SkillCategory = 'popular' | 'favorites' | 'all' | 'framework' | 'testing' | 'security' | 'design' | 'backend' | 'workflow';

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
}

export interface DraggedSkillPayload {
  id: string;
  name: string;
  source: SkillSource;
  directive: string;
}
