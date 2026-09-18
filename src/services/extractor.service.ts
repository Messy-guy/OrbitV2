/**
 * Universal Session Extractor
 * Ingests retained PTY terminal history, canonical conversationStore, or chat messages across any AI CLI
 * (Antigravity, OpenCode, Claude Code, Codex, Bash, etc.).
 * and extracts clean conversation turns, tools executed, errors encountered, user intent,
 * file edit summaries, and diffs.
 */

import { conversationStore } from './conversation/ConversationStore';
import { useAgentStore } from '../stores/agent.store';
import { isTauriAvailable, tauriService } from './tauri.service';
import { FileEditSummary, ConversationSynthesis } from '../types/orbit';

export type { FileEditSummary, ConversationSynthesis };

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
  recentUserInstructions: string[];
  filesTouched: string[];
  fileSummaries?: FileEditSummary[];
  blockersFound: string[];
  decisionsFormulated: string[];
  lastUnfinishedStep?: string;
  detailedConversationLog?: string;
  conversationSynthesis?: ConversationSynthesis;
  verbatimTranscript?: string;
}

export class UniversalSessionExtractor {
  /**
   * Strips ANSI escape sequences, color codes, CSI sequences, and terminal cursor repositioning
   */
  public static stripAnsi(text: string): string {
    if (!text) return '';
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

      // Skip TUI menu / interactive dialog navigation footers
      if (/Keyboard:\s+enter\s+Select/i.test(line)) continue;
      if (/\(tab to cycle\)/i.test(line)) continue;
      if (/\bf[0-9]\s+(?:Rename|Delete|Help)/i.test(line)) continue;
      if (/\besc\s+Go back/i.test(line)) continue;
      if (/Conversations;\s+Keyboard:/i.test(line)) continue;

      // Skip duplicate consecutive lines
      if (line === prevLine) continue;

      prevLine = line;
      result.push(line);
    }

    return result;
  }

  /**
   * Formats clean chronological conversation dialogue between user and agent
   */
  public static formatVerbatimTranscript(turns: ExtractedTurn[], maxTurns = 10): string {
    const recent = turns.slice(-maxTurns);
    if (recent.length === 0) return 'No prior conversation turns recorded for this session.';

    return recent.map((turn, index) => {
      const speaker = turn.role === 'user' ? '👤 User' : '🤖 Agent';
      const cleanContent = turn.content.trim();
      let block = `#### Turn ${index + 1} — ${speaker}\n> ${cleanContent.replace(/\n/g, '\n> ')}`;
      if (turn.toolsExecuted && turn.toolsExecuted.length > 0) {
        block += `\n> *Tools run: ${turn.toolsExecuted.map(t => `${t.name}${t.target ? ` (${t.target})` : ''}`).join(', ')}*`;
      }
      return block;
    }).join('\n\n');
  }

  /**
   * Analyzes a unified file diff and produces a concise, human-readable summary
   * and clean truncated diff snippet.
   */
  public static summarizeFileDiff(filePath: string, diffText: string, status = 'modified'): FileEditSummary {
    // VISHNU 15-Dim Security & FILE-KEEPER: Absolute redaction for environment & secret files
    const isSecretFile = 
      /(?:^|\/)\.env(?:\.[^/]+)?$/i.test(filePath) ||
      /(?:id_rsa|id_ecdsa|id_ed25519|\.pem$|\.key$|service-account.*\.json$)/i.test(filePath);
    if (isSecretFile) {
      return {
        filePath,
        status,
        additions: 0,
        deletions: 0,
        summary: `Protected environment/secret file (${filePath}). Content redacted for security.`,
        diffSnippet: '--- [REDACTED BY ORBIT FILE-KEEPER / VISHNU SHIELD] ---',
      };
    }

    if (!diffText || diffText.trim().length === 0) {
      return {
        filePath,
        status,
        additions: 0,
        deletions: 0,
        summary: `Referenced file ${filePath} without uncommitted local git diff modifications.`,
      };
    }

    const lines = diffText.split('\n');
    let additions = 0;
    let deletions = 0;
    const modifiedSymbols = new Set<string>();
    const modifiedHunks: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) {
        additions++;
        // Check for symbol definitions
        const symMatch = line.match(/\b(?:export\s+)?(?:function|class|const|let|var|type|interface|enum|def|struct|impl|fn)\s+([a-zA-Z0-9_$]+)/);
        if (symMatch && symMatch[1]) {
          modifiedSymbols.add(symMatch[1]);
        }
      } else if (line.startsWith('-')) {
        deletions++;
      } else if (line.startsWith('@@')) {
        const hunkMatch = line.match(/@@\s+[^@]+@@\s*(.*)/);
        if (hunkMatch && hunkMatch[1]?.trim()) {
          const context = hunkMatch[1].trim();
          if (context.length < 60 && !context.startsWith('//')) {
            modifiedHunks.push(context);
          }
        }
      }
    }

    // Generate intelligent human-readable summary
    let summary = '';
    const symbolsList = Array.from(modifiedSymbols).slice(0, 4);
    if (symbolsList.length > 0) {
      summary = `Updated ${filePath} (+${additions}/-${deletions} lines): Added or modified \`${symbolsList.join('`, `')}\`.`;
    } else if (modifiedHunks.length > 0) {
      summary = `Updated ${filePath} (+${additions}/-${deletions} lines) around ${modifiedHunks.slice(0, 2).map(h => `\`${h}\``).join(', ')}.`;
    } else if (additions > 0 && deletions === 0) {
      summary = `Added +${additions} lines of new code/configuration to ${filePath}.`;
    } else if (additions > 0 || deletions > 0) {
      summary = `Refactored logic in ${filePath} (+${additions} additions, -${deletions} deletions).`;
    } else {
      summary = `Verified ${filePath}.`;
    }

    // Truncate overly massive diff snippets so token budget stays disciplined
    const maxSnippetLines = 120;
    let diffSnippet = '';
    if (lines.length > maxSnippetLines) {
      const truncated = lines.slice(0, 100).join('\n');
      diffSnippet = `${truncated}\n\n... [truncated ${lines.length - 100} remaining lines of diff]`;
    } else {
      diffSnippet = diffText;
    }

    return {
      filePath,
      status,
      additions,
      deletions,
      summary,
      diffSnippet,
    };
  }

  /**
   * Synthesizes conversation turns into structured ConversationSynthesis and rich Markdown narrative
   */
  public static synthesizeConversation(
    turns: ExtractedTurn[],
    primaryGoal: string,
    decisions: string[],
    blockers: string[],
    filesTouched: string[],
    userDirectives: string[] = [],
    workSteps: Array<{ step: string; detail?: string; tool?: string }> = []
  ): ConversationSynthesis {
    const objectives = userDirectives.length > 0 
      ? userDirectives 
      : turns.filter(t => t.role === 'user').map(t => t.content.trim()).filter(Boolean);
    
    const resolvedPrimaryGoal = primaryGoal || objectives[0] || 'Active workspace task';

    // Build work accomplished if not already populated
    const accomplishments = [...workSteps];
    if (accomplishments.length === 0) {
      for (const turn of turns) {
        if (turn.role === 'agent') {
          if (turn.toolsExecuted && turn.toolsExecuted.length > 0) {
            accomplishments.push({
              step: `Ran ${turn.toolsExecuted.map(t => t.name + (t.target ? ` (${t.target})` : '')).join(', ')}`,
              detail: turn.content.slice(0, 200),
            });
          } else {
            const firstLine = turn.content.split('\n')[0].trim();
            if (
              firstLine &&
              firstLine.length > 5 &&
              !/Keyboard:|enter Select|f[0-9] Rename|esc Go back|\(tab to cycle\)|Working|CLI\s+Other|Conversations;/i.test(firstLine)
            ) {
              accomplishments.push({ step: firstLine });
            }
          }
        }
      }
    }

    const blockersAndErrors: Array<{ issue: string; resolution?: string; status: 'resolved' | 'pending' }> = blockers.map(b => ({
      issue: b,
      status: 'pending' as const,
    }));

    // Check last agent turn for current state and next step
    const agentTurns = turns.filter(t => t.role === 'agent');
    const lastAgentTurn = agentTurns[agentTurns.length - 1];
    let currentExecutionState = 'Active development';
    let nextStepDirective = 'Inspect active touched files and continue implementation without repeating completed steps.';

    if (lastAgentTurn) {
      const lines = lastAgentTurn.content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 10 && !/Keyboard:|enter Select|f[0-9] Rename|esc Go back|\(tab to cycle\)|Conversations;/i.test(l));
      if (lines.length > 0) {
        currentExecutionState = lines[lines.length - 1];
        nextStepDirective = lines.length > 1 ? lines.slice(-2).join('; ') : currentExecutionState;
      }
    }

    const patterns = [
      'Maintain strict TypeScript typing and preserve existing test contracts.',
      'Single shared PTY delivery funnel via ptyDelivery module with direct TUI pass-through.',
      'All cross-agent memory synchronized in local machine storage (~/.orbit/memory/projects/).',
    ];

    const narrativeLines: string[] = [
      `### 🎯 Session Objectives & Directives:`,
      `**Goal**: ${resolvedPrimaryGoal}`,
      ...objectives.slice(-4).map((u, i) => `• Directive ${i + 1}: "${u}"`),
      ``,
      `### 💬 Verbatim Recent Conversation Dialogue (User ⇄ Agent):`,
      this.formatVerbatimTranscript(turns, 8),
      ``,
      `### 🛠️ Work Accomplished (${accomplishments.length} Steps Executed):`,
      ...(accomplishments.length > 0 
        ? accomplishments.slice(-6).map((step, idx) => `• **Step ${idx + 1}**: ${step.step}`)
        : ['• Executed workspace code inspections and runtime updates.']),
      ``,
      `### ⚡ Architectural Decisions Formulated:`,
      ...(decisions.length > 0 
        ? decisions.map(d => `• ${d}`)
        : ['• Adhere to existing repository conventions, strict typing, and test contracts.']),
      ``,
      `### ⚠️ Blockers & Errors:`,
      ...(blockers.length > 0 
        ? blockers.map(b => `• ⚠️ ${b}`)
        : ['• No critical blockers pending.']),
      ``,
      `### 👉 Current Execution State & Next Step:`,
      `• **State**: ${currentExecutionState}`,
      `• **Next Action**: ${nextStepDirective}`
    ];

    const narrativeSummary = narrativeLines.join('\n');

    return {
      primaryGoal: resolvedPrimaryGoal,
      userObjectives: objectives,
      workAccomplished: accomplishments,
      decisionsFormulated: decisions,
      blockersAndErrors,
      patterns,
      currentExecutionState,
      nextStepDirective,
      narrativeSummary,
    };
  }

  /**
   * Authoritative extraction from canonical ConversationStore
   */
  public static extractFromCanonicalSession(agentId: string, sessionId: string): ExtractedSessionData | null {
    const session = conversationStore.getSession(sessionId);
    if (!session || !session.conversation?.turns || session.conversation.turns.length === 0) {
      return null;
    }

    const turns: ExtractedTurn[] = [];
    const filesTouched = new Set<string>();
    const blockersFound = new Set<string>();
    const decisionsFormulated = new Set<string>();
    const recentUserInstructions: string[] = [];
    const workSteps: Array<{ step: string; detail?: string; tool?: string }> = [];
    let primaryGoal = '';

    const FILE_PATH_REGEX = /(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g;
    const DECISION_REGEX = /(?:decided to|refactored|switched from|chosen|agreed upon|standardized|we have fixed|updated|configured|implemented|added|created|modified)\s+([^\n\r]+)/i;
    const ERROR_REGEX = /(?:error|failed|exception|panic|fatal|cannot find|invalid|syntax error|type error):?\s*(.*)/i;

    for (const turn of session.conversation.turns) {
      const role: 'user' | 'agent' | 'system' = turn.role === 'user' ? 'user' : 'agent';
      let textContent = '';
      let thoughtContent = '';
      const toolsExecuted: Array<{ name: string; target?: string; status: 'completed' | 'failed' }> = [];

      for (const msg of turn.messages) {
        for (const item of msg.content) {
          if (item.type === 'text') {
            textContent += (textContent ? '\n' : '') + item.text;
          } else if (item.type === 'markdown') {
            textContent += (textContent ? '\n' : '') + item.markdown;
          } else if (item.type === 'code') {
            textContent += (textContent ? '\n' : '') + item.code;
          } else if (item.type === 'file') {
            filesTouched.add(item.path);
            workSteps.push({
              step: `${item.action.toUpperCase()} ${item.path}`,
              detail: item.path,
            });
          }

          const rawItem = item as any;
          if (rawItem.thought) {
            thoughtContent += (thoughtContent ? '\n' : '') + rawItem.thought;
          }
          if (rawItem.toolUse) {
            const t = rawItem.toolUse;
            const target = typeof t.input === 'string' 
              ? t.input 
              : (t.input?.targetFile || t.input?.file || t.input?.path || t.input?.command || JSON.stringify(t.input));
            toolsExecuted.push({
              name: t.name,
              target,
              status: 'completed',
            });
            if (t.input?.targetFile) filesTouched.add(t.input.targetFile);
            if (t.input?.file) filesTouched.add(t.input.file);
            if (t.input?.path) filesTouched.add(t.input.path);
          }
        }
      }

      // Also scan turn activities
      for (const act of turn.activities || []) {
        if (act.category === 'files' && act.details) {
          for (const d of act.details) {
            if (d.path) filesTouched.add(d.path);
          }
        }
        if (act.summary) {
          workSteps.push({
            step: act.summary,
            detail: act.details?.[0]?.description,
          });
        }
      }

      if (role === 'user' && textContent) {
        recentUserInstructions.push(textContent.trim());
        if (!primaryGoal) primaryGoal = textContent.split('\n')[0].trim();
      }

      const combinedText = `${textContent}\n${thoughtContent}`;
      const fileMatches = combinedText.match(FILE_PATH_REGEX);
      if (fileMatches) {
        fileMatches.forEach((f) => {
          if (!f.startsWith('http') && !f.includes('node_modules') && !f.includes('.system_generated')) {
            filesTouched.add(f);
          }
        });
      }

      const errMatch = combinedText.match(ERROR_REGEX);
      if (errMatch && errMatch[1]?.trim().length > 4) {
        blockersFound.add(errMatch[0].trim());
      }

      const decMatch = combinedText.match(DECISION_REGEX);
      if (decMatch && decMatch[1]?.trim().length > 6) {
        decisionsFormulated.add(decMatch[0].replace(/^[•\-\*]\s*/, '').trim());
      }

      if (role === 'agent' && (textContent || toolsExecuted.length > 0)) {
        const stepDesc = toolsExecuted.length > 0
          ? `Executed ${toolsExecuted.map(t => `${t.name}${t.target ? ` on ${t.target}` : ''}`).join(', ')}`
          : textContent.split('\n')[0].slice(0, 160);
        workSteps.push({
          step: stepDesc,
          detail: textContent.slice(0, 300),
          tool: toolsExecuted[0]?.name,
        });
      }

      turns.push({
        id: turn.id,
        role,
        content: textContent || thoughtContent || `Turn ${turn.id}`,
        timestamp: turn.startedAt || Date.now(),
        toolsExecuted: toolsExecuted.length > 0 ? toolsExecuted : undefined,
        filesReferenced: fileMatches || [],
      });
    }

    const synthesis = this.synthesizeConversation(
      turns,
      primaryGoal || recentUserInstructions[0] || 'Workspace implementation',
      Array.from(decisionsFormulated),
      Array.from(blockersFound),
      Array.from(filesTouched),
      recentUserInstructions,
      workSteps
    );

    return {
      agentId,
      sessionId,
      turns,
      primaryGoal: synthesis.primaryGoal,
      recentUserInstructions: synthesis.userObjectives,
      filesTouched: Array.from(filesTouched),
      blockersFound: Array.from(blockersFound),
      decisionsFormulated: Array.from(decisionsFormulated),
      lastUnfinishedStep: synthesis.nextStepDirective,
      detailedConversationLog: synthesis.narrativeSummary,
      conversationSynthesis: synthesis,
      verbatimTranscript: this.formatVerbatimTranscript(turns, 10),
    };
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
    const recentUserInstructions: string[] = [];

    let currentTurn: ExtractedTurn | null = null;
    let primaryGoal = '';

    const finalizeTurn = () => {
      if (currentTurn && currentTurn.content.trim()) {
        turns.push({ ...currentTurn });
        currentTurn = null;
      }
    };

    // Regex matchers for CLI prompts & events across Antigravity, Claude, OpenCode, Codex, Aider
    const USER_PROMPT_REGEX = /^(?:>|\$|❯|>>>|Ask anything\.\.\.|Orbit Handoff from|\?\s+Prompt:|<USER_REQUEST>|Human:|User:)\s*(.*)/i;
    const FILE_PATH_REGEX = /(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g;
    const ERROR_REGEX = /(?:error|failed|exception|panic|fatal|cannot find|invalid|ENAMETOOLONG|EADDRINUSE|404|500|syntax error|type error|undefined):?\s*(.*)/i;
    const TOOL_EXEC_REGEX = /(?:running|executing|read_file|edit_file|write_to_file|replace_file_content|run_command|grep|bash|cargo|npm|git)\s+([^\n\r]+)/i;
    const DECISION_REGEX = /(?:decided to|refactored|switched from|chosen|agreed upon|standardized|we have fixed|updated|configured|implemented|added|created|modified)\s+([^\n\r]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract referenced files
      const fileMatches = line.match(FILE_PATH_REGEX);
      if (fileMatches) {
        fileMatches.forEach((f) => {
          if (!f.startsWith('http') && !f.includes('node_modules') && !f.includes('target/') && !f.includes('.system_generated')) {
            filesTouched.add(f);
          }
        });
      }

      // Check for errors / blockers
      const errMatch = line.match(ERROR_REGEX);
      if (errMatch && errMatch[1] && errMatch[1].length > 4) {
        blockersFound.add(errMatch[0].trim());
      }

      // Check for user prompt turns
      const userMatch = line.match(USER_PROMPT_REGEX);
      if (userMatch && userMatch[1] && userMatch[1].length > 2) {
        finalizeTurn();
        const promptText = userMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
        if (promptText && !promptText.startsWith('Orbit Handoff')) {
          // Skip CLI control / meta commands (e.g. /res, /resume, /clear, /clean, /model, /help)
          if (/^\/(?:res|resume|clear|clean|model|help|reset|exit|quit|compact|cost|history)\b/i.test(promptText)) {
            continue;
          }
          if (!primaryGoal) {
            primaryGoal = promptText;
          }
          recentUserInstructions.push(promptText);
          currentTurn = {
            id: `turn-${Date.now()}-${turns.length}`,
            role: 'user',
            content: promptText,
            timestamp: Date.now(),
            filesReferenced: fileMatches || [],
          };
          continue;
        }
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

      // Track architectural decisions & state milestones
      const decMatch = line.match(DECISION_REGEX);
      if (decMatch && decMatch[1] && decMatch[1].length > 6) {
        decisionsFormulated.add(decMatch[0].replace(/^[•\-\*]\s*/, '').trim());
      }
    }

    finalizeTurn();

    const synthesis = this.synthesizeConversation(
      turns,
      primaryGoal || recentUserInstructions[0] || 'Active workspace development',
      Array.from(decisionsFormulated),
      Array.from(blockersFound),
      Array.from(filesTouched),
      recentUserInstructions
    );

    return {
      agentId,
      sessionId,
      turns,
      primaryGoal: synthesis.primaryGoal,
      recentUserInstructions: synthesis.userObjectives.slice(-5),
      filesTouched: Array.from(filesTouched),
      blockersFound: Array.from(blockersFound),
      decisionsFormulated: Array.from(decisionsFormulated),
      lastUnfinishedStep: synthesis.nextStepDirective,
      detailedConversationLog: synthesis.narrativeSummary,
      conversationSynthesis: synthesis,
      verbatimTranscript: this.formatVerbatimTranscript(turns, 10),
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
    const recentUserInstructions: string[] = [];
    const workSteps: Array<{ step: string; detail?: string; tool?: string }> = [];
    let primaryGoal = '';

    const FILE_PATH_REGEX = /(?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z0-9]+/g;
    const DECISION_REGEX = /(?:decided to|refactored|switched from|chosen|agreed upon|standardized|we have fixed|updated|configured|implemented|added|created|modified)\s+([^\n\r]+)/i;
    const ERROR_REGEX = /(?:error|failed|exception|panic|fatal|cannot find|invalid|syntax error|type error):?\s*(.*)/i;

    for (const msg of messages) {
      const role: 'user' | 'agent' | 'system' = msg.role === 'user' ? 'user' : 'agent';
      const content = msg.content || '';

      if (role === 'user') {
        recentUserInstructions.push(content);
        if (!primaryGoal) primaryGoal = content.split('\n')[0].trim();
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

      const decMatch = content.match(DECISION_REGEX);
      if (decMatch && decMatch[1]?.trim().length > 6) {
        decisionsFormulated.add(decMatch[0].replace(/^[•\-\*]\s*/, '').trim());
      }

      const errMatch = content.match(ERROR_REGEX);
      if (errMatch && errMatch[1]?.trim().length > 4) {
        blockersFound.add(errMatch[0].trim());
      }

      if (role === 'agent' && (content || tools.length > 0)) {
        workSteps.push({
          step: tools.length > 0 ? `Ran ${tools.map(t => `${t.name} (${t.target || ''})`).join(', ')}` : content.split('\n')[0].slice(0, 160),
          detail: content.slice(0, 300),
          tool: tools[0]?.name,
        });
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

    const synthesis = this.synthesizeConversation(
      turns,
      recentUserInstructions[recentUserInstructions.length - 1] || primaryGoal || 'Active workspace task',
      Array.from(decisionsFormulated),
      Array.from(blockersFound),
      Array.from(filesTouched),
      recentUserInstructions,
      workSteps
    );

    return {
      agentId,
      sessionId,
      turns,
      primaryGoal: synthesis.primaryGoal,
      recentUserInstructions: synthesis.userObjectives.slice(-5),
      filesTouched: Array.from(filesTouched),
      blockersFound: Array.from(blockersFound),
      decisionsFormulated: Array.from(decisionsFormulated),
      lastUnfinishedStep: synthesis.nextStepDirective,
      detailedConversationLog: synthesis.narrativeSummary,
      conversationSynthesis: synthesis,
      verbatimTranscript: this.formatVerbatimTranscript(turns, 10),
    };
  }

  /**
   * Unified authoritative session extractor across all stores with automatic file diff generation.
   */
  public static async extractAuthoritativeSession(
    agentId: string,
    sessionId: string,
    projectPath?: string,
    rawTerminalHistory?: string
  ): Promise<ExtractedSessionData> {
    // 1. Try canonical ConversationStore first (most authoritative)
    let sessionData = this.extractFromCanonicalSession(agentId, sessionId);

    // 1b. If direct sessionId has no canonical turns, search all canonical sessions for this agent
    if (!sessionData || sessionData.turns.length === 0) {
      const agentSession = conversationStore.getAllSessions().find((s) => s.engine?.id === agentId);
      if (agentSession && agentSession.conversation?.turns.length > 0) {
        sessionData = this.extractFromCanonicalSession(agentId, agentSession.id);
      }
    }

    // 2. If no canonical turns or if agentStore has more/fresher chat messages, prioritize chat messages
    try {
      const allStoreMessages = useAgentStore.getState().messages;
      let chatMessages = allStoreMessages[sessionId] || [];
      let activeChatSessionId = sessionId;

      // 2b. Cascade search if direct sessionId has no messages in agent store
      if (chatMessages.length === 0) {
        const matchedKey = Object.keys(allStoreMessages).find(
          (k) => (k === agentId || k.includes(agentId)) && allStoreMessages[k].length > 0
        );
        if (matchedKey) {
          chatMessages = allStoreMessages[matchedKey];
          activeChatSessionId = matchedKey;
        }
      }

      if (chatMessages.length > 0 && (!sessionData || sessionData.turns.length < chatMessages.length)) {
        sessionData = this.extractFromChatMessages(agentId, activeChatSessionId, chatMessages);
      }
    } catch (e) {
      console.warn('Error reading chat store messages:', e);
    }


    // 3. If still empty, try PTY terminal history
    if (!sessionData || sessionData.turns.length === 0) {
      let termHistory = rawTerminalHistory;
      if (!termHistory && isTauriAvailable()) {
        try {
          termHistory = await tauriService.getAgentTerminalHistory(agentId);
        } catch (e) {
          console.warn('Error fetching agent terminal history:', e);
        }
      }
      if (termHistory && termHistory.trim().length > 0) {
        sessionData = this.extractFromTerminalHistory(agentId, sessionId, termHistory);
      }
    }

    // 4. Fallback baseline if absolutely no history exists
    if (!sessionData || sessionData.turns.length === 0) {
      const synthesis = this.synthesizeConversation(
        [],
        'Workspace implementation and verification',
        ['Follow project typing and testing requirements.'],
        [],
        []
      );
      sessionData = {
        agentId,
        sessionId,
        turns: [],
        primaryGoal: synthesis.primaryGoal,
        recentUserInstructions: ['Continue workspace task'],
        filesTouched: [],
        blockersFound: [],
        decisionsFormulated: synthesis.decisionsFormulated,
        lastUnfinishedStep: synthesis.nextStepDirective,
        detailedConversationLog: synthesis.narrativeSummary,
        conversationSynthesis: synthesis,
        verbatimTranscript: 'No prior conversation turns recorded for this session.',
      };
    }

    // 5. Gather all files touched and generate FileEditSummary with diffs (parallel Promise.all)
    let fileSummaries: FileEditSummary[] = [];
    if (projectPath && isTauriAvailable() && sessionData.filesTouched.length > 0) {
      const touchpoints = sessionData.filesTouched.slice(0, 15);
      fileSummaries = await Promise.all(
        touchpoints.map(async (filePath) => {
          try {
            const diff = await tauriService.getWorkspaceFileDiff(projectPath, filePath);
            return this.summarizeFileDiff(filePath, diff);
          } catch (err) {
            console.warn(`Failed to fetch diff for ${filePath}:`, err);
            return {
              filePath,
              status: 'modified',
              additions: 0,
              deletions: 0,
              summary: `Active workspace touchpoint: ${filePath}`,
            };
          }
        })
      );
    }
    sessionData.fileSummaries = fileSummaries;

    return sessionData;
  }
}
