export class Sidebar {
  private container: HTMLElement;
  private contentEl: HTMLElement;
  private collapsed: boolean = false;
  private width: number = 220;
  private minWidth: number = 150;
  private maxWidth: number = 400;
  private resizing: boolean = false;
  private onToggle: ((collapsed: boolean) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-sidebar';
    this.container.style.width = `${this.width}px`;

    // Header with toggle button
    const header = document.createElement('div');
    header.className = 'nc-sidebar-header';

    const title = document.createElement('span');
    title.className = 'nc-sidebar-title';
    title.textContent = 'EXPLORER';
    header.appendChild(title);

    this.container.appendChild(header);

    // Content area
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'nc-sidebar-content';

    // Placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'nc-sidebar-placeholder';
    placeholder.textContent = 'No folder opened';
    this.contentEl.appendChild(placeholder);

    this.container.appendChild(this.contentEl);

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'nc-sidebar-resize';
    resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
    this.container.appendChild(resizeHandle);
  }

  getElement(): HTMLElement {
    return this.container;
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.container.classList.toggle('nc-sidebar-collapsed', this.collapsed);
    this.container.style.width = this.collapsed ? '0px' : `${this.width}px`;
    if (this.onToggle) this.onToggle(this.collapsed);
  }

  isCollapsed(): boolean {
    return this.collapsed;
  }

  setOnToggle(handler: (collapsed: boolean) => void): void {
    this.onToggle = handler;
  }

  setContent(element: HTMLElement): void {
    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(element);
  }

  private startResize(e: MouseEvent): void {
    if (this.collapsed) return;
    e.preventDefault();
    this.resizing = true;
    const startX = e.clientX;
    const startWidth = this.width;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.resizing) return;
      const dx = e.clientX - startX;
      this.width = Math.max(this.minWidth, Math.min(this.maxWidth, startWidth + dx));
      this.container.style.width = `${this.width}px`;
    };

    const onMouseUp = () => {
      this.resizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  destroy(): void {
    this.container.remove();
  }
}
