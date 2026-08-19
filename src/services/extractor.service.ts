/**
 * Universal Session Extractor
 * Ingests raw PTY terminal output (xterm) or chat messages across any AI CLI (Antigravity, OpenCode, Claude Code, Codex, Bash)
 * and extracts clean conversation turns, tools executed, errors encountered, and file changes.
 */

export interface ExtractedTurn {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  toolsExecuted?: Array<{ name: string; target?: string; status: 'completed' | 'failed' }>;
  errorsEncountered?: string[];
  filesReferenced?: string[];
}

export interface ExtractedSessionData {
  agentId: string;
  sessionId: string;
  turns: ExtractedTurn[];
  primaryGoal?: string;
  filesTouched: string[];
  blockersFound: string[];
  decisionsFormulated: string[];
  lastUnfinishedStep?: string;
}

export class UniversalSessionExtractor {
  /**
   * Strips ANSI escape sequences, color codes, CSI sequences, and terminal cursor repositioning
   */
  public static stripAnsi(text: string): string {
    return text
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // CSI sequences
      .replace(/\x1b\([a-zA-Z]/g, '')         // Character set
      .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '') // OSC sequences
      .replace(/\x1b[PX^_].*?\x1b\\/g, '')     // DCS, PM, APC
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Non-printable control codes
  }

  /**
   * Deduplicates progress-bar redraws and spinner spam via rolling line hashing
   */
  public static cleanTerminalNoise(rawText: string): string[] {
    const clean = this.stripAnsi(rawText);
    const lines = clean.split(/\r?\n/);
    const result: string[] = [];
    let prevLine = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Skip common progress spinner noise
      if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\-\|\/\\]\s+/.test(line)) continue;
      if (/^\[\s*\d+%\s*\]/.test(line) && line === prevLine) continue;

      // Skip duplicate consecutive lines
      if (line === prevLine) continue;

      prevLine = line;
      result.push(line);
    }

    return result;
  }

  /**
   * Universal extractor from raw PTY terminal history buffer
   */
  public static extractFromTerminalHistory(agentId: string, sessionId: string, rawTerminalHistory: string): ExtractedSessionData {
    const lines = this.cleanTerminalNoise(rawTerminalHistory);
    const turns: ExtractedTurn[] = [];
    const filesTouched = new Set<string>();
    const blockersFound = new Set<string>();
    const decisionsFormulated = new Set<string>();

    let currentTurn: ExtractedTurn | null = null;
    let primaryGoal = '';
    let lastUnfinishedStep = '';

    const finalizeTurn = () => {
      if (currentTurn && currentTurn.content.trim()) {
        turns.push({ ...currentTurn });
        currentTurn = null;
      }
    };

    // Regex matchers for CLI prompts & events
    const USER_PROMPT_REGEX = /^(?:>|\$|❯|>>>|Ask anything\.\.\.|Orbit Handoff from|\?\s+Prompt:)\s*(.*)/i;
    const FILE_PATH_REGEX = /(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g;
    const ERROR_REGEX = /(?:error|failed|exception|panic|fatal|cannot find|invalid|ENAMETOOLONG|EADDRINUSE|404|500):?\s*(.*)/i;
    const TOOL_EXEC_REGEX = /(?:running|executing|read_file|edit_file|write_to_file|run_command|grep|bash|cargo|npm)\s+([^\n\r]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract referenced files
      const fileMatches = line.match(FILE_PATH_REGEX);
      if (fileMatches) {
        fileMatches.forEach((f) => {
          if (!f.startsWith('http') && !f.includes('node_modules') && !f.includes('target/')) {
            filesTouched.add(f);
          }
        });
      }

      // Check for errors / blockers
      const errMatch = line.match(ERROR_REGEX);
      if (errMatch && errMatch[1] && errMatch[1].length > 5) {
        blockersFound.add(errMatch[0].trim());
      }

      // Check for user prompt turns
      const userMatch = line.match(USER_PROMPT_REGEX);
      if (userMatch && userMatch[1] && userMatch[1].length > 3) {
        finalizeTurn();
        const promptText = userMatch[1].trim();
        if (!primaryGoal) {
          primaryGoal = promptText;
        }
        currentTurn = {
          id: `turn-${Date.now()}-${turns.length}`,
          role: 'user',
          content: promptText,
          timestamp: Date.now(),
          filesReferenced: fileMatches || [],
        };
        continue;
      }

      // Detect tool execution
      const toolMatch = line.match(TOOL_EXEC_REGEX);
      if (toolMatch) {
        if (!currentTurn) {
          currentTurn = {
            id: `turn-${Date.now()}-${turns.length}`,
            role: 'agent',
            content: '',
            timestamp: Date.now(),
            toolsExecuted: [],
          };
        }
        currentTurn.toolsExecuted = currentTurn.toolsExecuted || [];
        currentTurn.toolsExecuted.push({
          name: toolMatch[0].split(' ')[0],
          target: toolMatch[1]?.trim(),
          status: 'completed',
        });
      }

      // Append content to current turn
      if (currentTurn) {
        currentTurn.content += (currentTurn.content ? '\n' : '') + line;
      } else {
        currentTurn = {
          id: `turn-${Date.now()}-${turns.length}`,
          role: 'agent',
          content: line,
          timestamp: Date.now(),
        };
      }

      // Track potential decisions
      if (/decided to|refactored|switched from|chosen|agreed upon|standardized/i.test(line)) {
        decisionsFormulated.add(line.replace(/^[•\-\*]\s*/, ''));
      }
    }

    finalizeTurn();

    // Determine last unfinished step from last agent turn
    if (turns.length > 0) {
      const lastTurn = turns[turns.length - 1];
      if (lastTurn.role === 'agent') {
        const lastLines = lastTurn.content.split('\n').filter(Boolean);
        lastUnfinishedStep = lastLines.slice(-2).join(' ').trim();
      }
    }

    return {
      agentId,
      sessionId,
      turns,
      primaryGoal: primaryGoal || 'Active workspace development',
      filesTouched: Array.from(filesTouched),
      blockersFound: Array.from(blockersFound).slice(0, 5),
      decisionsFormulated: Array.from(decisionsFormulated).slice(0, 5),
      lastUnfinishedStep: lastUnfinishedStep || 'Continue active implementation flow',
    };
  }

  /**
   * Universal extractor from structured Chat Messages
   */
  public static extractFromChatMessages(agentId: string, sessionId: string, messages: any[]): ExtractedSessionData {
    const turns: ExtractedTurn[] = [];
    const filesTouched = new Set<string>();
    const blockersFound = new Set<string>();
    const decisionsFormulated = new Set<string>();
    let primaryGoal = '';

    const FILE_PATH_REGEX = /(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g;

    for (const msg of messages) {
      const role: 'user' | 'agent' | 'system' = msg.role === 'user' ? 'user' : 'agent';
      const content = msg.content || '';

      if (role === 'user' && !primaryGoal) {
        primaryGoal = content.split('\n')[0].trim();
      }

      const fileMatches = content.match(FILE_PATH_REGEX);
      if (fileMatches) {
        fileMatches.forEach((f: string) => {
          if (!f.startsWith('http') && !f.includes('node_modules')) {
            filesTouched.add(f);
          }
        });
      }

      // Extract tool invocations
      const tools: Array<{ name: string; target?: string; status: 'completed' | 'failed' }> = [];
      if (msg.toolInvocations) {
        for (const t of msg.toolInvocations) {
          tools.push({
            name: t.toolName || 'tool',
            target: t.file || t.command,
            status: t.status || 'completed',
          });
          if (t.file) filesTouched.add(t.file);
        }
      }

      turns.push({
        id: msg.id || `msg-${Date.now()}`,
        role,
        content,
        timestamp: msg.timestamp || Date.now(),
        toolsExecuted: tools.length > 0 ? tools : undefined,
        filesReferenced: fileMatches || [],
      });
    }

    return {
      agentId,
      sessionId,
      turns,
      primaryGoal: primaryGoal || 'Active workspace task',
      filesTouched: Array.from(filesTouched),
      blockersFound: Array.from(blockersFound),
      decisionsFormulated: Array.from(decisionsFormulated),
      lastUnfinishedStep: turns[turns.length - 1]?.content.slice(0, 150) || 'Continue implementation',
    };
  }
}
