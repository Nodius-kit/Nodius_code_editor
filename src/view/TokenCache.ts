import type { EditorToken, LanguageParser } from '../language/types';
import type { Line } from '../core/types';

/**
 * Manages syntax tokenization completely decoupled from rendering.
 *
 * Tokenization runs on a debounced timer (not on every keystroke).
 * The view renders immediately using cached per-line tokens.
 * When tokenization completes, a callback fires so the view can
 * selectively repaint only the lines whose highlighting changed.
 */
export class TokenCache {
  private parser: LanguageParser | null = null;

  /** Per-line token cache: lineId → { text, tokens } */
  private lineTokens: Map<string, { text: string; tokens: EditorToken[] }> = new Map();

  /** Pending debounce timer */
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  /** Pending rAF for paint-aligned DOM update */
  private pendingRAF: number | null = null;

  /** Pending idle callback for background (off-viewport) tokenization */
  private pendingIdle: number | null = null;

  /** Debounce delay in ms */
  private debounceMs: number = 50;

  /** Line count threshold for viewport-aware tokenization */
  private viewportThreshold: number = 500;

  setParser(parser: LanguageParser | null): void {
    if (this.parser !== parser) {
      this.parser = parser;
      this.invalidateAll();
    }
  }

  /**
   * Get cached tokens for a specific line. Returns null if not yet tokenized.
   * This is O(1) — a simple Map lookup.
   */
  getLineTokens(lineId: string): EditorToken[] | null {
    const cached = this.lineTokens.get(lineId);
    return cached?.tokens ?? null;
  }

  /**
   * Synchronously tokenize a single line in isolation and update the cache.
   * Fast (~<1ms) — tokenizes just one line, not the full document.
   * Result is correct for ~95%+ of cases; only cross-line constructs
   * (multi-line comments/strings) may be slightly off until the async
   * full-document tokenization corrects them.
   */
  tokenizeLineSync(lineId: string, lineText: string): void {
    if (!this.parser) return;
    try {
      const tokens = this.parser.tokenize(lineText);
      const lineTokens = tokens.filter(t => t.line === 0);
      this.lineTokens.set(lineId, { text: lineText, tokens: lineTokens });
    } catch {
      // Fallback: leave cache as-is (plain text render)
    }
  }

  /**
   * Force synchronous tokenization of the full document.
   * Used only for first render to ensure correct initial paint.
   */
  tokenizeSync(lines: readonly Line[]): void {
    if (!this.parser) return;

    const fullText = lines.map(l => l.text).join('\n');
    let allTokens: EditorToken[];
    try {
      allTokens = this.parser.tokenize(fullText);
    } catch {
      return;
    }

    this.updateLineTokenCache(lines, allTokens);
  }

  /**
   * Schedule an async tokenization. Debounces rapid calls — only the
   * last one executes. When done, calls `onComplete` with the indices
   * of lines whose tokens actually changed.
   *
   * For files > viewportThreshold lines, only tokenizes visible lines + buffer
   * in the first pass, then schedules the rest via requestIdleCallback.
   */
  scheduleTokenization(
    lines: readonly Line[],
    onComplete: (changedLineIndices: Set<number>) => void,
    visibleRange?: { start: number; end: number },
  ): void {
    if (!this.parser) return;

    this.cancelPending();

    const parser = this.parser;
    const snapshot = lines.map(l => ({ id: l.id, text: l.text }));
    const useViewportAware = visibleRange && snapshot.length >= this.viewportThreshold;

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (this.parser !== parser) return;

      if (useViewportAware) {
        this.tokenizeViewportFirst(parser, snapshot, onComplete, visibleRange!);
      } else {
        this.tokenizeFull(parser, snapshot, onComplete);
      }
    }, this.debounceMs);
  }

  /** Tokenize the full document and fire onComplete for changed lines. */
  private tokenizeFull(
    parser: LanguageParser,
    snapshot: Array<{ id: string; text: string }>,
    onComplete: (changedLineIndices: Set<number>) => void,
  ): void {
    const fullText = snapshot.map(l => l.text).join('\n');
    let allTokens: EditorToken[];
    try {
      allTokens = parser.tokenize(fullText);
    } catch {
      return;
    }

    const newByLine = this.indexTokensByLine(allTokens);
    const changed = this.diffAndUpdateCache(snapshot, newByLine, 0, snapshot.length);

    if (changed.size > 0) {
      this.pendingRAF = requestAnimationFrame(() => {
        this.pendingRAF = null;
        onComplete(changed);
      });
    }
  }

  /**
   * Two-pass viewport-aware tokenization:
   * 1. First pass: tokenize visible lines + buffer (±50 lines)
   * 2. Second pass: tokenize full document via requestIdleCallback
   */
  private tokenizeViewportFirst(
    parser: LanguageParser,
    snapshot: Array<{ id: string; text: string }>,
    onComplete: (changedLineIndices: Set<number>) => void,
    visibleRange: { start: number; end: number },
  ): void {
    const buffer = 50;
    const vpStart = Math.max(0, visibleRange.start - buffer);
    const vpEnd = Math.min(snapshot.length, visibleRange.end + buffer);

    // Pass 1: tokenize only the viewport slice
    const vpLines = snapshot.slice(vpStart, vpEnd);
    const vpText = vpLines.map(l => l.text).join('\n');
    let vpTokens: EditorToken[];
    try {
      vpTokens = parser.tokenize(vpText);
    } catch {
      return;
    }

    const vpByLine = this.indexTokensByLine(vpTokens);

    // Update cache for viewport lines (offset token line indices by vpStart)
    const changed = new Set<number>();
    for (let i = 0; i < vpLines.length; i++) {
      const globalIdx = vpStart + i;
      const line = snapshot[globalIdx];
      const oldCached = this.lineTokens.get(line.id);
      const newTokens = vpByLine.get(i) ?? [];

      if (!oldCached || !tokensEqual(oldCached.tokens, newTokens)) {
        changed.add(globalIdx);
      }
      this.lineTokens.set(line.id, { text: line.text, tokens: newTokens });
    }

    if (changed.size > 0) {
      this.pendingRAF = requestAnimationFrame(() => {
        this.pendingRAF = null;
        onComplete(changed);
      });
    }

    // Pass 2: full document tokenization in idle time
    const scheduleIdle = typeof requestIdleCallback === 'function'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100) as unknown as number;

    this.pendingIdle = scheduleIdle(() => {
      this.pendingIdle = null;
      if (this.parser !== parser) return;

      const fullText = snapshot.map(l => l.text).join('\n');
      let allTokens: EditorToken[];
      try {
        allTokens = parser.tokenize(fullText);
      } catch {
        return;
      }

      const newByLine = this.indexTokensByLine(allTokens);
      const fullChanged = this.diffAndUpdateCache(snapshot, newByLine, 0, snapshot.length);

      if (fullChanged.size > 0) {
        requestAnimationFrame(() => {
          onComplete(fullChanged);
        });
      }
    });
  }

  /** Index tokens into a Map<lineNumber, EditorToken[]>. */
  private indexTokensByLine(tokens: EditorToken[]): Map<number, EditorToken[]> {
    const byLine: Map<number, EditorToken[]> = new Map();
    for (const token of tokens) {
      let arr = byLine.get(token.line);
      if (!arr) { arr = []; byLine.set(token.line, arr); }
      arr.push(token);
    }
    return byLine;
  }

  /** Diff new tokens against cache for [start, end) range, update cache, return changed indices. */
  private diffAndUpdateCache(
    snapshot: Array<{ id: string; text: string }>,
    newByLine: Map<number, EditorToken[]>,
    start: number,
    end: number,
  ): Set<number> {
    const changed = new Set<number>();
    for (let i = start; i < end; i++) {
      const line = snapshot[i];
      const oldCached = this.lineTokens.get(line.id);
      const newTokens = newByLine.get(i) ?? [];

      if (!oldCached || !tokensEqual(oldCached.tokens, newTokens)) {
        changed.add(i);
      }
      this.lineTokens.set(line.id, { text: line.text, tokens: newTokens });
    }
    return changed;
  }

  cancelPending(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.pendingRAF !== null) {
      cancelAnimationFrame(this.pendingRAF);
      this.pendingRAF = null;
    }
    if (this.pendingIdle !== null) {
      const cancelIdle = typeof cancelIdleCallback === 'function'
        ? cancelIdleCallback
        : clearTimeout;
      cancelIdle(this.pendingIdle);
      this.pendingIdle = null;
    }
  }

  invalidateAll(): void {
    this.cancelPending();
    this.lineTokens.clear();
  }

  // ---------------------------------------------------------------
  //  Private
  // ---------------------------------------------------------------

  private updateLineTokenCache(lines: readonly Line[], allTokens: EditorToken[]): void {
    const byLine = this.indexTokensByLine(allTokens);
    this.lineTokens.clear();
    for (let i = 0; i < lines.length; i++) {
      this.lineTokens.set(lines[i].id, {
        text: lines[i].text,
        tokens: byLine.get(i) ?? [],
      });
    }
  }
}

function tokensEqual(a: EditorToken[], b: EditorToken[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind || a[i].text !== b[i].text) return false;
  }
  return true;
}
