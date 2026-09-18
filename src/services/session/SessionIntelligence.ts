import { OrbitSession, ConversationTurn } from '../../types/conversation';
import {
  ClassifiedConversationSnippet,
  ConversationSnippetCategory,
  EngineeringProgress,
  ProjectDecision,
  ProjectInvariant,
  VerificationLevel,
} from '../../types/provenance';

export interface ExtractedSessionIntelligence {
  sessionId: string;
  agentId: string;
  primaryGoal: string;
  currentTask: string;
  progress: EngineeringProgress;
  claimedDecisions: Array<{
    id: string;
    statement: string;
    rationale?: string;
    turnId: string;
  }>;
  claimedInvariants: Array<{
    id: string;
    statement: string;
    rationale?: string;
    turnId: string;
  }>;
  claimedFileChanges: Array<{
    path: string;
    status: string;
    diffSnippet?: string;
    turnId: string;
  }>;
  claimedIssues: Array<{
    id: string;
    issue: string;
    status: 'open' | 'investigating' | 'resolved';
    turnId: string;
  }>;
  failedApproaches: Array<{
    attempt: string;
    result: string;
    reason: string;
    turnId: string;
  }>;
  classifiedConversation: ClassifiedConversationSnippet[];
  immediateNextAction: {
    action: string;
    targetFiles: string[];
  };
}

export class SessionIntelligence {
  /**
   * Evaluates if text represents a real engineering goal vs terminal control command
   */
  static isValidGoal(text?: string): boolean {
    if (!text) return false;
    const t = text.trim();
    if (t.length < 5) return false;
    if (/^\/(?:res|resume|clear|clean|model|help|reset|exit|quit|compact|cost|history)\b/i.test(t)) return false;
    if (/^Working\b|^CLI\s+Other|^Keyboard:|^Conversations/i.test(t)) return false;
    if (/\b\d+\s+steps\b/i.test(t)) return false;
    return true;
  }

  /**
   * Classifies a conversation turn into a semantic category
   */
  static classifyTurn(
    turn: ConversationTurn,
    speaker: 'user' | 'agent',
    content: string
  ): ClassifiedConversationSnippet | null {
    const trimmed = content.trim();
    if (!trimmed || !this.isValidGoal(trimmed)) return null;

    let category: ConversationSnippetCategory = 'recent_execution';

    if (speaker === 'user') {
      if (
        /must|should|need to|require|ensure|please|implement|create|fix|add|refactor|update/i.test(trimmed) ||
        trimmed.startsWith('Do not') ||
        trimmed.startsWith('Always')
      ) {
        category = 'user_requirement';
      } else if (/\?$/i.test(trimmed) || /can we|should we|how about/i.test(trimmed)) {
        category = 'unresolved_question';
      }
    } else {
      if (
        /decided to|chosen|standardized|pattern|we will use|architectural invariant|adopt/i.test(trimmed)
      ) {
        category = 'architectural_decision';
      } else if (
        /error|failed|panic|exception|cannot find|invalid|bug|fix/i.test(trimmed)
      ) {
        category = 'error_investigation';
      } else if (
        /created|modified|updated|wrote|tested|ran tool|executed/i.test(trimmed) ||
        (turn.activities && turn.activities.length > 0)
      ) {
        category = 'implementation_detail';
      }
    }

    const summaryLine = trimmed.split('\n')[0].slice(0, 160);
    return {
      id: `snip_${turn.id}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      turnId: turn.id,
      speaker,
      summary: summaryLine,
      detail: trimmed.length > 160 ? trimmed.slice(0, 500) : undefined,
      source: 'canonical_session',
      timestamp: turn.startedAt || Date.now(),
    };
  }

  /**
   * Extracts structured intelligence from canonical session turns
   */
  static extractFromSession(session: OrbitSession): ExtractedSessionIntelligence {
    const turns = session.conversation?.turns || [];
    const classifiedConversation: ClassifiedConversationSnippet[] = [];
    const completedWork: string[] = [];
    const activeWork: string[] = [];
    const blockedWork: string[] = [];
    const claimedDecisions: ExtractedSessionIntelligence['claimedDecisions'] = [];
    const claimedInvariants: ExtractedSessionIntelligence['claimedInvariants'] = [];
    const claimedFileChanges: ExtractedSessionIntelligence['claimedFileChanges'] = [];
    const claimedIssues: ExtractedSessionIntelligence['claimedIssues'] = [];
    const failedApproaches: ExtractedSessionIntelligence['failedApproaches'] = [];

    const FILE_PATH_REGEX = /(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g;
    const DECISION_REGEX = /(?:decided to|chosen|agreed upon|standardized|we have adopted)\s+([^\n\r.]+)/i;
    const INVARIANT_REGEX = /(?:invariant|rule|never|always must|guarantee)\s*:?\s*([^\n\r.]+)/i;
    const ERROR_REGEX = /(?:error|failed|exception|panic|fatal|cannot find|invalid):?\s*([^\n\r]+)/i;
    const FAILED_REGEX = /(?:failed to|attempted to|tried|could not)\s+([^,;\n\r]+)(?:,\s*but\s+([^,;\n\r.]+))?/i;

    let primaryGoal = '';
    let currentTask = '';

    for (const turn of turns) {
      const speaker: 'user' | 'agent' = turn.role === 'user' ? 'user' : 'agent';
      let turnText = '';
      for (const msg of turn.messages) {
        for (const item of msg.content) {
          if (item.type === 'text') turnText += (turnText ? '\n' : '') + (item.text || '');
          else if (item.type === 'markdown') turnText += (turnText ? '\n' : '') + (item.markdown || '');
        }
      }

      const snippet = this.classifyTurn(turn, speaker, turnText);
      if (snippet) {
        classifiedConversation.push(snippet);
      }

      if (speaker === 'user') {
        if (!primaryGoal && this.isValidGoal(turnText)) {
          primaryGoal = turnText.split('\n')[0].trim();
        }
        if (this.isValidGoal(turnText)) {
          currentTask = turnText.split('\n')[0].trim();
          activeWork.push(currentTask);
        }
      } else {
        // Agent turn analysis
        const fileMatches = turnText.match(FILE_PATH_REGEX);
        if (fileMatches) {
          for (const f of fileMatches) {
            if (!f.includes('node_modules') && !f.includes('target/') && !f.startsWith('http')) {
              claimedFileChanges.push({
                path: f,
                status: 'modified',
                turnId: turn.id,
              });
            }
          }
        }

        const decMatch = turnText.match(DECISION_REGEX);
        if (decMatch && decMatch[1] && decMatch[1].trim().length > 6) {
          claimedDecisions.push({
            id: `dec_${claimedDecisions.length + 1}`,
            statement: decMatch[0].trim(),
            turnId: turn.id,
          });
        }

        const invMatch = turnText.match(INVARIANT_REGEX);
        if (invMatch && invMatch[1] && invMatch[1].trim().length > 6) {
          claimedInvariants.push({
            id: `inv_${claimedInvariants.length + 1}`,
            statement: invMatch[0].trim(),
            turnId: turn.id,
          });
        }

        const errMatch = turnText.match(ERROR_REGEX);
        if (errMatch && errMatch[1] && errMatch[1].trim().length > 5) {
          const errText = errMatch[0].trim();
          claimedIssues.push({
            id: `iss_${claimedIssues.length + 1}`,
            issue: errText,
            status: turnText.toLowerCase().includes('fixed') || turnText.toLowerCase().includes('resolved') ? 'resolved' : 'open',
            turnId: turn.id,
          });
          if (!turnText.toLowerCase().includes('fixed')) {
            blockedWork.push(errText);
          }
        }

        const failMatch = turnText.match(FAILED_REGEX);
        if (failMatch && failMatch[1] && failMatch[1].trim().length > 6) {
          failedApproaches.push({
            attempt: failMatch[1].trim(),
            result: 'failed',
            reason: failMatch[2]?.trim() || 'Observed failure in agent trajectory',
            turnId: turn.id,
          });
        }

        // Process activities
        if (turn.activities) {
          for (const act of turn.activities) {
            completedWork.push(act.summary);
          }
        } else if (turnText.trim() && this.isValidGoal(turnText)) {
          completedWork.push(turnText.split('\n')[0].slice(0, 120));
        }
      }
    }

    if (!primaryGoal) {
      primaryGoal = session.title || 'Active workspace implementation and verification';
    }
    if (!currentTask) {
      currentTask = primaryGoal;
    }

    const lastCompleted = completedWork[completedWork.length - 1] || 'Verified system requirements';
    const nextActionText = `Continue implementation from prior state: ${lastCompleted}. Verify against test suite.`;

    const progress: EngineeringProgress = {
      completed: Array.from(new Set(completedWork.slice(-10))),
      active: Array.from(new Set(activeWork.slice(-5))),
      blocked: Array.from(new Set(blockedWork)),
      next: nextActionText,
    };

    return {
      sessionId: session.id,
      agentId: session.engine?.id || 'agent',
      primaryGoal,
      currentTask,
      progress,
      claimedDecisions,
      claimedInvariants,
      claimedFileChanges,
      claimedIssues,
      failedApproaches,
      classifiedConversation: classifiedConversation.slice(-25),
      immediateNextAction: {
        action: nextActionText,
        targetFiles: claimedFileChanges.map((c) => c.path).slice(0, 5),
      },
    };
  }
}
