import type { CompletionItem, CompletionItemKind } from '../core/completion/types';

const KIND_ICONS: Record<CompletionItemKind, { letter: string; cssVar: string }> = {
  function:  { letter: 'f', cssVar: '--nc-keyword' },
  method:    { letter: 'M', cssVar: '--nc-keyword' },
  property:  { letter: 'P', cssVar: '--nc-identifier' },
  variable:  { letter: 'V', cssVar: '--nc-identifier' },
  class:     { letter: 'C', cssVar: '--nc-type' },
  interface: { letter: 'I', cssVar: '--nc-type' },
  keyword:   { letter: 'K', cssVar: '--nc-keyword' },
  snippet:   { letter: 'S', cssVar: '--nc-string' },
  constant:  { letter: 'c', cssVar: '--nc-number' },
  enum:      { letter: 'E', cssVar: '--nc-type' },
  module:    { letter: 'm', cssVar: '--nc-keyword' },
  type:      { letter: 'T', cssVar: '--nc-type' },
  field:     { letter: 'F', cssVar: '--nc-identifier' },
  value:     { letter: 'v', cssVar: '--nc-number' },
  text:      { letter: 't', cssVar: '--nc-fg' },
};

export class AutocompleteWidget {
  private container: HTMLElement;
  private listEl: HTMLElement;
  private docsEl: HTMLElement;
  private docsTypeEl: HTMLElement;
  private docsTextEl: HTMLElement;

  private items: CompletionItem[] = [];
  private selectedIndex: number = 0;

  onAccept: (item: CompletionItem) => void = () => {};
  onDismiss: () => void = () => {};
  onSelectionChange: () => void = () => {};

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-autocomplete';
    this.container.style.display = 'none';

    this.listEl = document.createElement('div');
    this.listEl.className = 'nc-autocomplete-list';
    this.container.appendChild(this.listEl);

    this.docsEl = document.createElement('div');
    this.docsEl.className = 'nc-autocomplete-docs';

    this.docsTypeEl = document.createElement('div');
    this.docsTypeEl.className = 'nc-autocomplete-docs-type';
    this.docsEl.appendChild(this.docsTypeEl);

    this.docsTextEl = document.createElement('div');
    this.docsTextEl.className = 'nc-autocomplete-docs-text';
    this.docsEl.appendChild(this.docsTextEl);

    this.container.appendChild(this.docsEl);

    // Prevent clicks from stealing editor focus
    this.container.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  getElement(): HTMLElement {
    return this.container;
  }

  show(items: CompletionItem[], anchor: { top: number; left: number }): void {
    this.items = items;
    this.selectedIndex = 0;
    this.renderList();
    this.updateDocsFromSelection();

    this.container.style.top = `${anchor.top}px`;
    this.container.style.left = `${anchor.left}px`;
    this.container.style.display = 'flex';

    this.clampPosition();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.items = [];
    this.selectedIndex = 0;
  }

  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  updateItems(items: CompletionItem[]): void {
    this.items = items;
    if (items.length === 0) {
      this.hide();
      return;
    }
    this.selectedIndex = Math.min(this.selectedIndex, items.length - 1);
    this.renderList();
    this.updateDocsFromSelection();
  }

  getSelectedItem(): CompletionItem | null {
    if (this.items.length === 0) return null;
    return this.items[this.selectedIndex] ?? null;
  }

  selectNext(): void {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    this.updateSelection();
    this.updateDocsFromSelection();
  }

  selectPrev(): void {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    this.updateSelection();
    this.updateDocsFromSelection();
  }

  updateDocs(item: CompletionItem): void {
    this.docsTypeEl.textContent = item.detail ?? '';
    this.docsTextEl.textContent = item.documentation ?? '';

    const hasDoc = item.detail || item.documentation;
    this.docsEl.style.display = hasDoc ? '' : 'none';
  }

  destroy(): void {
    this.container.remove();
    this.onAccept = () => {};
    this.onDismiss = () => {};
    this.onSelectionChange = () => {};
  }

  private renderList(): void {
    this.listEl.innerHTML = '';
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const el = document.createElement('div');
      el.className = 'nc-autocomplete-item';
      if (i === this.selectedIndex) {
        el.classList.add('nc-autocomplete-item-selected');
      }

      // Icon
      const iconEl = document.createElement('span');
      iconEl.className = 'nc-autocomplete-icon';
      const kindInfo = KIND_ICONS[item.kind] ?? KIND_ICONS.text;
      iconEl.textContent = kindInfo.letter;
      iconEl.style.color = `var(${kindInfo.cssVar})`;
      el.appendChild(iconEl);

      // Label
      const labelEl = document.createElement('span');
      labelEl.className = 'nc-autocomplete-label';
      labelEl.textContent = item.label;
      el.appendChild(labelEl);

      // Detail (kind label)
      if (item.detail) {
        const detailEl = document.createElement('span');
        detailEl.className = 'nc-autocomplete-detail';
        detailEl.textContent = item.detail;
        el.appendChild(detailEl);
      }

      el.addEventListener('click', () => {
        this.onAccept(item);
      });

      el.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.updateSelection();
        this.updateDocsFromSelection();
        this.onSelectionChange();
      });

      this.listEl.appendChild(el);
    }
  }

  private updateSelection(): void {
    const children = this.listEl.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      el.classList.toggle('nc-autocomplete-item-selected', i === this.selectedIndex);
    }

    // Scroll selected item into view
    const selectedEl = children[this.selectedIndex] as HTMLElement | undefined;
    if (selectedEl?.scrollIntoView) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  private updateDocsFromSelection(): void {
    const item = this.getSelectedItem();
    if (item) {
      this.updateDocs(item);
    }
  }

  private clampPosition(): void {
    const parent = this.container.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const rect = this.container.getBoundingClientRect();

    // Clamp vertically: if overflows bottom, show above
    if (rect.bottom > parentRect.bottom) {
      const currentTop = parseFloat(this.container.style.top);
      // Move up by widget height + ~line height
      const newTop = currentTop - rect.height - 20;
      if (newTop >= 0) {
        this.container.style.top = `${newTop}px`;
      }
    }

    // Clamp horizontally: if overflows right, shift left
    if (rect.right > parentRect.right) {
      const overflow = rect.right - parentRect.right;
      const currentLeft = parseFloat(this.container.style.left);
      this.container.style.left = `${Math.max(0, currentLeft - overflow)}px`;
    }

    // Hide docs panel if viewport is narrow
    if (parentRect.width < 500) {
      this.docsEl.style.display = 'none';
    }
  }
}
