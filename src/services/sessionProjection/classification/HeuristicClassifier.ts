import { SessionEventType } from '../events/OrbitSessionEvent';
import { TuiChromeFilter } from './TuiChromeFilter';

export interface ClassifiedResult {
  type: SessionEventType;
  confidence: number;
  thought?: string;
  metadata?: {
    toolName?: string;
    filePath?: string;
    diffSummary?: string;
  };
}

export class HeuristicClassifier {
  static classify(text: string): ClassifiedResult {
    const trimmed = text.trim();

    // 1. TUI Chrome check
    const chromeResult = TuiChromeFilter.isChrome(trimmed);
    if (chromeResult.isChrome) {
      return {
        type: 'terminal_chrome',
        confidence: chromeResult.confidence,
      };
    }

    // 2. Git Diff check (+++, ---, @@, diff --git)
    if (
      trimmed.includes('diff --git') ||
      (trimmed.includes('--- a/') && trimmed.includes('+++ b/')) ||
      /^@@ -\d+,\d+ \+\d+,\d+ @@/m.test(trimmed)
    ) {
      return {
        type: 'git_diff',
        confidence: 0.95,
        metadata: {
          diffSummary: trimmed.slice(0, 300),
        },
      };
    }

    // 3. Tool Activity check (read_file, edit_file, bash, vitest, cargo test)
    const toolMatch =
      trimmed.match(/(?:Reading|Writing|Editing|Running|Executing|Checking)\s+([a-zA-Z0-9_.\-/]+)/i) ||
      trimmed.match(/(?:read_file|edit_file|bash|grep|npm test|vitest|cargo)/i);

    if (toolMatch) {
      return {
        type: 'tool_activity',
        confidence: 0.88,
        metadata: {
          toolName: toolMatch[0],
          filePath: toolMatch[1],
        },
      };
    }

    // 4. Agent Reasoning / Thought check (thinking, <thought>, reasoning)
    const thoughtMatch = trimmed.match(/<thought>([\s\S]*?)<\/thought>/i) || trimmed.match(/Thinking Process:\n([\s\S]*?)(?=\n\n|\n[A-Z])/i);
    if (thoughtMatch) {
      return {
        type: 'agent_message',
        confidence: 0.92,
        thought: thoughtMatch[1].trim(),
      };
    }

    // 5. Default: Agent natural message / response
    if (trimmed.length > 0) {
      return {
        type: 'agent_message',
        confidence: 0.85,
      };
    }

    return {
      type: 'unknown',
      confidence: 0.5,
    };
  }
}
