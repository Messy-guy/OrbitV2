import { PtyConversationClassifier, ClassifiedScreenOutput } from '../classification/PtyConversationClassifier';
import { ActivitySummary } from '../../../types/conversation';

export interface SemanticScreenAnalysis {
  userFacingText: string;
  activities: ActivitySummary[];
  isThinking: boolean;
  thought?: string;
  workspacePath?: string;
  activeMode?: string;
}

export class ScreenSnapshot {
  readonly rows: number;
  readonly cols: number;
  readonly lines: string[];
  readonly timestamp: number;
  readonly generation: number;

  constructor(grid: string[][], rows: number, cols: number, generation = 0) {
    this.rows = rows;
    this.cols = cols;
    this.timestamp = Date.now();
    this.generation = generation;
    this.lines = grid.map((row) => row.join('').trimEnd());
  }

  getText(): string {
    return this.lines.join('\n').trim();
  }

  analyzeSemanticOutput(latestUserPrompt?: string, sessionId?: string): SemanticScreenAnalysis {
    const rawLines = this.lines;
    let startIndex = 0;

    // 1. Precise Prompt Anchor Detection: Ignore assistant conversational text and match exact prompt bars
    if (latestUserPrompt && latestUserPrompt.trim().length > 0) {
      const promptNorm = latestUserPrompt.trim().toLowerCase();
      for (let i = rawLines.length - 1; i >= 0; i--) {
        const l = rawLines[i].trim().toLowerCase();

        // Ignore lines containing natural conversational assistant phrases
        if (/how can i|assist you|what would you like|ready whenever|let me know|jump right in/i.test(l)) {
          continue;
        }

        if (
          l === promptNorm ||
          l.startsWith(`${promptNorm}─`) ||
          l.startsWith(`${promptNorm}-`) ||
          l.startsWith(`> /plan ${promptNorm}`) ||
          l.startsWith(`/plan ${promptNorm}`) ||
          l.startsWith(`> ${promptNorm}`) ||
          l.startsWith(`› ${promptNorm}`) ||
          l.startsWith(`| ${promptNorm}`) ||
          l.startsWith(`│ ${promptNorm}`) ||
          l.startsWith(`$ ${promptNorm}`) ||
          l.startsWith(`❯ ${promptNorm}`) ||
          (l.startsWith(promptNorm) && l.includes('───'))
        ) {
          startIndex = i + 1;
          break;
        }
      }
    }

    const slicedLines = rawLines.slice(startIndex);
    const classified: ClassifiedScreenOutput = PtyConversationClassifier.classifyLines(slicedLines, latestUserPrompt, sessionId);

    let workspacePath: string | undefined;
    let activeMode: string | undefined;

    for (const line of slicedLines) {
      const trimmed = line.trim();
      const pathMatch = trimmed.match(/^(\/(home|Users|var|tmp|etc)[a-zA-Z0-9_.\-/]+|~[a-zA-Z0-9_.\-/]+)$/i);
      if (pathMatch) {
        workspacePath = pathMatch[0];
      }
      const modeMatch =
        trimmed.match(/^(Plan|Build|Chat|Explore)\s*·\s*([a-zA-Z0-9.\s]+)(?:·\s*[0-9.]+[ms|s])?/i) ||
        trimmed.match(/(Gemini\s*3\.7\s*Flash|Claude\s*3\.7|GPT-4o)/i);
      if (modeMatch && trimmed.length < 40) {
        activeMode = modeMatch[1];
      }
    }

    return {
      userFacingText: classified.userFacingText,
      activities: classified.activities,
      isThinking: classified.isThinking,
      thought: classified.thought,
      workspacePath,
      activeMode,
    };
  }

  getCleanConversationalText(latestUserPrompt?: string, sessionId?: string): {
    text: string;
    isThinking: boolean;
    thought?: string;
    workspacePath?: string;
    activeMode?: string;
  } {
    const analysis = this.analyzeSemanticOutput(latestUserPrompt, sessionId);
    return {
      text: analysis.userFacingText,
      isThinking: analysis.isThinking,
      thought: analysis.thought,
      workspacePath: analysis.workspacePath,
      activeMode: analysis.activeMode,
    };
  }
}
