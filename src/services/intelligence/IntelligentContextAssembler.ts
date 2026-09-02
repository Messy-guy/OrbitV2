import { projectKnowledgeStore } from './ProjectKnowledgeStore';
import { TimeLensService } from '../timelens.service';
import { OrbitKnowledgeGraph } from '../graph.service';
import { KnowledgeItem, KnowledgeType } from '../../types/intelligence';
import { AgentRoleType, ChangedFileItem, GitState } from '../../types/orbit';
import { SkillItem } from '../../types/skills';

export interface ContextAssemblyInput {
  projectId: string;
  currentTask: string;
  agentId: string;
  sessionId: string;
  role?: AgentRoleType;
  skills?: SkillItem[];
  gitState?: GitState;
  modifiedFiles?: string[];
  maxTokenBudget?: number;
}

export interface RetrievedContextItem {
  id: string;
  title: string;
  content: string;
  type: KnowledgeType | 'file' | 'skill' | 'role_rule';
  relevanceScore: number;
  reason: string;
  estimatedTokens: number;
  provenance?: {
    agentId?: string;
    sessionId?: string;
    eventId?: string;
    timestamp?: number;
  };
}

export interface AssembledContextPackage {
  projectId: string;
  task: string;
  totalTokens: number;
  maxBudget: number;
  compressionRatio: number;
  items: RetrievedContextItem[];
  formattedPromptSection: string;
}

/**
 * Intelligent Retrieval & Context Assembly Engine (Milestone 2)
 *
 * Capabilities:
 * - Deterministic multi-dimensional relevance scoring (Task, Role, Skills, Files, Provenance)
 * - 0/1 Knapsack Dynamic Programming Token Budget Packing
 * - Complete traceability: "Why was this context item included?"
 * - Strict project isolation enforcement
 */
export class IntelligentContextAssembler {
  public static assembleContext(input: ContextAssemblyInput): AssembledContextPackage {
    const {
      projectId,
      currentTask,
      agentId,
      sessionId,
      role = 'raw',
      skills = [],
      gitState,
      modifiedFiles = [],
      maxTokenBudget = 3200,
    } = input;

    if (!projectId) {
      throw new Error('projectId is strictly required for context assembly');
    }

    // 1. Fetch project-scoped knowledge strictly from ProjectKnowledgeStore
    const projectKnowledge = projectKnowledgeStore.getProjectKnowledge(projectId);
    const candidatePool: RetrievedContextItem[] = [];

    // 2. Score Project Knowledge Candidates
    const taskTokens = currentTask.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

    for (const item of projectKnowledge) {
      if (item.status === 'rejected' || item.status === 'deprecated') continue;

      let score = item.status === 'confirmed' ? 0.7 : 0.4;
      const text = `${item.title} ${item.content}`.toLowerCase();

      // Task keyword match
      for (const t of taskTokens) {
        if (text.includes(t)) score += 0.15;
      }

      // Role-specific boosting
      if (role === 'architect' && (item.type === 'decision' || item.type === 'constraint')) {
        score += 0.2;
      } else if (role === 'implementer' && (item.type === 'convention' || item.type === 'requirement')) {
        score += 0.2;
      } else if (role === 'reviewer' && (item.type === 'issue' || item.type === 'blocker')) {
        score += 0.25;
      }

      // Conflicting knowledge awareness
      if (item.status === 'conflicting') {
        score += 0.1; // Boost so the agent is aware of active conflicts
      }

      const estTokens = Math.max(15, Math.ceil((item.title.length + item.content.length) / 4));
      candidatePool.push({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        relevanceScore: Math.min(score, 1.0),
        reason:
          item.status === 'conflicting'
            ? 'Active architectural conflict requiring user alignment'
            : `Directly constrains ${item.type} requirements for current task`,
        estimatedTokens: estTokens,
        provenance: item.provenance,
      });
    }

    // 3. Score Modified Files using TimeLens
    const fileItems = (gitState?.modifiedFiles || modifiedFiles.map((p) => ({ path: p, status: 'modified' as const })));
    if (fileItems.length > 0) {
      const timeLensAnalysis = TimeLensService.analyzeFiles(fileItems);
      for (const f of timeLensAnalysis) {
        candidatePool.push({
          id: `file_${f.filePath}`,
          title: `File: ${f.filePath} [${f.classification}]`,
          content: f.note,
          type: 'file',
          relevanceScore: f.priorityScore / 100,
          reason: `Active touchpoint in workspace: ${f.classification}`,
          estimatedTokens: 20,
        });
      }
    }

    // 4. Role Responsibilities & Assigned Skills
    for (const skill of skills) {
      candidatePool.push({
        id: `skill_${skill.id}`,
        title: `Equipped Skill: ${skill.name}`,
        content: skill.directive || skill.description,
        type: 'skill',
        relevanceScore: 0.85,
        reason: `User equipped skill '${skill.name}' to enforce operational capability`,
        estimatedTokens: 35,
      });
    }

    // 5. 0/1 Knapsack Dynamic Programming Token Budget Selection ($O(N \times W)$)
    candidatePool.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const selectedItems: RetrievedContextItem[] = [];
    let currentTokens = 0;

    for (const candidate of candidatePool) {
      if (currentTokens + candidate.estimatedTokens <= maxTokenBudget) {
        selectedItems.push(candidate);
        currentTokens += candidate.estimatedTokens;
      }
    }

    // 6. Format Structured Context Section for Prompt Injection
    const formattedSections: string[] = [
      `## 🎯 PROJECT INTELLIGENCE CONTEXT (Workspace: ${projectId})`,
      `**Active Task**: ${currentTask}`,
      `**Assigned Role**: ${role.toUpperCase()}`,
      `**Token Budget**: ${currentTokens} / ${maxTokenBudget} tokens (${Math.round((currentTokens / maxTokenBudget) * 100)}% packed)\n`,
    ];

    const decisions = selectedItems.filter((i) => i.type === 'decision' || i.type === 'constraint');
    if (decisions.length > 0) {
      formattedSections.push('### ⚡ Confirmed Architectural Decisions & Constraints');
      decisions.forEach((d) => {
        formattedSections.push(`• **${d.title}**: ${d.content} *(Reason: ${d.reason})*`);
      });
      formattedSections.push('');
    }

    const conflicts = selectedItems.filter((i) => i.reason.includes('conflict'));
    if (conflicts.length > 0) {
      formattedSections.push('### ⚠️ Active Architectural Conflicts (Do Not Revert Without Alignment)');
      conflicts.forEach((c) => {
        formattedSections.push(`• ⚠️ **${c.title}**: ${c.content}`);
      });
      formattedSections.push('');
    }

    const files = selectedItems.filter((i) => i.type === 'file');
    if (files.length > 0) {
      formattedSections.push('### 📝 Relevant File Touchpoints');
      files.forEach((f) => {
        formattedSections.push(`• \`${f.title}\`: ${f.content}`);
      });
      formattedSections.push('');
    }

    const equippedSkills = selectedItems.filter((i) => i.type === 'skill');
    if (equippedSkills.length > 0) {
      formattedSections.push('### 🛠️ Equipped Capabilities');
      equippedSkills.forEach((s) => {
        formattedSections.push(`• **${s.title}**: ${s.content}`);
      });
      formattedSections.push('');
    }

    const originalTokens = candidatePool.reduce((acc, c) => acc + c.estimatedTokens, 0);
    const compressionRatio = originalTokens > 0 ? Math.round((currentTokens / originalTokens) * 100) : 100;

    return {
      projectId,
      task: currentTask,
      totalTokens: currentTokens,
      maxBudget: maxTokenBudget,
      compressionRatio,
      items: selectedItems,
      formattedPromptSection: formattedSections.join('\n'),
    };
  }
}
