export class TuiChromeFilter {
  /**
   * Returns true if text block is decorative box art, shortcut bar, or terminal chrome
   */
  static isChrome(text: string): { isChrome: boolean; confidence: number } {
    const trimmed = text.trim();
    if (!trimmed) return { isChrome: true, confidence: 1.0 };

    // 1. Check box-drawing characters density (█, ▀, ▄, ▌, ▐, ░, ▒, ▓, │, ─, ┌, ┐, └, ┘, ║, ═, etc.)
    const boxArtChars = trimmed.match(/[█▀▄▌▐░▒▓│─┌┐└┘├┤┬┴┼║═╔╗╚╝╠╣╦╩╬|_\-=+*~]/g);
    if (boxArtChars && boxArtChars.length / trimmed.length > 0.4) {
      return { isChrome: true, confidence: 0.98 };
    }

    // 2. TUI shortcut footers, model indicators, & splash banners
    const chromePatterns = [
      /ctrl\+[a-z]/i,
      /cmd\+[a-z]/i,
      /tab agents/i,
      /shift\+tab/i,
      /\/help to show/i,
      /Press \? for shortcuts/i,
      /\? for shortcuts/i,
      /Ask anything\.\.\./i,
      /Plan mode:/i,
      /^[>_⚡▪\s]*(?:plan:\s*)?(?:Gemini|Claude|GPT|DeepSeek|Ox Alpha)/i,
    ];

    for (const pattern of chromePatterns) {
      if (pattern.test(trimmed)) {
        return { isChrome: true, confidence: 0.95 };
      }
    }

    return { isChrome: false, confidence: 0.0 };
  }
}
