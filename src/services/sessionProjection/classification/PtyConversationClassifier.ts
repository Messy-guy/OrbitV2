import { ActivitySummary } from '../../../types/conversation';
import { ScreenFingerprint } from '../state/ScreenFingerprint';
import { InputEchoSuppressor } from '../transcript/InputEchoSuppressor';

export type CaptureDecision =
  | {
      type: 'assistant_text';
      text: string;
      confidence: number;
    }
  | {
      type: 'user_echo';
      text: string;
    }
  | {
      type: 'activity';
      activity: ActivitySummary;
    }
  | {
      type: 'terminal_only';
      reason: string;
    };

export interface ClassifiedScreenOutput {
  userFacingText: string;
  activities: ActivitySummary[];
  thought?: string;
  isThinking: boolean;
  decisions: CaptureDecision[];
}

export class PtyConversationClassifier {
  /**
   * Classifies a single line of terminal output into a semantic CaptureDecision
   */
  static classifyLine(line: string, latestUserPrompt?: string, sessionId?: string, turnId?: string): CaptureDecision {
    const trimmed = line.trim();
    if (!trimmed) {
      return { type: 'terminal_only', reason: 'empty_line' };
    }

    // Strip framing box borders/pipes if line is wrapped in a TUI container
    const cleanText = trimmed
      .replace(/^[|│║┃>❯_┌└├╔╚╠─═—\-_]+\s*/, '')
      .replace(/\s*[|│║┃>❯_┐┘┤╗╝╣─═—\-_]+$/, '')
      .trim();

    if (!cleanText) {
      return { type: 'terminal_only', reason: 'empty_frame' };
    }

    // ----------------------------------------------------------------------
    // 1. AUTHORITATIVE USER ECHO SUPPRESSION (via InputEchoSuppressor)
    // ----------------------------------------------------------------------
    const echoCheck = InputEchoSuppressor.checkLine(sessionId || '', line, latestUserPrompt, turnId);
    if (echoCheck.isEcho) {
      return { type: 'user_echo', text: cleanText };
    }

    // ----------------------------------------------------------------------
    // 2. THINKING / REASONING / DURATION (Converted to Activity, not assistant text)
    // ----------------------------------------------------------------------
    const thoughtMatch =
      cleanText.match(/Thought for\s*([0-9.]+(?:s|ms)[^,\n]*)/i) ||
      cleanText.match(/\+?\s*Thought:\s*([0-9.]+(?:ms|s))/i) ||
      cleanText.match(/Thinking\.\.\.\s*\(([0-9.]+(?:s|ms))\)/i) ||
      cleanText.match(/Thought\s*\(([0-9.]+(?:s|ms))\)/i);

    if (thoughtMatch) {
      return {
        type: 'activity',
        activity: {
          id: `act_think_${Date.now()}`,
          category: 'other',
          summary: `Thought for ${thoughtMatch[1]}`,
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
      };
    }

    if (/^(oading|ading|ding|ing|\.\.\.|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮⠇⠪\s]*Working|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮⠇⠪\s]*Thinking|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮⠇⠪\s]*Generating)/i.test(cleanText)) {
      return {
        type: 'activity',
        activity: {
          id: `act_think_${Date.now()}`,
          category: 'other',
          summary: 'Thinking',
          startedAt: Date.now(),
        },
      };
    }

    // ----------------------------------------------------------------------
    // 3. TOOL ACTIVITIES, FILE OPERATIONS, & TEST RUNS
    //    Strict shapes only: verb + file path/extension, or verb + a known CLI
    //    command. Loose "Running <anything>" matching swallowed real assistant
    //    prose ("Running tests, builds, and linting. I can work directly…").
    // ----------------------------------------------------------------------
    const toolMatch =
      cleanText.match(/^(?:Reading|Writing|Editing|Viewing|Checking)\s+([\w.\-\/]+\.[a-zA-Z0-9]{1,6}|[~\/][\w.\-\/]+)/i) ||
      cleanText.match(/^(?:Running|Executing)\s+(?:cargo|npm|pnpm|yarn|node|python\d?|pytest|vitest|jest|make|docker|git|go|tsc|eslint|ruff|bun|deno|shell|bash|sh|command)\b.{0,40}$/i) ||
      cleanText.match(/^[✱●○◆■✓✕*⚡]\s*(?:Glob|Read|Write|Edit|Bash|Command|Search|Fetch|Grep|Linter|Test|Listing|Checking|Resolving)\s+([^\r\n]+)/i);

    if (toolMatch && cleanText.length < 90) {
      const isCmd = /Running|Executing|Bash|Command/i.test(cleanText);
      return {
        type: 'activity',
        activity: {
          id: `act_tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          category: isCmd ? 'commands' : 'files',
          summary: cleanText.replace(/^[✱●○◆■✓✕*⚡]\s*/, ''),
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
      };
    }

    const testMatch = cleanText.match(/^(?:PASS|FAIL)\s+([a-zA-Z0-9_.\-/]+)(?:\s*\([0-9.]+(?:s|ms)\))?/i);
    if (testMatch) {
      return {
        type: 'activity',
        activity: {
          id: `act_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          category: 'tests',
          summary: cleanText,
          startedAt: Date.now(),
          completedAt: Date.now(),
        },
      };
    }

    // ----------------------------------------------------------------------
    // 4. METADATA & TERMINAL-ONLY NOISE (Discarded from canonical conversation)
    // ----------------------------------------------------------------------

    // 4.1 TUI Box Drawing Characters & Borders
    const boxArtChars = trimmed.match(/[█▀▄▌▐░▒▓│─┌┐└┘├┤┬┴┼║═╔╗╚╝╠╣╦╩╬|_\-=+*~]/g);
    if (boxArtChars && boxArtChars.length / trimmed.length > 0.45 && trimmed.length > 3) {
      return { type: 'terminal_only', reason: 'tui_box_art' };
    }
    if (/^[┌┐└┘├┤┬┴┼║═╔╗╚╝╠╣╦╩╬─═_\-—|*#~+=`\s]{3,}$/.test(trimmed) || /^[+\-=─_~*]{4,}$/.test(trimmed)) {
      return { type: 'terminal_only', reason: 'horizontal_divider' };
    }

    // 4.2 CLI startup banners & version headers
    if (
      /^(Welcome to|Signing in|Logged in as)/i.test(cleanText) ||
      /^(OpenCode|Claude Code|Antigravity|AGY|Codex|Gemini|Aider|OpenHands|Devin|QuantumCoder|AI Agent|Cline)\s*(?:CLI|Code|Assist)?\s*v?[0-9.]+/i.test(cleanText) ||
      /^[a-zA-Z0-9_\-.\s]+(?:CLI|Code|Assist)?\s+v\d+\.\d+/i.test(cleanText) ||
      /^[a-zA-Z0-9_\-.\s]+\s+\(v\d+\.\d+/i.test(cleanText)
    ) {
      return { type: 'terminal_only', reason: 'cli_banner' };
    }

    // 4.3 Model, Provider, Token, Cost, Pricing, and Telemetry Info
    if (
      /^(Model|Provider|Engine|LLM|Mode|Tokens?|Tokens Used|Context|Cost|Pricing|Speed|Duration|Latency|Temperature|Max tokens|Top[-_]?p|Changes|AI Credits|Credits):\s*/i.test(cleanText) ||
      /^Changes\s+[+\-0-9\s]+/i.test(cleanText) ||
      /^AI Credits\s+[0-9.]+/i.test(cleanText) ||
      /^Resume\s+copilot/i.test(cleanText) ||
      /Tokens:\s*\d+.*Cost:\s*\$?[0-9.]+/i.test(cleanText) ||
      /Cost:\s*\$?[0-9.]+/i.test(cleanText) ||
      /\b\d+\s*tokens?\b.*\b\$\d+(\.\d+)?\b/i.test(cleanText) ||
      /^(Model\s*name|Provider\s*name):\s*/i.test(cleanText) ||
      /(?:Nemotron|DeepSeek|Claude|GPT|Gemini|Llama|Mistral|Qwen)\s+[0-9.]+\s+(?:Lightning|Flash|Pro|Sonnet|Opus|Free|Preview|Turbo)/i.test(cleanText) ||
      /^(?:Free|Paid|Pro|Commercial|Open Source)\s*$/i.test(cleanText) ||
      /This model (?:collects|processes|stores) data/i.test(cleanText)
    ) {
      return { type: 'terminal_only', reason: 'model_pricing_metadata' };
    }

    // 4.4 Request, Session, Trace, Correlation identifiers
    if (
      /^(Request[-_ ]?ID|Session[-_ ]?ID|Trace[-_ ]?ID|Transaction[-_ ]?ID|Corr[-_ ]?ID|Run[-_ ]?ID):\s*[a-zA-Z0-9_\-.]+/i.test(trimmed) ||
      /^ID:\s*(?:req|sess|trace|run)_[a-zA-Z0-9_\-.]+/i.test(trimmed) ||
      /^id:\s*[a-zA-Z0-9_\-.]+/i.test(trimmed) ||
      /^Resume\s+[a-zA-Z0-9_\-.]+/i.test(trimmed)
    ) {
      return { type: 'terminal_only', reason: 'identifier_metadata' };
    }

    // 4.5 Network Endpoints, Standalone URLs, Connection Status
    if (
      /^(Connected to|Connecting to|Connection (?:established|closed)|API Endpoint|API URL|Base URL|Endpoint|API)[:\s]\s*(?:https?:\/\/[^\s]+|[a-zA-Z0-9_\-.:]+)/i.test(trimmed) ||
      /^https?:\/\/[a-zA-Z0-9_.\-/:?#&=]+$/i.test(trimmed)
    ) {
      return { type: 'terminal_only', reason: 'network_endpoint' };
    }

    // 4.6 System logger lines & internal status prefixes
    if (
      /^\[(INFO|DEBUG|TRACE|WARN|WARNING|ERROR|LOG|SYSTEM|SYS|stdout|stderr)\]/i.test(trimmed) ||
      /^(INFO|DEBUG|TRACE|WARNING|LOG|SYSTEM):\s+/i.test(trimmed) ||
      /^(API request (?:sent|received|failed)|Waiting for response|Receiving stream|Handshake complete)/i.test(trimmed)
    ) {
      return { type: 'terminal_only', reason: 'system_log' };
    }

    // 4.7 Internal CLI Progress and Workspace scan steps
    if (
      /^[\[(]\d+\/\d+[\])]/i.test(trimmed) ||
      /^(Scanning (?:workspace|repository|files)|Resolving context|Indexing codebase|Fetching files|Mounting filesystem|Building workspace)\.\.\./i.test(trimmed)
    ) {
      return { type: 'terminal_only', reason: 'progress_step' };
    }

    // 4.8 TUI Navigation, Shortcut footers, and Mode indicators
    if (
      /\? for shortcuts|press \? for shortcuts|ctrl\+[a-z]|cmd\+[a-z]|tab agents|shift\+tab|esc to (?:cancel|exit)|type \/help|ask anything\.\.\.|plan mode:|build mode:/i.test(trimmed) ||
      /^[>_⚡▪\s]*(?:Plan|Build|Chat|Explore)\s*·/i.test(trimmed) ||
      /^[>_⚡▪\s]*(?:plan:\s*)?(?:Gemini|Claude|GPT|DeepSeek|Ox Alpha|OpenCode)/i.test(trimmed) ||
      /^\d+\s*artifact|\/artifact to review/i.test(trimmed) ||
      /our microphone/i.test(trimmed) ||
      /^\/plan$/i.test(trimmed)
    ) {
      return { type: 'terminal_only', reason: 'navigation_footer' };
    }

    // 4.9 Standalone Workspace Paths
    if (/^(\/(home|Users|var|tmp|etc)[a-zA-Z0-9_.\-/]+|~[a-zA-Z0-9_.\-/]+)$/i.test(trimmed)) {
      return { type: 'terminal_only', reason: 'path_header' };
    }

    // 4.10 Agent TUI runtime chrome (Copilot / Mimo / Claude Code class):
    //      MCP status, session resume banners, usage/cost session lines, model
    //      chips, shortcut footers, and bare counters/timestamps. All of these
    //      repaint every TUI frame and must never surface as assistant prose.
    if (
      /^mcp\s+servers?\b/i.test(cleanText) ||
      /mcp servers? (?:re)?loaded|server connected|servers connected/i.test(cleanText) ||
      /^(?:resuming|resumed)\s+session/i.test(cleanText) ||
      /^session(?:\s+and\s+usage)?\b.*\b(?:used|cost|tokens?|credits?)\b/i.test(cleanText) ||
      // Session-usage metadata rendered mid-line next to the workspace path
      // (e.g. "~/project/orbit    Session: 0.34AIC used")
      /\bsession\s*[:：].{0,24}\b(?:used|tokens?|cost|credits?)/i.test(cleanText) ||
      /^session\s*[:：]/i.test(trimmed) ||
      // Model chips like "Auto — claude-haiku-4.5", "Auto → gpt-5.2-codex"
      (cleanText.length < 45 && /\b(?:claude|haiku|sonnet|opus|gpt|gemini|deepseek|qwen|llama|mistral|codestral|glm|kimi|grok)[a-z0-9.\-_/]*[-_]\d+(?:\.\d+)?/i.test(cleanText) && /^(auto|model|switched?|using)\b/i.test(cleanText)) ||
      // Shortcut footers: "Working esc interrupt", "tab switch mode ctrl+p settings …"
      /esc\s+interrupt/i.test(cleanText) ||
      /tab\s+(?:next\s+)?tab\b|switch mode|open sidebar/i.test(cleanText) ||
      (/\/\s*commands\b/i.test(cleanText) && /\?\s*help\b/i.test(cleanText)) ||
      /^\/\s*commands$|^\?\s*help$|^\$\s*subagent$/i.test(cleanText) ||
      // Codex/Copilot STATUS BAR: "Working·1na low·~/proj", "gpt-5.6-luna low · ~/Desktop/…"
      // (status/model word + middot separators, optionally ending in the workspace path)
      (/^(?:working|thinking|generating|resuming|waiting)\b/i.test(cleanText) && /·|•/.test(cleanText)) ||
      (/·|•/.test(cleanText) && /[~\/](?:home|Users|Desktop|var|tmp|etc|mnt|srv)[a-zA-Z0-9_.\-\/]*$/i.test(cleanText.trim())) ||
      // Bare counters / token tallies / durations / timestamps ("95", "292 2.92", "41 B", "00:24")
      /^[\d\s.,:%\-—–]+$/.test(trimmed) ||
      /^\d{1,2}:\d{2}(?::\d{2})?$/.test(trimmed) ||
      /^\d+(?:\.\d+)?\s*[msbBkK]$/.test(trimmed) ||
      // Lone spinner/status symbols repainted every frame ("⏺", "⊙", "→", "✓" alone)
      /^[⏺⏻⏼●○◉◎◆■□▪▫✱✓✕✔✖⚡·•▸▹←↑→↓⇄↹⌘⏎\s]{1,2}$/.test(trimmed) ||
      // Spinner-frame fragments where the cursor overwrote "Th" ("ought for 1s …")
      /\bought for\s+\d/i.test(cleanText)
    ) {
      return { type: 'terminal_only', reason: 'tui_runtime_chrome' };
    }

    // 4.11 Standalone spinner / status prefix fragments (cursor overwrites during
    //      in-place redraws, e.g. "orking esc", "enerating…"). Salvage-free drop:
    //      the same content is captured cleanly by a full-frame repaint.
    if (/^[a-z]?[·•⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮\s]*(?:orking|enerating|hinking|esuming|onnecting|loading)\b/i.test(cleanText)) {
      return {
        type: 'activity',
        activity: {
          id: `act_think_${Date.now()}`,
          category: 'other',
          summary: 'Working',
          startedAt: Date.now(),
        },
      };
    }

    // ----------------------------------------------------------------------
    // 5. HIGH-CONFIDENCE USER-FACING ASSISTANT CONTENT
    // ----------------------------------------------------------------------
    const cleanContent = ScreenFingerprint.cleanLineContent(line);

    if (cleanContent && cleanContent.trim().length > 0) {
      return {
        type: 'assistant_text',
        text: cleanContent,
        confidence: 0.95,
      };
    }

    return { type: 'terminal_only', reason: 'unclassified_noise' };
  }

  /**
   * Classifies an entire snapshot of candidate new lines
   */
  static classifyLines(candidateLines: string[], latestUserPrompt?: string, sessionId?: string, turnId?: string): ClassifiedScreenOutput {
    const cleanLines: string[] = [];
    const activities: ActivitySummary[] = [];
    const decisions: CaptureDecision[] = [];
    const seenActivitySet = new Set<string>();
    let latestThought: string | undefined;
    let isThinking = false;

    for (const line of candidateLines) {
      const decision = this.classifyLine(line, latestUserPrompt, sessionId, turnId);
      decisions.push(decision);

      switch (decision.type) {
        case 'user_echo':
        case 'terminal_only':
          // Discarded from canonical conversation
          break;

        case 'activity':
          if (decision.activity.category === 'other' && decision.activity.summary.startsWith('Thought')) {
            latestThought = decision.activity.summary;
            isThinking = true;
          } else if (decision.activity.summary === 'Thinking') {
            isThinking = true;
            if (!latestThought) latestThought = 'Thinking';
          } else {
            if (!seenActivitySet.has(decision.activity.summary)) {
              seenActivitySet.add(decision.activity.summary);
              activities.push(decision.activity);
            }
          }
          break;

        case 'assistant_text': {
          // Preserve all legitimate assistant dialogue lines in exact order and indentation
          cleanLines.push(decision.text);
          break;
        }
      }
    }

    return {
      userFacingText: cleanLines.join('\n').trim(),
      activities,
      thought: latestThought,
      isThinking,
      decisions,
    };
  }
}
