export type SearchOptions = {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
};

export type FindReplaceHandlers = {
  onSearch: (options: SearchOptions) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  onClose: () => void;
};

export class FindReplace {
  private container: HTMLElement;
  private findInput: HTMLInputElement;
  private replaceInput: HTMLInputElement;
  private matchCountEl: HTMLElement;
  private replaceRow: HTMLElement;

  private caseSensitiveBtn: HTMLElement;
  private wholeWordBtn: HTMLElement;
  private regexBtn: HTMLElement;
  private toggleReplaceBtn: HTMLElement;

  private caseSensitive: boolean = false;
  private wholeWord: boolean = false;
  private regexEnabled: boolean = false;
  private replaceVisible: boolean = false;

  private handlers: FindReplaceHandlers = {
    onSearch: () => {},
    onNavigate: () => {},
    onReplace: () => {},
    onReplaceAll: () => {},
    onClose: () => {},
  };

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-find-panel';
    this.container.style.display = 'none';

    // Toggle replace button
    this.toggleReplaceBtn = this.createButton('nc-find-btn nc-find-toggle-replace', '\u25B6', 'Toggle Replace');

    // Find input
    this.findInput = document.createElement('input');
    this.findInput.type = 'text';
    this.findInput.className = 'nc-find-input';
    this.findInput.placeholder = 'Find';
    this.findInput.spellcheck = false;

    // Option toggle buttons
    this.caseSensitiveBtn = this.createButton('nc-find-btn nc-find-option', 'Aa', 'Match Case');
    this.wholeWordBtn = this.createButton('nc-find-btn nc-find-option', 'Ab', 'Match Whole Word');
    this.regexBtn = this.createButton('nc-find-btn nc-find-option', '.*', 'Use Regular Expression');

    // Match count display
    this.matchCountEl = document.createElement('span');
    this.matchCountEl.className = 'nc-find-match-count';
    this.matchCountEl.textContent = 'No results';

    // Navigation & close buttons
    const prevBtn = this.createButton('nc-find-btn', '\u2191', 'Previous Match');
    const nextBtn = this.createButton('nc-find-btn', '\u2193', 'Next Match');
    const closeBtn = this.createButton('nc-find-btn nc-find-close', '\u00D7', 'Close');

    // Replace input
    this.replaceInput = document.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.className = 'nc-find-input';
    this.replaceInput.placeholder = 'Replace';
    this.replaceInput.spellcheck = false;

    // Replace action buttons
    const replaceBtn = this.createButton('nc-find-btn', '\u2192', 'Replace');
    const replaceAllBtn = this.createButton('nc-find-btn', '\u21C9', 'Replace All');

    // --- Build layout ---

    // Find row
    const findRow = document.createElement('div');
    findRow.className = 'nc-find-row';

    this.toggleReplaceBtn.classList.add('nc-find-toggle-replace');
    findRow.appendChild(this.toggleReplaceBtn);

    const findInputGroup = document.createElement('div');
    findInputGroup.className = 'nc-find-input-group';
    findInputGroup.appendChild(this.findInput);
    findInputGroup.appendChild(this.caseSensitiveBtn);
    findInputGroup.appendChild(this.wholeWordBtn);
    findInputGroup.appendChild(this.regexBtn);
    findRow.appendChild(findInputGroup);

    findRow.appendChild(this.matchCountEl);
    findRow.appendChild(prevBtn);
    findRow.appendChild(nextBtn);
    findRow.appendChild(closeBtn);

    // Replace row
    this.replaceRow = document.createElement('div');
    this.replaceRow.className = 'nc-find-row nc-find-replace-row';
    this.replaceRow.style.display = 'none';

    // Spacer to align under find input (same width as toggle button)
    const replaceSpacer = document.createElement('div');
    replaceSpacer.className = 'nc-find-replace-spacer';
    this.replaceRow.appendChild(replaceSpacer);

    const replaceInputGroup = document.createElement('div');
    replaceInputGroup.className = 'nc-find-input-group';
    replaceInputGroup.appendChild(this.replaceInput);
    this.replaceRow.appendChild(replaceInputGroup);

    this.replaceRow.appendChild(replaceBtn);
    this.replaceRow.appendChild(replaceAllBtn);

    this.container.appendChild(findRow);
    this.container.appendChild(this.replaceRow);

    // --- Wire up event listeners ---

    this.findInput.addEventListener('input', () => this.emitSearch());

    this.findInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handlers.onNavigate(e.shiftKey ? 'prev' : 'next');
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
        this.handlers.onClose();
      }
    });

    this.replaceInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handlers.onReplace(this.replaceInput.value);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
        this.handlers.onClose();
      }
    });

    this.caseSensitiveBtn.addEventListener('click', () => {
      this.caseSensitive = !this.caseSensitive;
      this.caseSensitiveBtn.classList.toggle('nc-find-option-active', this.caseSensitive);
      this.emitSearch();
    });

    this.wholeWordBtn.addEventListener('click', () => {
      this.wholeWord = !this.wholeWord;
      this.wholeWordBtn.classList.toggle('nc-find-option-active', this.wholeWord);
      this.emitSearch();
    });

    this.regexBtn.addEventListener('click', () => {
      this.regexEnabled = !this.regexEnabled;
      this.regexBtn.classList.toggle('nc-find-option-active', this.regexEnabled);
      this.emitSearch();
    });

    this.toggleReplaceBtn.addEventListener('click', () => {
      this.replaceVisible = !this.replaceVisible;
      this.replaceRow.style.display = this.replaceVisible ? 'flex' : 'none';
      this.toggleReplaceBtn.textContent = this.replaceVisible ? '\u25BC' : '\u25B6';
      if (this.replaceVisible) this.replaceInput.focus();
    });

    prevBtn.addEventListener('click', () => this.handlers.onNavigate('prev'));
    nextBtn.addEventListener('click', () => this.handlers.onNavigate('next'));
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.handlers.onClose();
    });

    replaceBtn.addEventListener('click', () => this.handlers.onReplace(this.replaceInput.value));
    replaceAllBtn.addEventListener('click', () => this.handlers.onReplaceAll(this.replaceInput.value));

    // Prevent clicks inside the panel from stealing editor focus
    this.container.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation();
    });
  }

  show(mode: 'find' | 'replace' = 'find'): void {
    this.container.style.display = 'flex';

    if (mode === 'replace') {
      this.replaceVisible = true;
      this.replaceRow.style.display = 'flex';
      this.toggleReplaceBtn.textContent = '\u25BC';
    }

    this.findInput.focus();
    this.findInput.select();
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  getElement(): HTMLElement {
    return this.container;
  }

  setSearchHandler(handler: (options: SearchOptions) => void): void {
    this.handlers.onSearch = handler;
  }

  setReplaceHandler(handler: { onReplace: (replacement: string) => void; onReplaceAll: (replacement: string) => void }): void {
    this.handlers.onReplace = handler.onReplace;
    this.handlers.onReplaceAll = handler.onReplaceAll;
  }

  setNavigateHandler(handler: (direction: 'next' | 'prev') => void): void {
    this.handlers.onNavigate = handler;
  }

  setCloseHandler(handler: () => void): void {
    this.handlers.onClose = handler;
  }

  updateMatchCount(current: number, total: number): void {
    if (total === 0) {
      this.matchCountEl.textContent = 'No results';
      this.matchCountEl.classList.add('nc-find-no-results');
    } else {
      this.matchCountEl.textContent = `${current} of ${total}`;
      this.matchCountEl.classList.remove('nc-find-no-results');
    }
  }

  getFindQuery(): string {
    return this.findInput.value;
  }

  getReplaceText(): string {
    return this.replaceInput.value;
  }

  setFindQuery(query: string): void {
    this.findInput.value = query;
  }

  destroy(): void {
    this.container.remove();
    this.handlers = {
      onSearch: () => {},
      onNavigate: () => {},
      onReplace: () => {},
      onReplaceAll: () => {},
      onClose: () => {},
    };
  }

  private createButton(className: string, text: string, title: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.title = title;
    btn.type = 'button';
    return btn;
  }

  private emitSearch(): void {
    this.handlers.onSearch({
      query: this.findInput.value,
      caseSensitive: this.caseSensitive,
      wholeWord: this.wholeWord,
      regex: this.regexEnabled,
    });
  }
}
