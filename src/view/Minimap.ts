export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private container: HTMLElement;
  private totalLines: number = 0;
  private visibleStartLine: number = 0;
  private visibleEndLine: number = 0;
  private onClick: ((line: number) => void) | null = null;
  private charWidth: number = 1.5;
  private lineHeight: number = 3;
  private visible: boolean = true;
  private boundHandleClick: (e: MouseEvent) => void;

  // Resolved CSS colors (canvas can't use CSS variables)
  private bgColor: string = '#1e1e1e';
  private fgColor: string = 'rgba(212,212,212,0.5)';
  private visibleColor: string = 'rgba(255,255,255,0.1)';

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'nc-minimap-canvas';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.boundHandleClick = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this.boundHandleClick);
  }

  getElement(): HTMLElement {
    return this.container;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  setOnClick(handler: (line: number) => void): void {
    this.onClick = handler;
  }

  /** Resolve CSS custom property colors from a parent element. */
  resolveColors(el: HTMLElement): void {
    const style = getComputedStyle(el);
    this.bgColor = style.getPropertyValue('--nc-minimap-bg').trim() || this.bgColor;
    this.fgColor = style.getPropertyValue('--nc-fg').trim() || this.fgColor;
    this.visibleColor = style.getPropertyValue('--nc-minimap-visible').trim() || this.visibleColor;
  }

  update(
    lines: Array<{ text: string; tokens?: Array<{ kind: string; start: number; end: number }> }>,
    visibleStart: number,
    visibleEnd: number,
  ): void {
    if (!this.visible || !this.ctx) return;
    this.totalLines = lines.length;
    this.visibleStartLine = visibleStart;
    this.visibleEndLine = visibleEnd;

    const width = 80;
    const height = Math.max(lines.length * this.lineHeight, this.container.clientHeight || 300);
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.ctx;

    // Clear with background
    ctx.clearRect(0, 0, width, height);

    // Draw lines as colored blocks
    ctx.fillStyle = this.fgColor;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < lines.length; i++) {
      const y = i * this.lineHeight;
      const text = lines[i].text;
      for (let j = 0; j < Math.min(text.length, 50); j++) {
        if (text[j] !== ' ' && text[j] !== '\t') {
          ctx.fillRect(j * this.charWidth, y, this.charWidth, this.lineHeight - 1);
        }
      }
    }

    // Draw visible region highlight
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.visibleColor;
    const highlightY = visibleStart * this.lineHeight;
    const highlightH = (visibleEnd - visibleStart) * this.lineHeight;
    ctx.fillRect(0, highlightY, width, highlightH);
    ctx.globalAlpha = 1;
  }

  private handleClick(e: MouseEvent): void {
    if (!this.onClick) return;
    const rect = this.canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const line = Math.floor(y / this.lineHeight);
    if (line >= 0 && line < this.totalLines) {
      this.onClick(line);
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('click', this.boundHandleClick);
    this.container.remove();
  }
}
