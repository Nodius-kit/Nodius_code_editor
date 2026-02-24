export class StatusBar {
  private container: HTMLElement;
  private lineColEl: HTMLElement;
  private languageEl: HTMLElement;
  private encodingEl: HTMLElement;
  private indentEl: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-statusbar';

    this.lineColEl = document.createElement('span');
    this.lineColEl.className = 'nc-statusbar-item';
    this.lineColEl.textContent = 'Ln 1, Col 1';

    this.languageEl = document.createElement('span');
    this.languageEl.className = 'nc-statusbar-item nc-statusbar-language';
    this.languageEl.textContent = 'Plain Text';

    this.encodingEl = document.createElement('span');
    this.encodingEl.className = 'nc-statusbar-item';
    this.encodingEl.textContent = 'UTF-8';

    this.indentEl = document.createElement('span');
    this.indentEl.className = 'nc-statusbar-item';
    this.indentEl.textContent = 'Spaces: 2';

    this.container.appendChild(this.lineColEl);
    this.container.appendChild(this.indentEl);
    this.container.appendChild(this.encodingEl);
    this.container.appendChild(this.languageEl);
  }

  getElement(): HTMLElement {
    return this.container;
  }

  updatePosition(line: number, column: number): void {
    this.lineColEl.textContent = `Ln ${line + 1}, Col ${column + 1}`;
  }

  updateLanguage(language: string): void {
    this.languageEl.textContent = language;
  }

  updateEncoding(encoding: string): void {
    this.encodingEl.textContent = encoding;
  }

  updateIndent(type: 'spaces' | 'tabs', size: number): void {
    this.indentEl.textContent = type === 'spaces' ? `Spaces: ${size}` : `Tab Size: ${size}`;
  }

  destroy(): void {
    this.container.remove();
  }
}
