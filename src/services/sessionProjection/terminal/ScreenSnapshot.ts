export class ScreenSnapshot {
  readonly rows: number;
  readonly cols: number;
  readonly lines: string[];
  readonly timestamp: number;

  constructor(grid: string[][], rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.timestamp = Date.now();
    this.lines = grid.map((row) => row.join('').trimEnd());
  }

  getText(): string {
    return this.lines.join('\n').trim();
  }

  getCleanConversationalText(latestUserPrompt?: string): {
    text: string;
    isThinking: boolean;
    thought?: string;
    workspacePath?: string;
    activeMode?: string;
  } {
    const rawLines = this.lines;
    let startIndex = 0;

    // 1. Precise Prompt Anchor Detection: Ignore assistant conversational text and match exact prompt bars
    if (latestUserPrompt && latestUserPrompt.trim().length > 0) {
      const promptNorm = latestUserPrompt.trim().toLowerCase();
      for (let i = rawLines.length - 1; i >= 0; i--) {
        const l = rawLines[i].trim().toLowerCase();

        // Ignore lines containing natural conversational assistant words
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
          l.startsWith(`| ${promptNorm}`) ||
          l.startsWith(`│ ${promptNorm}`) ||
          l.startsWith(`$ ${promptNorm}`) ||
          (l.startsWith(promptNorm) && l.includes('───'))
        ) {
          startIndex = i + 1;
          break;
        }
      }
    }

    const slicedLines = rawLines.slice(startIndex);
    const cleanLines: string[] = [];
    const seenLineSet = new Set<string>();
    let thoughtText: string | undefined;
    let workspacePath: string | undefined;
    let activeMode: string | undefined;
    let isThinking = false;

    for (const line of slicedLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. Filter out startup splash banners & emails
      if (/Welcome to the|Signing in|Antigravity CLI|Google AI Pro/i.test(trimmed)) {
        continue;
      }

      // 2. Filter out leftover thinking/loading spinner fragments (e.g. "oading", "ing...", "Working...")
      if (/^(oading|ading|ding|ing|\.\.\.|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮⠇⠪\s]*Working|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮⠇⠪\s]*Thinking|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⋮⠇⠪\s]*Generating)/i.test(trimmed)) {
        isThinking = true;
        continue;
      }

      // 3. Extract Thought duration (Thought for 3s, 196 tokens / + Thought: 938ms)
      const thoughtMatch =
        trimmed.match(/Thought for\s*([0-9.]+(?:s|ms)[^,\n]*)/i) ||
        trimmed.match(/\+?\s*Thought:\s*([0-9.]+(?:ms|s))/i);

      if (thoughtMatch) {
        thoughtText = `Thought for ${thoughtMatch[1]}`;
        continue;
      }

      // 4. Filter out artifact review / action prompts
      if (/^\d+\s*artifact|\/artifact to review/i.test(trimmed)) {
        continue;
      }

      // 5. Extract Workspace Path (/home/... or ~/...)
      const pathMatch = trimmed.match(/^(\/(home|Users|var|tmp|etc)[a-zA-Z0-9_.\-/]+|~[a-zA-Z0-9_.\-/]+)/i);
      if (pathMatch) {
        workspacePath = pathMatch[0];
        continue;
      }

      // 6. Extract Mode / Model indicators (Gemini 3.7..., Claude 3.7..., Plan · Ox Alpha...)
      const modeMatch =
        trimmed.match(/^(Plan|Build|Chat|Explore)\s*·\s*([a-zA-Z0-9.\s]+)(?:·\s*[0-9.]+[ms|s])?/i) ||
        trimmed.match(/(Gemini\s*3\.7\s*Flash|Claude\s*3\.7|GPT-4o)/i);

      if (modeMatch) {
        activeMode = modeMatch[1];
        continue;
      }

      // 7. Filter out bottom status widgets & indicators (>_ Gemini 3.7 Flash, >_ plan: ...)
      if (/^[>_⚡▪\s]*(?:plan:\s*)?(?:Gemini|Claude|GPT|DeepSeek|Ox Alpha)/i.test(trimmed)) {
        continue;
      }

      // 8. Filter out echoed user prompts (e.g. "| Hi", "> /plan Hi", "| Hello")
      if (/^[|│>❯$]\s*(?:\/plan\s+)?[a-zA-Z0-9\s.,!?_-]+$/.test(trimmed) && trimmed.length < 25) {
        continue;
      }

      // 9. Filter out horizontal rules & divider bars (───────, ═══════)
      if (/^[─═_\-—]{4,}$/.test(trimmed) || /^[▪■█░▒▓▄▀=—\-_|*#~\s]{4,}$/.test(trimmed)) {
        continue;
      }

      // 10. Filter out shortcut footer, microphone artifacts, and lone slash commands
      if (
        /\? for shortcuts|>_\s*plan:|ctrl\+[a-z]|cmd\+[a-z]|tab agents|shift\+tab|\/help to show/i.test(trimmed) ||
        /[?]{2,}/.test(trimmed) ||
        /our microphone/i.test(trimmed) ||
        /^\/plan$/i.test(trimmed)
      ) {
        continue;
      }

      // 11. Filter out single vertical pipes or empty symbols on a line
      if (/^[|│\-_=~*#\s]+$/.test(trimmed) || /^\d+(\.\d+)?K\s*\(\d+%\)/i.test(trimmed) || /^\d+$/.test(trimmed)) {
        continue;
      }

      // Clean leading box pipe or prompt glyph and trailing terminal border dashes
      const sanitizedLine = trimmed
        .replace(/^[|│>❯_]\s*/, '')
        .replace(/^[—\-_=─]+\s*/, '')
        .replace(/[—\-_=─]{3,}$/, '')
        .trim();

      if (sanitizedLine && sanitizedLine.length > 1) {
        // Prevent repeated duplicate sentences inside the same card (fuzzy normalized)
        const normKey = sanitizedLine.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenLineSet.has(normKey)) {
          seenLineSet.add(normKey);
          cleanLines.push(sanitizedLine);
        }
      }
    }

    return {
      text: cleanLines.join('\n\n').trim(),
      isThinking,
      thought: thoughtText,
      workspacePath,
      activeMode,
    };
  }
}
