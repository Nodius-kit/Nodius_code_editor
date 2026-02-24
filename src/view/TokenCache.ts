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

  /** Debounce delay in ms */
  private debounceMs: number = 80;

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
   */
  scheduleTokenization(
    lines: readonly Line[],
    onComplete: (changedLineIndices: Set<number>) => void,
  ): void {
    if (!this.parser) return;

    this.cancelPending();

    const parser = this.parser;
    const snapshot = lines.map(l => ({ id: l.id, text: l.text }));

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (this.parser !== parser) return;

      const fullText = snapshot.map(l => l.text).join('\n');
      let allTokens: EditorToken[];
      try {
        allTokens = parser.tokenize(fullText);
      } catch {
        return;
      }

      // Index new tokens by line
      const newByLine: Map<number, EditorToken[]> = new Map();
      for (const token of allTokens) {
        let arr = newByLine.get(token.line);
        if (!arr) { arr = []; newByLine.set(token.line, arr); }
        arr.push(token);
      }

      // Diff against cached tokens to find changed lines
      const changed = new Set<number>();
      for (let i = 0; i < snapshot.length; i++) {
        const line = snapshot[i];
        const oldCached = this.lineTokens.get(line.id);
        const newTokens = newByLine.get(i) ?? [];

        if (!oldCached || !tokensEqual(oldCached.tokens, newTokens)) {
          changed.add(i);
        }
      }

      // Update cache
      this.lineTokens.clear();
      for (let i = 0; i < snapshot.length; i++) {
        this.lineTokens.set(snapshot[i].id, {
          text: snapshot[i].text,
          tokens: newByLine.get(i) ?? [],
        });
      }

      if (changed.size > 0) {
        onComplete(changed);
      }
    }, this.debounceMs);
  }

  cancelPending(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
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
    const byLine: Map<number, EditorToken[]> = new Map();
    for (const token of allTokens) {
      let arr = byLine.get(token.line);
      if (!arr) { arr = []; byLine.set(token.line, arr); }
      arr.push(token);
    }

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
