import type { Document, MultiSelection, Line, Operation } from '../core/types';
import type { EditorToken, EditorDiagnostic, LanguageParser } from '../language/types';
import { LineRenderer } from './LineRenderer';
import { Reconciler } from './Reconciler';
import { Gutter } from './Gutter';
import { InputHandler, InputActionHandler } from './InputHandler';
import { SelectionDOM } from './SelectionDOM';
import { ScrollManager } from './ScrollManager';
import { TokenCache } from './TokenCache';
import type { KeymapRegistry } from '../core/keymap/KeymapRegistry';

export type SelectionChangeHandler = (selection: MultiSelection) => void;
export type DeferredRenderCallback = () => void;

export class EditorView {
  private rootEl: HTMLElement;
  private gutterComponent: Gutter;
  private contentEl: HTMLElement;
  private lineRenderer: LineRenderer;
  private reconciler: Reconciler;
  private inputHandler: InputHandler;
  private selectionDOM: SelectionDOM;
  private scrollManager: ScrollManager;
  private currentParser: LanguageParser | null = null;
  private tokenCache: TokenCache;
  private selectionChangeHandler: SelectionChangeHandler | null = null;
  private boundSelectionChange: () => void;
  private boundContentScroll: () => void;
  private suppressSelectionChange: boolean = false;
  private lastActiveLineIndex: number = -1;
  private lastActiveLineEl: HTMLElement | null = null;

  /** Pending rAF id for coalescing selectionchange events */
  private selectionChangeRAF: number | null = null;

  /** Per-line HTML cache: lineId → html string */
  private htmlCache: Map<string, string> = new Map();

  /** Current document lines — kept for deferred tokenization callback */
  private lastDoc: Document | null = null;

  /** Callback after async tokenization updates DOM */
  private deferredRenderCallback: DeferredRenderCallback | null = null;

  /** Whether the first render has been done (uses sync tokenization) */
  private initialized: boolean = false;

  constructor(container: HTMLElement, keymapRegistry: KeymapRegistry) {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'nc-editor';
    this.rootEl.setAttribute('tabindex', '0');

    this.gutterComponent = new Gutter();
    this.rootEl.appendChild(this.gutterComponent.getElement());

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'nc-content';
    this.contentEl.setAttribute('contenteditable', 'true');
    this.contentEl.setAttribute('spellcheck', 'false');
    this.contentEl.setAttribute('autocorrect', 'off');
    this.contentEl.setAttribute('autocapitalize', 'off');
    this.rootEl.appendChild(this.contentEl);

    container.appendChild(this.rootEl);

    this.lineRenderer = new LineRenderer();
    this.reconciler = new Reconciler();
    this.tokenCache = new TokenCache();
    this.reconciler.setContainer(this.contentEl);
    this.inputHandler = new InputHandler(keymapRegistry);
    this.selectionDOM = new SelectionDOM();
    this.selectionDOM.setContentElement(this.contentEl);
    this.scrollManager = new ScrollManager();

    this.boundContentScroll = this.onContentScroll.bind(this);
    this.contentEl.addEventListener('scroll', this.boundContentScroll, { passive: true });

    this.boundSelectionChange = this.onSelectionChange.bind(this);
    document.addEventListener('selectionchange', this.boundSelectionChange);
  }

  // ===================================================================
  //  Public API
  // ===================================================================

  onInputAction(handler: InputActionHandler): void {
    this.inputHandler.attach(this.contentEl, handler);
  }

  onSelectionChanged(handler: SelectionChangeHandler): void {
    this.selectionChangeHandler = handler;
  }

  onDeferredRender(callback: DeferredRenderCallback): void {
    this.deferredRenderCallback = callback;
  }

  captureSelection(): MultiSelection | null {
    return this.selectionDOM.capture();
  }

  setParser(parser: LanguageParser | null): void {
    this.currentParser = parser;
    this.tokenCache.setParser(parser);
    this.htmlCache.clear();
    this.initialized = false;
  }

  /**
   * Full render with operations awareness.
   *
   * If `ops` is provided and the change is incremental (simple text edit),
   * only the affected line(s) are updated in the DOM — O(1) not O(n).
   *
   * Tokenization runs asynchronously on a debounced timer and never blocks
   * the render path.
   */
  render(doc: Document, selection: MultiSelection, ops?: readonly Operation[]): void {
    this.lastDoc = doc;
    const lines = doc.lines;

    // First-ever render: sync tokenize for correct initial paint
    if (!this.initialized) {
      this.initialized = true;
      this.tokenCache.tokenizeSync(lines);
      this.fullRender(lines, selection);
      return;
    }

    this.suppressSelectionChange = true;

    if (ops && ops.length > 0) {
      this.incrementalRender(lines, selection, ops);
    } else {
      // No ops = full refresh (setValue, undo/redo with complex changes)
      // Re-tokenize so new lineIds have tokens before rendering
      this.tokenCache.tokenizeSync(lines);
      this.fullRender(lines, selection);
      return; // fullRender already handles selection
    }

    // Restore selection
    this.selectionDOM.restore(selection);

    // Schedule async tokenization (viewport-aware for large files)
    const visibleRange = this.getVisibleLineRange();
    this.tokenCache.scheduleTokenization(lines, (changedIndices) => {
      this.applyDeferredTokenUpdate(changedIndices);
    }, visibleRange);

    Promise.resolve().then(() => { this.suppressSelectionChange = false; });
  }

  /** Selection-only render (clicks, arrow keys). No DOM content changes. */
  renderSelectionOnly(selection: MultiSelection): void {
    this.suppressSelectionChange = true;
    const currentLine = selection.ranges[selection.primary]?.anchor.line ?? 0;
    this.applyActiveLineHighlight(currentLine);
    this.selectionDOM.restore(selection);
    Promise.resolve().then(() => { this.suppressSelectionChange = false; });
  }

  /** Content-only render for remote collab ops. Does NOT touch selection. */
  renderContentOnly(doc: Document, currentLine: number, ops?: readonly Operation[]): void {
    this.lastDoc = doc;
    const lines = doc.lines;
    this.suppressSelectionChange = true;

    if (ops && ops.length > 0 && this.initialized) {
      this.incrementalRenderContent(lines, ops);
    } else {
      // Full refresh
      const lineData = this.buildAllLineData(lines);
      this.reconciler.reconcile(lineData);
    }

    this.applyActiveLineHighlight(currentLine);
    this.gutterComponent.update(lines.length, currentLine);

    const visibleRange = this.getVisibleLineRange();
    this.tokenCache.scheduleTokenization(lines, (changedIndices) => {
      this.applyDeferredTokenUpdate(changedIndices);
    }, visibleRange);

    Promise.resolve().then(() => { this.suppressSelectionChange = false; });
  }

  setDiagnostics(diagnostics: EditorDiagnostic[]): void {
    this.gutterComponent.setDiagnostics(diagnostics);
  }

  getRootElement(): HTMLElement { return this.rootEl; }
  getContentElement(): HTMLElement { return this.contentEl; }

  setKeyInterceptor(fn: ((e: KeyboardEvent) => boolean) | null): void {
    this.inputHandler.setKeyInterceptor(fn);
  }

  focus(): void { this.contentEl.focus(); }

  getVisibleLineRange(): { start: number; end: number } {
    const lineHeight = 20;
    const scrollTop = this.contentEl.scrollTop;
    const viewportHeight = this.contentEl.clientHeight;
    return {
      start: Math.floor(scrollTop / lineHeight),
      end: Math.ceil((scrollTop + viewportHeight) / lineHeight),
    };
  }

  destroy(): void {
    this.tokenCache.cancelPending();
    if (this.selectionChangeRAF !== null) cancelAnimationFrame(this.selectionChangeRAF);
    document.removeEventListener('selectionchange', this.boundSelectionChange);
    this.contentEl.removeEventListener('scroll', this.boundContentScroll);
    this.inputHandler.detach();
    this.scrollManager.detach();
    this.reconciler.clear();
    this.htmlCache.clear();
    this.rootEl.remove();
  }

  // ===================================================================
  //  Full render (initial, setValue, complex changes)
  // ===================================================================

  private fullRender(lines: readonly Line[], selection: MultiSelection): void {
    this.suppressSelectionChange = true;
    const lineData = this.buildAllLineData(lines);
    this.reconciler.reconcile(lineData);

    const currentLine = selection.ranges[selection.primary]?.anchor.line ?? 0;
    this.applyActiveLineHighlight(currentLine);
    this.gutterComponent.update(lines.length, currentLine);
    this.selectionDOM.restore(selection);

    // Schedule async tokenization for subsequent updates (viewport-aware)
    const visibleRange = this.getVisibleLineRange();
    this.tokenCache.scheduleTokenization(lines, (changedIndices) => {
      this.applyDeferredTokenUpdate(changedIndices);
    }, visibleRange);

    Promise.resolve().then(() => { this.suppressSelectionChange = false; });
  }

  /** Build line data for ALL lines using cached tokens. */
  private buildAllLineData(lines: readonly Line[]): Array<{ id: string; html: string; lineNumber: number }> {
    const result: Array<{ id: string; html: string; lineNumber: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const html = this.renderLineHtml(line.id, line.text);
      result.push({ id: line.id, html, lineNumber: i + 1 });
    }
    return result;
  }

  // ===================================================================
  //  Incremental render (single keystroke — O(affected lines) only)
  // ===================================================================

  /**
   * Render only the lines affected by the given operations.
   * For typical typing (insertText/deleteText), this touches exactly 1 line.
   */
  private incrementalRender(lines: readonly Line[], selection: MultiSelection, ops: readonly Operation[]): void {
    const currentLine = selection.ranges[selection.primary]?.anchor.line ?? 0;
    const hasStructural = ops.some(op =>
      op.type === 'splitLine' || op.type === 'mergeLine' ||
      op.type === 'insertLine' || op.type === 'deleteLine'
    );

    if (hasStructural) {
      // Structural change (Enter, Backspace at line start, paste with newlines).
      // We need to add/remove DOM elements. Use full reconcile but with cached HTML
      // so unchanged lines are cheap (just string identity check).
      const lineData = this.buildAllLineData(lines);
      this.reconciler.reconcile(lineData);
    } else {
      // In-place edit (typing, deleting chars). Only update affected lines.
      const affected = this.getAffectedLineIndices(ops);
      for (const idx of affected) {
        if (idx >= 0 && idx < lines.length) {
          const line = lines[idx];
          this.tokenCache.tokenizeLineSync(line.id, line.text);
          const html = this.renderLineHtml(line.id, line.text);
          this.reconciler.updateLineHtml(line.id, html);
        }
      }
    }

    this.applyActiveLineHighlight(currentLine);
    this.gutterComponent.update(lines.length, currentLine);
  }

  /** Same as incrementalRender but without touching selection (for remote ops). */
  private incrementalRenderContent(lines: readonly Line[], ops: readonly Operation[]): void {
    const hasStructural = ops.some(op =>
      op.type === 'splitLine' || op.type === 'mergeLine' ||
      op.type === 'insertLine' || op.type === 'deleteLine'
    );

    if (hasStructural) {
      const lineData = this.buildAllLineData(lines);
      this.reconciler.reconcile(lineData);
    } else {
      const affected = this.getAffectedLineIndices(ops);
      for (const idx of affected) {
        if (idx >= 0 && idx < lines.length) {
          const line = lines[idx];
          this.tokenCache.tokenizeLineSync(line.id, line.text);
          const html = this.renderLineHtml(line.id, line.text);
          this.reconciler.updateLineHtml(line.id, html);
        }
      }
    }
  }

  /** Extract unique line indices affected by the operations. */
  private getAffectedLineIndices(ops: readonly Operation[]): Set<number> {
    const indices = new Set<number>();
    for (const op of ops) {
      switch (op.type) {
        case 'insertText':
        case 'deleteText':
          indices.add(op.line);
          break;
        case 'replaceLine':
        case 'insertLine':
        case 'deleteLine':
          indices.add(op.index);
          break;
        case 'splitLine':
          indices.add(op.line);
          indices.add(op.line + 1);
          break;
        case 'mergeLine':
          indices.add(op.line - 1);
          indices.add(op.line);
          break;
      }
    }
    return indices;
  }

  // ===================================================================
  //  Line HTML rendering (with per-line token cache)
  // ===================================================================

  /** Render a line's HTML using cached tokens if available. */
  private renderLineHtml(lineId: string, text: string): string {
    const tokens = this.tokenCache.getLineTokens(lineId);
    let html: string;
    if (tokens && tokens.length > 0) {
      // Check if cached tokens still match this line's text
      const tokenText = concatTokenText(tokens);
      if (tokenText === text) {
        html = this.lineRenderer.renderLine(tokens, text);
      } else {
        // Tokens are stale — render as plain text
        html = this.lineRenderer.renderLine(null, text);
      }
    } else {
      html = this.lineRenderer.renderLine(null, text);
    }
    this.htmlCache.set(lineId, html);
    return html;
  }

  // ===================================================================
  //  Deferred tokenization callback (async, off critical path)
  // ===================================================================

  /**
   * Called when async tokenization completes. Updates only lines whose
   * highlighting actually changed. Preserves the cursor position.
   */
  private applyDeferredTokenUpdate(changedIndices: Set<number>): void {
    if (changedIndices.size === 0 || !this.lastDoc) return;

    const lines = this.lastDoc.lines;

    // Save current cursor position before modifying DOM
    const savedSelection = this.selectionDOM.capture();

    this.suppressSelectionChange = true;

    for (const lineIdx of changedIndices) {
      if (lineIdx >= lines.length) continue;
      const line = lines[lineIdx];
      const tokens = this.tokenCache.getLineTokens(line.id);
      const html = this.lineRenderer.renderLine(tokens, line.text);

      // Only update DOM if the HTML actually differs from what's cached
      const prevHtml = this.htmlCache.get(line.id);
      if (prevHtml !== html) {
        this.htmlCache.set(line.id, html);
        this.reconciler.updateLineHtml(line.id, html);
      }
    }

    // Restore cursor to where it was before DOM modifications
    if (savedSelection) {
      this.selectionDOM.restore(savedSelection);
    }

    Promise.resolve().then(() => { this.suppressSelectionChange = false; });

    // Notify host (minimap update, etc.)
    this.deferredRenderCallback?.();
  }

  // ===================================================================
  //  Internal helpers
  // ===================================================================

  private onContentScroll(): void {
    const gutterEl = this.gutterComponent.getElement();
    gutterEl.scrollTop = this.contentEl.scrollTop;
  }

  private applyActiveLineHighlight(lineIndex: number): void {
    // Remove from previously tracked element (by reference — survives reconcile reorders)
    if (this.lastActiveLineEl) {
      this.lastActiveLineEl.classList.remove('nc-line-highlight');
      this.lastActiveLineEl = null;
    }

    const children = this.contentEl.children;
    if (lineIndex >= 0 && lineIndex < children.length) {
      const el = children[lineIndex] as HTMLElement;
      el.classList.add('nc-line-highlight');
      this.lastActiveLineEl = el;
    }
    this.lastActiveLineIndex = lineIndex;
  }

  private onSelectionChange(): void {
    if (this.suppressSelectionChange) return;
    if (!this.selectionChangeHandler) return;
    if (this.selectionChangeRAF !== null) return; // already scheduled

    this.selectionChangeRAF = requestAnimationFrame(() => {
      this.selectionChangeRAF = null;
      if (this.suppressSelectionChange) return;
      if (!this.selectionChangeHandler) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const anchorNode = sel.anchorNode;
      if (!anchorNode || !this.contentEl.contains(anchorNode)) return;

      const captured = this.selectionDOM.capture();
      if (captured) {
        // Update active line highlight on click/arrow key navigation
        const currentLine = captured.ranges[captured.primary]?.anchor.line ?? 0;
        this.applyActiveLineHighlight(currentLine);
        this.selectionChangeHandler(captured);
      }
    });
  }
}

/** Concatenate all token texts (used to check if tokens are stale). */
function concatTokenText(tokens: EditorToken[]): string {
  let s = '';
  for (const t of tokens) s += t.text;
  return s;
}
