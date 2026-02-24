export interface Tab {
  id: string;
  fileName: string;
  modified: boolean;
}

export class TabBar {
  private container: HTMLElement;
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;
  private onTabSelect: ((tabId: string) => void) | null = null;
  private onTabClose: ((tabId: string) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'nc-tabbar';
  }

  getElement(): HTMLElement {
    return this.container;
  }

  setOnTabSelect(handler: (tabId: string) => void): void {
    this.onTabSelect = handler;
  }

  setOnTabClose(handler: (tabId: string) => void): void {
    this.onTabClose = handler;
  }

  addTab(tab: Tab): void {
    this.tabs.push(tab);
    this.render();
  }

  removeTab(tabId: string): void {
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[0]?.id ?? null;
    }
    this.render();
  }

  setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.render();
  }

  updateTab(tabId: string, updates: Partial<Tab>): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      Object.assign(tab, updates);
      this.render();
    }
  }

  getTabs(): Tab[] {
    return [...this.tabs];
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  private render(): void {
    this.container.innerHTML = '';
    for (const tab of this.tabs) {
      const tabEl = document.createElement('div');
      tabEl.className = 'nc-tab';
      if (tab.id === this.activeTabId) tabEl.classList.add('nc-tab-active');

      const nameEl = document.createElement('span');
      nameEl.className = 'nc-tab-name';
      nameEl.textContent = tab.fileName + (tab.modified ? ' \u25cf' : '');
      tabEl.appendChild(nameEl);

      const closeBtn = document.createElement('span');
      closeBtn.className = 'nc-tab-close';
      closeBtn.textContent = '\u00d7';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onTabClose) this.onTabClose(tab.id);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        if (this.onTabSelect) this.onTabSelect(tab.id);
      });

      this.container.appendChild(tabEl);
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
