import type { EditorDiagnostic } from '../language/types';

export class Gutter {
  private container: HTMLElement;
  private lineCount: number = 0;
  private diagnostics: Map<number, EditorDiagnostic[]> = new Map();
  private currentLine: number = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-gutter';
  }

  getElement(): HTMLElement {
    return this.container;
  }

  update(lineCount: number, currentLine: number, startLine: number = 0, endLine?: number): void {
    this.lineCount = lineCount;
    this.currentLine = currentLine;
    const end = endLine ?? lineCount;

    this.container.innerHTML = '';
    const width = String(lineCount).length;

    for (let i = startLine; i < end; i++) {
      const lineEl = document.createElement('div');
      lineEl.className = 'nc-gutter-line';
      if (i === currentLine) lineEl.classList.add('nc-gutter-line-active');

      const numSpan = document.createElement('span');
      numSpan.className = 'nc-gutter-number';
      numSpan.textContent = String(i + 1).padStart(width, ' ');
      lineEl.appendChild(numSpan);

      // Error indicator
      const diags = this.diagnostics.get(i);
      if (diags && diags.length > 0) {
        const indicator = document.createElement('span');
        indicator.className = 'nc-gutter-indicator';
        const hasError = diags.some(d => d.severity === 'error');
        indicator.classList.add(hasError ? 'nc-gutter-error' : 'nc-gutter-warning');
        lineEl.appendChild(indicator);
      }

      this.container.appendChild(lineEl);
    }
  }

  setDiagnostics(diagnostics: EditorDiagnostic[]): void {
    this.diagnostics.clear();
    for (const diag of diagnostics) {
      const line = diag.range.start.line;
      if (!this.diagnostics.has(line)) this.diagnostics.set(line, []);
      this.diagnostics.get(line)!.push(diag);
    }
  }

  setCurrentLine(line: number): void {
    this.currentLine = line;
    // Update active class
    const lines = this.container.children;
    for (let i = 0; i < lines.length; i++) {
      lines[i].classList.toggle('nc-gutter-line-active', i === line);
    }
  }
}
