export interface VisibleRange {
  startLine: number;
  endLine: number;
  offsetY: number;
}

export class ScrollManager {
  private container: HTMLElement | null = null;
  private lineHeight: number = 20;
  private totalLines: number = 0;
  private overscan: number = 10;
  private onVisibleRangeChange: ((range: VisibleRange) => void) | null = null;
  private boundOnScroll: () => void;
  private spacer: HTMLElement | null = null;

  constructor(lineHeight: number = 20, overscan: number = 10) {
    this.lineHeight = lineHeight;
    this.overscan = overscan;
    this.boundOnScroll = this.onScroll.bind(this);
  }

  attach(container: HTMLElement, onChange: (range: VisibleRange) => void): void {
    this.container = container;
    this.onVisibleRangeChange = onChange;
    container.addEventListener('scroll', this.boundOnScroll, { passive: true });

    // Create spacer for virtual height
    this.spacer = document.createElement('div');
    this.spacer.className = 'nc-scroll-spacer';
    this.spacer.style.position = 'absolute';
    this.spacer.style.top = '0';
    this.spacer.style.left = '0';
    this.spacer.style.width = '1px';
    this.spacer.style.pointerEvents = 'none';
  }

  detach(): void {
    if (this.container) {
      this.container.removeEventListener('scroll', this.boundOnScroll);
    }
    this.spacer?.remove();
    this.container = null;
    this.onVisibleRangeChange = null;
  }

  setTotalLines(count: number): void {
    this.totalLines = count;
    if (this.spacer) {
      this.spacer.style.height = `${count * this.lineHeight}px`;
    }
  }

  setLineHeight(height: number): void {
    this.lineHeight = height;
  }

  getVisibleRange(): VisibleRange {
    if (!this.container) return { startLine: 0, endLine: 0, offsetY: 0 };

    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    const startLine = Math.max(0, Math.floor(scrollTop / this.lineHeight) - this.overscan);
    const visibleLines = Math.ceil(viewportHeight / this.lineHeight);
    const endLine = Math.min(this.totalLines, startLine + visibleLines + this.overscan * 2);

    return {
      startLine,
      endLine,
      offsetY: startLine * this.lineHeight,
    };
  }

  scrollToLine(line: number): void {
    if (!this.container) return;
    const targetTop = line * this.lineHeight;
    const viewportHeight = this.container.clientHeight;

    if (targetTop < this.container.scrollTop) {
      this.container.scrollTop = targetTop;
    } else if (targetTop + this.lineHeight > this.container.scrollTop + viewportHeight) {
      this.container.scrollTop = targetTop - viewportHeight + this.lineHeight;
    }
  }

  getLineHeight(): number {
    return this.lineHeight;
  }

  getSpacer(): HTMLElement | null {
    return this.spacer;
  }

  private onScroll(): void {
    if (this.onVisibleRangeChange) {
      this.onVisibleRangeChange(this.getVisibleRange());
    }
  }
}
