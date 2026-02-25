import type {
  EditorOptions,
  EditorEvents,
  Transaction,
  Operation,
  MultiSelection,
  Document,
  OperationOrigin,
} from './core/types';
import { createDocument, getText, getLineCount } from './core/document/Document';
import { applyOperation } from './core/operations/OperationEngine';
import {
  createPosition,
  createRange,
  createCollapsedRange,
  createSelection,
  isCollapsed,
  mapSelectionThroughOps,
} from './core/selection/Selection';
import { EventBus } from './core/events/EventBus';
import { EditorState } from './core/EditorState';
import { HistoryManager } from './core/history/HistoryManager';
import { CommandRegistry } from './core/commands/CommandRegistry';
import { KeymapRegistry } from './core/keymap/KeymapRegistry';
import { LanguageRegistry } from './language/LanguageRegistry';
import { TypeScriptParser } from './language/typescript/TypeScriptParser';
import { ThemeManager } from './themes/ThemeManager';
import { EditorView } from './view/EditorView';
import { StatusBar } from './view/StatusBar';
import { TabBar } from './view/TabBar';
import { Minimap } from './view/Minimap';
import { Sidebar } from './view/Sidebar';
import { FindReplace } from './view/FindReplace';
import type { SearchOptions } from './view/FindReplace';
import { AutocompleteWidget } from './view/AutocompleteWidget';
import type { InputAction } from './view/InputHandler';
import { CompletionEngine } from './core/completion/CompletionEngine';
import { TypeScriptCompletionProvider } from './language/typescript/TypeScriptCompletionProvider';
import type { CompletionItem, CompletionProvider, CompletionResult, CompletionContext } from './core/completion/types';
import './styles/editor.css';

export class NodiusEditor {
  private container: HTMLElement;
  private options: Required<EditorOptions>;
  private state: EditorState;
  private eventBus: EventBus<EditorEvents>;
  private historyManager: HistoryManager;
  private commandRegistry: CommandRegistry;
  private keymapRegistry: KeymapRegistry;
  private languageRegistry: LanguageRegistry;
  private themeManager: ThemeManager;
  private view: EditorView | null = null;
  private statusBar: StatusBar | null = null;
  private tabBar: TabBar | null = null;
  private minimap: Minimap;
  private sidebar: Sidebar | null = null;
  private findReplace: FindReplace | null = null;
  private wrapperEl: HTMLElement;
  private readOnly: boolean;
  private isRendering: boolean = false;

  // Find/Replace state
  private findMatches: Array<{ line: number; column: number; length: number }> = [];
  private findMatchIndex: number = -1;

  // Autocomplete state
  private completionEngine: CompletionEngine;
  private autocompleteWidget: AutocompleteWidget | null = null;
  private tsCompletionProvider: TypeScriptCompletionProvider | null = null;
  private autocompleteActive: boolean = false;
  private lastCompletionResult: CompletionResult | null = null;
  private lastCompletionContext: CompletionContext | null = null;
  private autocompleteDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private docResolveTimer: ReturnType<typeof setTimeout> | null = null;
  private inputActionPending: boolean = false;

  constructor(container: HTMLElement, options: EditorOptions = {}) {
    this.container = container;
    this.options = {
      value: options.value ?? '',
      language: options.language ?? 'auto',
      fileName: options.fileName ?? 'untitled.ts',
      theme: options.theme ?? 'dark',
      readOnly: options.readOnly ?? false,
      fontSize: options.fontSize ?? 14,
      tabSize: options.tabSize ?? 2,
      minimap: options.minimap ?? true,
      lineNumbers: options.lineNumbers ?? true,
      wordWrap: options.wordWrap ?? false,
      tabBar: options.tabBar ?? true,
      sidebar: options.sidebar ?? true,
      statusBar: options.statusBar ?? true,
      findReplace: options.findReplace ?? true,
      autocomplete: options.autocomplete ?? true,
    };
    this.readOnly = this.options.readOnly;

    // Init core systems
    this.eventBus = new EventBus();
    this.historyManager = new HistoryManager();
    this.commandRegistry = new CommandRegistry();
    this.keymapRegistry = new KeymapRegistry();
    this.languageRegistry = new LanguageRegistry();
    this.themeManager = new ThemeManager();

    // Register built-in language parser
    this.languageRegistry.register(new TypeScriptParser());

    // Register default keybindings
    this.keymapRegistry.registerDefaults();

    // Detect language
    let languageId = this.options.language;
    if (languageId === 'auto') {
      languageId =
        this.languageRegistry.detectLanguage(this.options.value, this.options.fileName) ??
        'plaintext';
    }

    // Create initial state
    const doc = createDocument(this.options.value);
    this.state = new EditorState({
      doc,
      selection: createSelection(),
      language: languageId,
      fileName: this.options.fileName,
    });

    // Push initial state for undo
    this.historyManager.pushState({
      doc: this.state.doc,
      selection: this.state.selection,
      timestamp: Date.now(),
    });

    // Build DOM layout
    this.wrapperEl = document.createElement('div');
    this.wrapperEl.className = 'nc-editor-wrapper';

    // Tab bar - only create if enabled
    if (this.options.tabBar) {
      this.tabBar = new TabBar();
      this.wrapperEl.appendChild(this.tabBar.getElement());
    }

    // Main area (sidebar + editor center)
    const mainEl = document.createElement('div');
    mainEl.className = 'nc-editor-main';

    // Sidebar - only create if enabled
    if (this.options.sidebar) {
      this.sidebar = new Sidebar();
      mainEl.appendChild(this.sidebar.getElement());
    }

    // Center area (editor + minimap)
    const centerEl = document.createElement('div');
    centerEl.className = 'nc-editor-center';

    // Editor view
    this.view = new EditorView(centerEl, this.keymapRegistry);

    // Find/Replace panel - only create if enabled
    if (this.options.findReplace) {
      this.findReplace = new FindReplace();
      centerEl.appendChild(this.findReplace.getElement());
    }

    // Minimap
    this.minimap = new Minimap();
    this.minimap.setVisible(this.options.minimap);
    centerEl.appendChild(this.minimap.getElement());

    mainEl.appendChild(centerEl);
    this.wrapperEl.appendChild(mainEl);

    // Status bar - only create if enabled
    if (this.options.statusBar) {
      this.statusBar = new StatusBar();
      this.wrapperEl.appendChild(this.statusBar.getElement());
    }

    // Mount
    this.container.appendChild(this.wrapperEl);

    // Apply theme
    this.themeManager.setContainer(this.wrapperEl);
    this.themeManager.setTheme(this.options.theme);

    // Resolve minimap colors from computed styles
    this.minimap.resolveColors(this.wrapperEl);

    // Wire minimap click to scroll editor
    this.minimap.setOnClick((line) => {
      const contentEl = this.view?.getContentElement();
      if (contentEl) {
        const lineHeight = 20;
        contentEl.scrollTop = line * lineHeight;
      }
    });

    // Apply font size
    this.view.getRootElement().style.fontSize = `${this.options.fontSize}px`;

    // Set parser for syntax highlighting (with fallback for unknown languages)
    let parser = this.languageRegistry.getParserById(languageId);
    if (!parser && languageId !== 'plaintext') {
      parser = this.languageRegistry.getParserById('typescript');
    }
    this.view.setParser(parser ?? null);

    // Register commands
    this.registerBuiltinCommands();

    // Wire Find/Replace panel (only if enabled)
    if (this.options.findReplace) {
      this.wireFindReplace();
    }

    // Autocomplete setup
    this.completionEngine = new CompletionEngine();
    if (this.options.autocomplete) {
      this.autocompleteWidget = new AutocompleteWidget();
      centerEl.appendChild(this.autocompleteWidget.getElement());

      this.autocompleteWidget.onAccept = (item: CompletionItem) => {
        this.acceptCompletion(item);
      };
      this.autocompleteWidget.onDismiss = () => {
        this.dismissAutocomplete();
      };
      this.autocompleteWidget.onSelectionChange = () => {
        this.scheduleDocResolve();
      };

      // Create TS completion provider
      this.tsCompletionProvider = new TypeScriptCompletionProvider();
      this.completionEngine.registerProvider(this.tsCompletionProvider);

      // Install key interceptor for autocomplete navigation
      this.view!.setKeyInterceptor((e: KeyboardEvent) => {
        if (!this.autocompleteActive || !this.autocompleteWidget?.isVisible()) return false;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            this.autocompleteWidget!.selectNext();
            this.scheduleDocResolve();
            return true;
          case 'ArrowUp':
            e.preventDefault();
            this.autocompleteWidget!.selectPrev();
            this.scheduleDocResolve();
            return true;
          case 'Enter':
          case 'Tab': {
            e.preventDefault();
            const item = this.autocompleteWidget!.getSelectedItem();
            if (item) this.acceptCompletion(item);
            return true;
          }
          case 'Escape':
            e.preventDefault();
            this.dismissAutocomplete();
            return true;
          default:
            return false;
        }
      });

      // Dismiss autocomplete when editor loses focus
      this.view!.getContentElement().addEventListener('blur', () => {
        // Small delay: allow clicks on the widget itself to fire first
        setTimeout(() => {
          if (!this.view?.getContentElement().contains(document.activeElement) &&
              !this.autocompleteWidget?.getElement().contains(document.activeElement)) {
            this.dismissAutocomplete();
          }
        }, 150);
      });
    }

    // Hide gutter if lineNumbers is disabled
    if (!this.options.lineNumbers) {
      this.view.getRootElement().querySelector('.nc-gutter')?.setAttribute('style', 'display:none');
    }

    // Wire deferred render callback (async tokenization updates minimap)
    this.view.onDeferredRender(() => {
      this.updateMinimap();
    });

    // Wire up input handling - sync selection from DOM BEFORE each action
    this.view.onInputAction(this.handleInputAction.bind(this));

    // Wire up DOM selection changes (clicks, arrow keys) -> model
    this.view.onSelectionChanged((selection) => {
      if (this.isRendering) return;
      this.state = new EditorState({
        ...this.state.snapshot,
        selection,
      });
      // Dismiss autocomplete on click/arrow navigation — but NOT when
      // the selectionchange was caused by an input action (typing), since
      // the autocomplete handler has already decided whether to show/dismiss.
      if (!this.inputActionPending) {
        this.dismissAutocomplete();
      }
      // Update status bar without re-rendering content
      const primary = selection.ranges[selection.primary];
      if (primary) {
        this.statusBar?.updatePosition(primary.focus.line, primary.focus.column);
      }
      this.eventBus.emit('selection:change', { selection });
    });

    // Add initial tab
    this.tabBar?.addTab({
      id: 'tab-1',
      fileName: this.options.fileName,
      modified: false,
    });
    this.tabBar?.setActiveTab('tab-1');

    // Update status bar
    this.statusBar?.updateLanguage(languageId);
    this.statusBar?.updatePosition(0, 0);
    this.statusBar?.updateIndent('spaces', this.options.tabSize);

    // Initial render
    this.renderView();

    // Emit mount event
    this.eventBus.emit('mount', { container });
  }

  // ========== Public API ==========

  /**
   * Factory method — accepts a CSS selector string or an HTMLElement.
   * Returns a new NodiusEditor instance mounted in the resolved container.
   */
  static create(
    container: HTMLElement | string,
    options?: EditorOptions
  ): NodiusEditor {
    const el = typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;
    if (!el) {
      throw new Error(`NodiusEditor.create: container not found for selector "${container}"`);
    }
    return new NodiusEditor(el, options);
  }

  getValue(): string {
    return getText(this.state.doc);
  }

  setValue(value: string): void {
    const doc = createDocument(value);
    this.state = new EditorState({
      doc,
      selection: createSelection(),
      language: this.state.language,
      fileName: this.state.fileName,
    });
    this.historyManager.pushState({
      doc: this.state.doc,
      selection: this.state.selection,
      timestamp: Date.now(),
    });
    this.renderView();
    this.eventBus.emit('content:change', { document: this.state.doc, ops: [] });
  }

  getSelection(): MultiSelection {
    return this.state.selection;
  }

  setSelection(selection: MultiSelection): void {
    this.state = new EditorState({
      ...this.state.snapshot,
      selection,
    });
    // Only restore DOM selection, don't re-render content
    this.isRendering = true;
    this.view?.renderSelectionOnly(selection);
    this.isRendering = false;
    this.eventBus.emit('selection:change', { selection });
  }

  getLanguage(): string {
    return this.state.language;
  }

  setLanguage(languageId: string): void {
    this.state = new EditorState({
      ...this.state.snapshot,
      language: languageId,
    });
    let parser = this.languageRegistry.getParserById(languageId);
    if (!parser && languageId !== 'plaintext') {
      parser = this.languageRegistry.getParserById('typescript');
    }
    this.view?.setParser(parser ?? null);
    this.statusBar?.updateLanguage(languageId);
    this.renderView();
    this.eventBus.emit('language:change', { languageId });
  }

  getTheme(): 'dark' | 'light' {
    return this.themeManager.getTheme();
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.themeManager.setTheme(theme);
    this.minimap.resolveColors(this.wrapperEl);
    this.updateMinimap();
    this.eventBus.emit('theme:change', { theme });
  }

  toggleTheme(): 'dark' | 'light' {
    const theme = this.themeManager.toggleTheme();
    this.minimap.resolveColors(this.wrapperEl);
    this.updateMinimap();
    this.eventBus.emit('theme:change', { theme });
    return theme;
  }

  focus(): void {
    this.view?.focus();
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    const contentEl = this.view?.getContentElement();
    if (contentEl) {
      contentEl.setAttribute('contenteditable', String(!readOnly));
    }
  }

  on<K extends keyof EditorEvents>(
    event: K,
    handler: (data: EditorEvents[K]) => void
  ): () => void {
    return this.eventBus.on(event, handler);
  }

  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  getKeymapRegistry(): KeymapRegistry {
    return this.keymapRegistry;
  }

  getLanguageRegistry(): LanguageRegistry {
    return this.languageRegistry;
  }

  getDocument(): Document {
    return this.state.doc;
  }

  dispatch(transaction: Transaction): void {
    this.applyTransaction(transaction);
  }

  // ========== Autocomplete Public API ==========

  registerCompletions(items: CompletionItem[]): () => void {
    return this.completionEngine.registerSimpleCompletions(items);
  }

  registerCompletionProvider(provider: CompletionProvider): () => void {
    return this.completionEngine.registerProvider(provider);
  }

  // ========== UI Component Visibility ==========

  showTabBar(visible: boolean): void {
    if (visible && !this.tabBar) {
      this.tabBar = new TabBar();
      // Insert tab bar as first child of wrapper
      this.wrapperEl.insertBefore(this.tabBar.getElement(), this.wrapperEl.firstChild);
      this.tabBar.addTab({
        id: 'tab-1',
        fileName: this.options.fileName,
        modified: false,
      });
      this.tabBar.setActiveTab('tab-1');
    } else if (!visible && this.tabBar) {
      this.tabBar.getElement().remove();
      this.tabBar = null;
    }
  }

  showSidebar(visible: boolean): void {
    if (visible && !this.sidebar) {
      this.sidebar = new Sidebar();
      const mainEl = this.wrapperEl.querySelector('.nc-editor-main');
      if (mainEl) {
        mainEl.insertBefore(this.sidebar.getElement(), mainEl.firstChild);
      }
    } else if (!visible && this.sidebar) {
      this.sidebar.getElement().remove();
      this.sidebar = null;
    }
  }

  showStatusBar(visible: boolean): void {
    if (visible && !this.statusBar) {
      this.statusBar = new StatusBar();
      this.wrapperEl.appendChild(this.statusBar.getElement());
      this.statusBar.updateLanguage(this.state.language);
      const primary = this.state.selection.ranges[this.state.selection.primary];
      if (primary) {
        this.statusBar.updatePosition(primary.focus.line, primary.focus.column);
      }
      this.statusBar.updateIndent('spaces', this.options.tabSize);
    } else if (!visible && this.statusBar) {
      this.statusBar.getElement().remove();
      this.statusBar = null;
    }
  }

  showLineNumbers(visible: boolean): void {
    const gutter = this.view?.getRootElement().querySelector('.nc-gutter') as HTMLElement | null;
    if (gutter) {
      gutter.style.display = visible ? '' : 'none';
    }
  }

  showMinimap(visible: boolean): void {
    this.minimap.setVisible(visible);
    if (visible) {
      this.updateMinimap();
    }
  }

  destroy(): void {
    this.dismissAutocomplete();
    this.autocompleteWidget?.destroy();
    this.tsCompletionProvider?.dispose();
    this.view?.destroy();
    this.wrapperEl.remove();
    this.eventBus.emit('destroy', {});
    this.eventBus.removeAllListeners();
  }

  // ========== Internals ==========

  /** Sync DOM selection into the model (call before processing input) */
  private syncSelectionFromDOM(): void {
    if (!this.view) return;
    const captured = this.view.captureSelection();
    if (captured) {
      this.state = new EditorState({
        ...this.state.snapshot,
        selection: captured,
      });
    }
  }

  private applyTransaction(transaction: Transaction): void {
    const prevState = this.state;
    this.state = this.state.dispatch(transaction);

    // Record for undo (unless this is an undo/redo or remote)
    if (
      transaction.origin !== 'history:undo' &&
      transaction.origin !== 'history:redo' &&
      transaction.origin !== 'remote'
    ) {
      this.historyManager.pushState({
        doc: prevState.doc,
        selection: prevState.selection,
        timestamp: Date.now(),
      });
    }

    // Remote ops: update content without stealing DOM cursor focus
    if (transaction.origin === 'remote') {
      this.renderContentOnly(transaction.ops);
    } else {
      this.renderView(transaction.ops);
    }

    // Emit events
    this.eventBus.emit('state:change', { state: this.state.snapshot });
    if (transaction.ops.length > 0) {
      this.eventBus.emit('content:change', {
        document: this.state.doc,
        ops: transaction.ops,
      });
    }
    this.eventBus.emit('selection:change', { selection: this.state.selection });
  }

  private renderView(ops?: readonly Operation[]): void {
    if (!this.view) return;
    this.isRendering = true;
    this.view.render(this.state.doc, this.state.selection, ops);
    this.isRendering = false;

    // Update status bar position
    const primary = this.state.selection.ranges[this.state.selection.primary];
    if (primary) {
      this.statusBar?.updatePosition(primary.focus.line, primary.focus.column);
    }

    // Update minimap
    this.updateMinimap();
  }

  /** Render content only — does NOT move the DOM cursor. Used for remote collab ops. */
  private renderContentOnly(ops?: readonly Operation[]): void {
    if (!this.view) return;
    this.isRendering = true;
    const currentLine = this.state.selection.ranges[this.state.selection.primary]?.anchor.line ?? 0;
    this.view.renderContentOnly(this.state.doc, currentLine, ops);
    this.isRendering = false;
    this.updateMinimap();
  }

  private updateMinimap(): void {
    if (!this.view) return;
    const lines = this.state.doc.lines.map((l) => ({ text: l.text }));
    const { start, end } = this.view.getVisibleLineRange();
    this.minimap.update(lines, start, end);
  }

  private wireFindReplace(): void {
    if (!this.findReplace) return;
    const fr = this.findReplace;

    fr.setSearchHandler((options: SearchOptions) => {
      this.performSearch(options);
    });

    fr.setNavigateHandler((direction) => {
      if (this.findMatches.length === 0) return;
      if (direction === 'next') {
        this.findMatchIndex = (this.findMatchIndex + 1) % this.findMatches.length;
      } else {
        this.findMatchIndex = (this.findMatchIndex - 1 + this.findMatches.length) % this.findMatches.length;
      }
      this.selectCurrentMatch();
    });

    fr.setReplaceHandler({
      onReplace: (replacement: string) => {
        if (this.findMatches.length === 0 || this.findMatchIndex < 0) return;
        const match = this.findMatches[this.findMatchIndex];
        const ops: Operation[] = [
          { type: 'deleteText', line: match.line, column: match.column, length: match.length, origin: 'command' as OperationOrigin },
          { type: 'insertText', line: match.line, column: match.column, text: replacement, origin: 'command' as OperationOrigin },
        ];
        this.applyTransaction({ ops, origin: 'command' });
        // Re-search after replace
        this.performSearch({
          query: this.findReplace?.getFindQuery() ?? '',
          caseSensitive: false,
          wholeWord: false,
          regex: false,
        });
      },
      onReplaceAll: (replacement: string) => {
        if (this.findMatches.length === 0) return;
        // Replace from bottom to top so indices remain valid
        const sorted = [...this.findMatches].sort((a, b) => {
          if (a.line !== b.line) return b.line - a.line;
          return b.column - a.column;
        });
        const ops: Operation[] = [];
        for (const match of sorted) {
          ops.push({ type: 'deleteText', line: match.line, column: match.column, length: match.length, origin: 'command' as OperationOrigin });
          ops.push({ type: 'insertText', line: match.line, column: match.column, text: replacement, origin: 'command' as OperationOrigin });
        }
        this.applyTransaction({ ops, origin: 'command' });
        this.findMatches = [];
        this.findMatchIndex = -1;
        this.findReplace?.updateMatchCount(0, 0);
      },
    });

    fr.setCloseHandler(() => {
      this.findMatches = [];
      this.findMatchIndex = -1;
      this.view?.focus();
    });
  }

  private performSearch(options: SearchOptions): void {
    this.findMatches = [];
    this.findMatchIndex = -1;

    if (!options.query) {
      this.findReplace?.updateMatchCount(0, 0);
      return;
    }

    const lines = this.state.doc.lines;
    let pattern: RegExp;

    try {
      let source = options.regex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (options.wholeWord) source = `\\b${source}\\b`;
      const flags = options.caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(source, flags);
    } catch {
      // Invalid regex
      this.findReplace?.updateMatchCount(0, 0);
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      let m: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(lines[i].text)) !== null) {
        this.findMatches.push({ line: i, column: m.index, length: m[0].length });
        if (m[0].length === 0) break; // prevent infinite loop on zero-length match
      }
    }

    if (this.findMatches.length > 0) {
      // Find the nearest match to the cursor
      const sel = this.state.selection;
      const cursorLine = sel.ranges[sel.primary]?.focus.line ?? 0;
      const cursorCol = sel.ranges[sel.primary]?.focus.column ?? 0;
      let best = 0;
      for (let i = 0; i < this.findMatches.length; i++) {
        const match = this.findMatches[i];
        if (match.line > cursorLine || (match.line === cursorLine && match.column >= cursorCol)) {
          best = i;
          break;
        }
      }
      this.findMatchIndex = best;
      this.selectCurrentMatch();
    } else {
      this.findReplace?.updateMatchCount(0, 0);
    }
  }

  private selectCurrentMatch(): void {
    if (this.findMatchIndex < 0 || this.findMatchIndex >= this.findMatches.length) return;
    const match = this.findMatches[this.findMatchIndex];
    const selection = createSelection([
      createRange(
        createPosition(match.line, match.column),
        createPosition(match.line, match.column + match.length),
      ),
    ]);
    this.setSelection(selection);
    this.findReplace?.updateMatchCount(this.findMatchIndex + 1, this.findMatches.length);

    // Scroll to the match line
    const contentEl = this.view?.getContentElement();
    if (contentEl) {
      const lineHeight = 20;
      const targetTop = match.line * lineHeight;
      const viewportHeight = contentEl.clientHeight;
      if (targetTop < contentEl.scrollTop || targetTop > contentEl.scrollTop + viewportHeight - lineHeight) {
        contentEl.scrollTop = targetTop - viewportHeight / 3;
      }
    }
  }

  private handleInputAction(action: InputAction): void {
    if (this.readOnly && action.type !== 'command') return;

    // Mark that an input action is in progress — prevents the selectionchange
    // rAF handler from dismissing autocomplete that was just triggered.
    this.inputActionPending = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { this.inputActionPending = false; });
    });

    // CRITICAL: sync the DOM selection to model before processing ANY input.
    // Without this, the model's cursor position is stale and text gets
    // inserted at the wrong location.
    this.syncSelectionFromDOM();

    switch (action.type) {
      case 'command':
        this.commandRegistry.execute(action.commandId);
        break;
      case 'insertText':
        this.insertText(action.text);
        break;
      case 'deleteBackward':
        this.deleteBackward();
        break;
      case 'deleteForward':
        this.deleteForward();
        break;
      case 'newLine':
        this.insertNewLine();
        break;
    }

    // Autocomplete lifecycle
    if (this.options.autocomplete) {
      this.handleAutocompleteAfterAction(action);
    }
  }

  // ========== Autocomplete Internals ==========

  private handleAutocompleteAfterAction(action: InputAction): void {
    switch (action.type) {
      case 'insertText': {
        const text = action.text;
        if (text.length === 1) {
          const triggerChars = this.completionEngine.getTriggerCharacters();
          if (triggerChars.has(text)) {
            // Trigger character: show immediately
            this.scheduleAutocomplete(0, 'triggerCharacter', text);
          } else if (/[\w$]/.test(text)) {
            // Identifier character: debounce
            this.scheduleAutocomplete(80, 'automatic');
          } else if (/[\s;)}\]]/.test(text)) {
            // Dismiss on space, semicolons, closing brackets
            this.dismissAutocomplete();
          }
        } else {
          // Multi-char paste: dismiss
          this.dismissAutocomplete();
        }
        break;
      }
      case 'deleteBackward':
      case 'deleteForward': {
        // Always re-trigger: check prefix and re-filter or dismiss
        const pos = this.state.selection.ranges[this.state.selection.primary]?.focus;
        if (pos) {
          const lineText = this.state.doc.lines[pos.line]?.text ?? '';
          const prefix = this.completionEngine.getWordPrefix(lineText, pos.column);
          if (prefix.length > 0) {
            this.scheduleAutocomplete(50, 'automatic');
          } else {
            this.dismissAutocomplete();
          }
        }
        break;
      }
      case 'newLine':
        this.dismissAutocomplete();
        break;
      case 'command':
        this.dismissAutocomplete();
        break;
    }
  }

  private scheduleAutocomplete(delay: number, triggerKind: 'invoke' | 'triggerCharacter' | 'automatic', triggerChar?: string): void {
    if (this.autocompleteDebounceTimer !== null) {
      clearTimeout(this.autocompleteDebounceTimer);
    }
    if (delay === 0) {
      this.triggerAutocomplete(triggerKind, triggerChar);
    } else {
      this.autocompleteDebounceTimer = setTimeout(() => {
        this.autocompleteDebounceTimer = null;
        this.triggerAutocomplete(triggerKind, triggerChar);
      }, delay);
    }
  }

  private triggerAutocomplete(triggerKind: 'invoke' | 'triggerCharacter' | 'automatic', triggerChar?: string): void {
    if (!this.autocompleteWidget) return;

    const pos = this.state.selection.ranges[this.state.selection.primary]?.focus;
    if (!pos) return;

    const lineText = this.state.doc.lines[pos.line]?.text ?? '';
    const wordPrefix = this.completionEngine.getWordPrefix(lineText, pos.column);

    const context: CompletionContext = {
      documentText: this.state.doc.lines.map(l => l.text).join('\n'),
      position: pos,
      lineText,
      wordPrefix,
      triggerKind,
      triggerCharacter: triggerChar,
      language: this.state.language,
      fileName: this.state.fileName,
    };

    this.lastCompletionContext = context;

    this.completionEngine.getCompletions(context).then((result) => {
      // Guard: context may have changed since we started
      if (this.lastCompletionContext !== context) return;

      this.lastCompletionResult = result;

      if (result.items.length === 0) {
        this.dismissAutocomplete();
        return;
      }

      // If the only remaining item matches the prefix exactly, dismiss
      // (user has finished typing the word)
      if (
        triggerKind === 'automatic' &&
        result.items.length === 1 &&
        wordPrefix === (result.items[0].insertText ?? result.items[0].label)
      ) {
        this.dismissAutocomplete();
        return;
      }

      this.autocompleteActive = true;
      const anchor = this.computeAutocompleteAnchor(pos.line, result.replaceStart);
      this.autocompleteWidget!.show(result.items, anchor);
      this.scheduleDocResolve();
    });
  }

  private computeAutocompleteAnchor(line: number, column: number): { top: number; left: number } {
    const contentEl = this.view?.getContentElement();
    if (!contentEl) return { top: 0, left: 0 };

    const lineEl = contentEl.children[line] as HTMLElement | undefined;
    if (!lineEl) return { top: 0, left: 0 };

    const lineRect = lineEl.getBoundingClientRect();
    const contentRect = contentEl.getBoundingClientRect();
    const top = lineRect.bottom - contentRect.top + contentEl.scrollTop;

    // Measure text width up to column (monospace)
    const lineText = this.state.doc.lines[line]?.text ?? '';
    const measure = document.createElement('span');
    measure.style.cssText = 'visibility:hidden;position:absolute;white-space:pre;font:inherit';
    measure.textContent = lineText.substring(0, column);
    lineEl.appendChild(measure);
    const left = measure.offsetWidth;
    measure.remove();

    return { top, left };
  }

  private acceptCompletion(item: CompletionItem): void {
    if (!this.lastCompletionResult) return;

    const pos = this.state.selection.ranges[this.state.selection.primary]?.focus;
    if (!pos) return;

    const result = this.lastCompletionResult;
    const text = item.insertText ?? item.label;
    const ops: Operation[] = [];

    // Delete the current prefix
    const prefixLen = result.replaceEnd - result.replaceStart;
    if (prefixLen > 0) {
      ops.push({
        type: 'deleteText',
        line: pos.line,
        column: result.replaceStart,
        length: prefixLen,
        origin: 'command' as OperationOrigin,
      });
    }

    // Insert the completion text
    ops.push({
      type: 'insertText',
      line: pos.line,
      column: result.replaceStart,
      text,
      origin: 'command' as OperationOrigin,
    });

    const newCol = result.replaceStart + text.length;
    const newSelection = createSelection([
      createCollapsedRange(createPosition(pos.line, newCol)),
    ]);

    this.applyTransaction({ ops, selection: newSelection, origin: 'command' });
    this.dismissAutocomplete();
  }

  private dismissAutocomplete(): void {
    if (this.autocompleteDebounceTimer !== null) {
      clearTimeout(this.autocompleteDebounceTimer);
      this.autocompleteDebounceTimer = null;
    }
    if (this.docResolveTimer !== null) {
      clearTimeout(this.docResolveTimer);
      this.docResolveTimer = null;
    }
    this.autocompleteActive = false;
    this.lastCompletionResult = null;
    this.lastCompletionContext = null;
    this.autocompleteWidget?.hide();
  }

  private scheduleDocResolve(): void {
    if (this.docResolveTimer !== null) {
      clearTimeout(this.docResolveTimer);
    }
    this.docResolveTimer = setTimeout(() => {
      this.docResolveTimer = null;
      const item = this.autocompleteWidget?.getSelectedItem();
      if (!item || !this.lastCompletionContext) return;

      // If already resolved, just show it
      if (item.detail || item.documentation) {
        this.autocompleteWidget?.updateDocs(item);
        return;
      }

      // Resolve via the TS completion provider
      if (this.tsCompletionProvider) {
        const ctx = this.lastCompletionContext;
        Promise.resolve(this.tsCompletionProvider.resolveItem(item, ctx)).then((resolved) => {
          // Guard: widget might have been dismissed
          if (!this.autocompleteActive) return;
          const current = this.autocompleteWidget?.getSelectedItem();
          if (current && current.label === item.label) {
            this.autocompleteWidget?.updateDocs(resolved);
          }
        });
      }
    }, 100);
  }

  private insertText(text: string): void {
    const sel = this.state.selection;
    const primary = sel.ranges[sel.primary];
    if (!primary) return;

    // Auto-close brackets and quotes (only for single-character input with collapsed selection)
    if (text.length === 1 && isCollapsed(primary)) {
      const bracketPairs: Record<string, string> = {
        '{': '}',
        '(': ')',
        '[': ']',
        '"': '"',
        "'": "'",
        '`': '`',
      };
      const closingChars = new Set([')', '}', ']', '"', "'", '`']);

      const pos = primary.focus;
      const currentLine = this.state.doc.lines[pos.line];
      const charAfterCursor = currentLine ? currentLine.text[pos.column] : undefined;
      const charBeforeCursor = currentLine && pos.column > 0 ? currentLine.text[pos.column - 1] : undefined;

      // Skip-over: if typing a closing character and it's already the next char, just move cursor forward
      if (closingChars.has(text) && charAfterCursor === text) {
        const newSelection = createSelection([
          createCollapsedRange(createPosition(pos.line, pos.column + 1)),
        ]);
        this.applyTransaction({ ops: [], selection: newSelection, origin: 'input' });
        return;
      }

      // Auto-close: insert pair and place cursor in between
      const closing = bracketPairs[text];
      if (closing !== undefined) {
        // For quotes, don't auto-close if preceded by a backslash
        const isQuote = text === '"' || text === "'" || text === '`';
        if (isQuote && charBeforeCursor === '\\') {
          // Fall through to normal insertion below
        } else {
          const ops: Operation[] = [
            {
              type: 'insertText',
              line: pos.line,
              column: pos.column,
              text: text + closing,
              origin: 'input' as OperationOrigin,
            },
          ];
          const newSelection = createSelection([
            createCollapsedRange(createPosition(pos.line, pos.column + 1)),
          ]);
          this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
          return;
        }
      }
    }

    // If there's a non-collapsed selection, delete it first
    if (!isCollapsed(primary)) {
      this.deleteSelectedText();
    }

    const pos = this.state.selection.ranges[this.state.selection.primary].focus;

    // Handle multi-line paste
    if (text.includes('\n')) {
      const lines = text.split('\n');
      const ops: Operation[] = [];
      let currentLine = pos.line;
      let currentCol = pos.column;

      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          ops.push({
            type: 'splitLine',
            line: currentLine,
            column: currentCol,
            origin: 'input' as OperationOrigin,
          });
          currentLine++;
          currentCol = 0;
        }
        if (lines[i].length > 0) {
          ops.push({
            type: 'insertText',
            line: currentLine,
            column: currentCol,
            text: lines[i],
            origin: 'input' as OperationOrigin,
          });
          currentCol += lines[i].length;
        }
      }

      const newSelection = createSelection([
        createCollapsedRange(createPosition(currentLine, currentCol)),
      ]);
      this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
      return;
    }

    const ops: Operation[] = [
      {
        type: 'insertText',
        line: pos.line,
        column: pos.column,
        text,
        origin: 'input' as OperationOrigin,
      },
    ];

    const newSelection = createSelection([
      createCollapsedRange(createPosition(pos.line, pos.column + text.length)),
    ]);

    this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
  }

  private deleteSelectedText(): void {
    const sel = this.state.selection;
    const primary = sel.ranges[sel.primary];
    if (!primary || isCollapsed(primary)) return;

    // Determine start and end positions
    const startBefore =
      primary.anchor.line < primary.focus.line ||
      (primary.anchor.line === primary.focus.line && primary.anchor.column < primary.focus.column);
    const start = startBefore ? primary.anchor : primary.focus;
    const end = startBefore ? primary.focus : primary.anchor;

    const ops: Operation[] = [];

    if (start.line === end.line) {
      // Single line selection
      ops.push({
        type: 'deleteText',
        line: start.line,
        column: start.column,
        length: end.column - start.column,
        origin: 'input' as OperationOrigin,
      });
    } else {
      // Multi-line: delete end of first line, delete middle lines, delete start of last line, merge
      // Simplest approach: replace the range
      // 1. Delete text after start on first line
      const firstLine = this.state.doc.lines[start.line];
      if (firstLine && start.column < firstLine.text.length) {
        ops.push({
          type: 'deleteText',
          line: start.line,
          column: start.column,
          length: firstLine.text.length - start.column,
          origin: 'input' as OperationOrigin,
        });
      }
      // 2. Delete text before end on last line
      if (end.column > 0) {
        ops.push({
          type: 'deleteText',
          line: end.line,
          column: 0,
          length: end.column,
          origin: 'input' as OperationOrigin,
        });
      }
      // 3. Delete middle lines (from end to start+1 to keep indices valid)
      for (let i = end.line - 1; i > start.line; i--) {
        ops.push({
          type: 'deleteLine',
          index: i,
          origin: 'input' as OperationOrigin,
        });
      }
      // 4. Merge the two remaining lines
      ops.push({
        type: 'mergeLine',
        line: start.line,
        origin: 'input' as OperationOrigin,
      });
    }

    const newSelection = createSelection([
      createCollapsedRange(createPosition(start.line, start.column)),
    ]);

    this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
  }

  private deleteBackward(): void {
    const sel = this.state.selection;
    const primary = sel.ranges[sel.primary];
    if (!primary) return;

    // If there's a selection, delete it
    if (!isCollapsed(primary)) {
      this.deleteSelectedText();
      return;
    }

    const pos = primary.focus;
    const ops: Operation[] = [];

    if (pos.column > 0) {
      ops.push({
        type: 'deleteText',
        line: pos.line,
        column: pos.column - 1,
        length: 1,
        origin: 'input' as OperationOrigin,
      });
      const newSelection = createSelection([
        createCollapsedRange(createPosition(pos.line, pos.column - 1)),
      ]);
      this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
    } else if (pos.line > 0) {
      const prevLine = this.state.doc.lines[pos.line - 1];
      const prevLen = prevLine ? prevLine.text.length : 0;
      ops.push({
        type: 'mergeLine',
        line: pos.line - 1,
        origin: 'input' as OperationOrigin,
      });
      const newSelection = createSelection([
        createCollapsedRange(createPosition(pos.line - 1, prevLen)),
      ]);
      this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
    }
  }

  private deleteForward(): void {
    const sel = this.state.selection;
    const primary = sel.ranges[sel.primary];
    if (!primary) return;

    if (!isCollapsed(primary)) {
      this.deleteSelectedText();
      return;
    }

    const pos = primary.focus;
    const currentLine = this.state.doc.lines[pos.line];
    if (!currentLine) return;

    const ops: Operation[] = [];

    if (pos.column < currentLine.text.length) {
      ops.push({
        type: 'deleteText',
        line: pos.line,
        column: pos.column,
        length: 1,
        origin: 'input' as OperationOrigin,
      });
      this.applyTransaction({
        ops,
        selection: this.state.selection,
        origin: 'input',
      });
    } else if (pos.line < this.state.doc.lines.length - 1) {
      ops.push({
        type: 'mergeLine',
        line: pos.line,
        origin: 'input' as OperationOrigin,
      });
      this.applyTransaction({
        ops,
        selection: this.state.selection,
        origin: 'input',
      });
    }
  }

  private insertNewLine(): void {
    const sel = this.state.selection;
    const primary = sel.ranges[sel.primary];
    if (!primary) return;

    // Delete selection first if non-collapsed
    if (!isCollapsed(primary)) {
      this.deleteSelectedText();
    }

    const pos = this.state.selection.ranges[this.state.selection.primary].focus;
    const currentLine = this.state.doc.lines[pos.line];
    const lineText = currentLine ? currentLine.text : '';

    // Compute leading whitespace of current line
    const indentMatch = lineText.match(/^(\s*)/);
    const currentIndent = indentMatch ? indentMatch[1] : '';
    const oneIndent = ' '.repeat(this.options.tabSize);

    // Check if the line (up to cursor) ends with an opening bracket or colon
    const textBeforeCursor = lineText.substring(0, pos.column);
    const trimmedBefore = textBeforeCursor.trimEnd();
    const lastChar = trimmedBefore.length > 0 ? trimmedBefore[trimmedBefore.length - 1] : '';
    const opensBlock = lastChar === '{' || lastChar === '(' || lastChar === '[' || lastChar === ':';

    // Check if cursor is between matching brackets: {|}, (|), [|]
    const charAfterCursor = pos.column < lineText.length ? lineText[pos.column] : '';
    const matchingPairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
    const isBetweenBrackets = opensBlock && lastChar !== ':' && matchingPairs[lastChar] === charAfterCursor;

    const ops: Operation[] = [];

    if (isBetweenBrackets) {
      // Insert two newlines: one with extra indent (cursor goes here), one with original indent (closing bracket)
      // Split at cursor position
      ops.push({
        type: 'splitLine',
        line: pos.line,
        column: pos.column,
        origin: 'input' as OperationOrigin,
      });
      // Insert indented content on the new middle line
      const newIndent = currentIndent + oneIndent;
      if (newIndent.length > 0) {
        ops.push({
          type: 'insertText',
          line: pos.line + 1,
          column: 0,
          text: newIndent,
          origin: 'input' as OperationOrigin,
        });
      }
      // Split again to create the closing bracket line
      ops.push({
        type: 'splitLine',
        line: pos.line + 1,
        column: newIndent.length,
        origin: 'input' as OperationOrigin,
      });
      // Insert original indent before the closing bracket
      if (currentIndent.length > 0) {
        ops.push({
          type: 'insertText',
          line: pos.line + 2,
          column: 0,
          text: currentIndent,
          origin: 'input' as OperationOrigin,
        });
      }

      const newSelection = createSelection([
        createCollapsedRange(createPosition(pos.line + 1, newIndent.length)),
      ]);
      this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
    } else {
      // Normal newline with auto-indent
      const newIndent = opensBlock ? currentIndent + oneIndent : currentIndent;

      ops.push({
        type: 'splitLine',
        line: pos.line,
        column: pos.column,
        origin: 'input' as OperationOrigin,
      });
      if (newIndent.length > 0) {
        ops.push({
          type: 'insertText',
          line: pos.line + 1,
          column: 0,
          text: newIndent,
          origin: 'input' as OperationOrigin,
        });
      }

      const newSelection = createSelection([
        createCollapsedRange(createPosition(pos.line + 1, newIndent.length)),
      ]);
      this.applyTransaction({ ops, selection: newSelection, origin: 'input' });
    }
  }

  private registerBuiltinCommands(): void {
    this.commandRegistry.register('undo', () => {
      const entry = this.historyManager.undo();
      if (entry) {
        this.historyManager.recordForRedo({
          doc: this.state.doc,
          selection: this.state.selection,
          timestamp: Date.now(),
        });
        this.state = new EditorState({
          doc: entry.doc,
          selection: entry.selection,
          language: this.state.language,
          fileName: this.state.fileName,
        });
        this.renderView();
        this.eventBus.emit('state:change', { state: this.state.snapshot });
      }
    });

    this.commandRegistry.register('redo', () => {
      const entry = this.historyManager.redo();
      if (entry) {
        this.historyManager.recordForUndo({
          doc: this.state.doc,
          selection: this.state.selection,
          timestamp: Date.now(),
        });
        this.state = new EditorState({
          doc: entry.doc,
          selection: entry.selection,
          language: this.state.language,
          fileName: this.state.fileName,
        });
        this.renderView();
        this.eventBus.emit('state:change', { state: this.state.snapshot });
      }
    });

    this.commandRegistry.register('selectAll', () => {
      const lastLine = this.state.doc.lines.length - 1;
      const lastCol = this.state.doc.lines[lastLine]?.text.length ?? 0;
      const selection = createSelection([
        createRange(createPosition(0, 0), createPosition(lastLine, lastCol)),
      ]);
      this.setSelection(selection);
    });

    this.commandRegistry.register('indent', () => {
      const sel = this.state.selection;
      const primary = sel.ranges[sel.primary];
      if (!primary) return;
      const spaces = ' '.repeat(this.options.tabSize);

      // Multi-line: indent each line in the selection
      if (!isCollapsed(primary) && primary.anchor.line !== primary.focus.line) {
        const startLine = Math.min(primary.anchor.line, primary.focus.line);
        const endLine = Math.max(primary.anchor.line, primary.focus.line);
        const ops: Operation[] = [];
        for (let i = startLine; i <= endLine; i++) {
          ops.push({
            type: 'insertText',
            line: i,
            column: 0,
            text: spaces,
            origin: 'command' as OperationOrigin,
          });
        }
        // Keep the selection spanning the same lines, adjusted for added indent
        const newSelection = createSelection([
          createRange(
            createPosition(startLine, 0),
            createPosition(endLine, this.state.doc.lines[endLine].text.length + spaces.length),
          ),
        ]);
        this.applyTransaction({ ops, selection: newSelection, origin: 'command' });
      } else {
        // Single cursor: insert spaces at cursor position
        this.insertText(spaces);
      }
    });

    this.commandRegistry.register('outdent', () => {
      const sel = this.state.selection;
      const primary = sel.ranges[sel.primary];
      if (!primary) return;

      const startLine = Math.min(primary.anchor.line, primary.focus.line);
      const endLine = isCollapsed(primary) ? startLine : Math.max(primary.anchor.line, primary.focus.line);

      const ops: Operation[] = [];
      for (let i = startLine; i <= endLine; i++) {
        const line = this.state.doc.lines[i];
        if (!line) continue;
        const match = line.text.match(/^( +)/);
        if (match) {
          const removeCount = Math.min(match[1].length, this.options.tabSize);
          if (removeCount > 0) {
            ops.push({
              type: 'deleteText',
              line: i,
              column: 0,
              length: removeCount,
              origin: 'command' as OperationOrigin,
            });
          }
        }
      }
      if (ops.length > 0) {
        this.applyTransaction({ ops, origin: 'command' });
      }
    });

    this.commandRegistry.register('toggleTheme', () => {
      this.toggleTheme();
    });

    this.commandRegistry.register('toggleSidebar', () => {
      this.sidebar?.toggle();
    });

    this.commandRegistry.register('copy', () => {
      const sel = this.state.selection;
      const primary = sel.ranges[sel.primary];
      if (!primary || isCollapsed(primary)) return;

      const doc = this.state.doc;
      const startBefore =
        primary.anchor.line < primary.focus.line ||
        (primary.anchor.line === primary.focus.line &&
          primary.anchor.column < primary.focus.column);
      const start = startBefore ? primary.anchor : primary.focus;
      const end = startBefore ? primary.focus : primary.anchor;

      let text = '';
      for (let i = start.line; i <= end.line; i++) {
        const line = doc.lines[i];
        if (!line) continue;
        const lineText = line.text;
        if (i === start.line && i === end.line) {
          text += lineText.substring(start.column, end.column);
        } else if (i === start.line) {
          text += lineText.substring(start.column) + '\n';
        } else if (i === end.line) {
          text += lineText.substring(0, end.column);
        } else {
          text += lineText + '\n';
        }
      }
      navigator.clipboard?.writeText(text);
    });

    this.commandRegistry.register('cut', () => {
      this.commandRegistry.execute('copy');
      this.deleteSelectedText();
    });

    this.commandRegistry.register('paste', () => {
      navigator.clipboard?.readText().then((text) => {
        if (text) this.insertText(text);
      });
    });

    this.commandRegistry.register('save', () => {});

    this.commandRegistry.register('find', () => {
      this.findReplace?.show('find');
    });

    this.commandRegistry.register('replace', () => {
      this.findReplace?.show('replace');
    });

    this.commandRegistry.register('duplicateLine', () => {
      const sel = this.state.selection;
      const primary = sel.ranges[sel.primary];
      if (!primary) return;

      const lineIdx = primary.focus.line;
      const line = this.state.doc.lines[lineIdx];
      if (!line) return;

      const ops: Operation[] = [
        {
          type: 'insertLine',
          index: lineIdx + 1,
          text: line.text,
          origin: 'command' as OperationOrigin,
        },
      ];

      const newSelection = createSelection([
        createCollapsedRange(
          createPosition(lineIdx + 1, primary.focus.column)
        ),
      ]);

      this.applyTransaction({ ops, selection: newSelection, origin: 'command' });
    });

    this.commandRegistry.register('toggleComment', () => {
      const sel = this.state.selection;
      const primary = sel.ranges[sel.primary];
      if (!primary) return;

      const lineIdx = primary.focus.line;
      const line = this.state.doc.lines[lineIdx];
      if (!line) return;

      const trimmed = line.text.trimStart();
      const indent = line.text.length - trimmed.length;
      const isCommented = trimmed.startsWith('// ');

      let ops: Operation[];
      if (isCommented) {
        ops = [
          {
            type: 'deleteText',
            line: lineIdx,
            column: indent,
            length: 3,
            origin: 'command' as OperationOrigin,
          },
        ];
      } else {
        ops = [
          {
            type: 'insertText',
            line: lineIdx,
            column: indent,
            text: '// ',
            origin: 'command' as OperationOrigin,
          },
        ];
      }

      this.applyTransaction({ ops, origin: 'command' });
    });
  }
}

// ========== Web Component ==========

export class NodiusEditorElement extends HTMLElement {
  private editor: NodiusEditor | null = null;

  static get observedAttributes(): string[] {
    return ['theme', 'language', 'readonly', 'font-size', 'tab-size'];
  }

  connectedCallback(): void {
    const value = this.textContent || '';
    this.textContent = '';

    this.editor = new NodiusEditor(this, {
      value,
      theme: (this.getAttribute('theme') as 'dark' | 'light') ?? 'dark',
      language: this.getAttribute('language') ?? 'auto',
      fileName: this.getAttribute('file-name') ?? 'untitled.ts',
      readOnly: this.hasAttribute('readonly'),
      fontSize: parseInt(this.getAttribute('font-size') || '14', 10),
      tabSize: parseInt(this.getAttribute('tab-size') || '2', 10),
      minimap: !this.hasAttribute('no-minimap'),
      lineNumbers: !this.hasAttribute('no-line-numbers'),
    });
  }

  disconnectedCallback(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  attributeChangedCallback(name: string, _old: string, value: string): void {
    if (!this.editor) return;
    switch (name) {
      case 'theme':
        this.editor.setTheme(value as 'dark' | 'light');
        break;
      case 'language':
        this.editor.setLanguage(value);
        break;
      case 'readonly':
        this.editor.setReadOnly(value !== null);
        break;
    }
  }

  getEditor(): NodiusEditor | null {
    return this.editor;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('nodius-editor')) {
  customElements.define('nodius-editor', NodiusEditorElement);
}
