/**
 * Line-based DOM reconciler.
 *
 * Provides both full reconciliation (for initial render / setValue)
 * and targeted updates (for single-keystroke edits).
 */
export class Reconciler {
  private container: HTMLElement | null = null;
  private lineElements: Map<string, HTMLElement> = new Map();

  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  // -----------------------------------------------------------------
  //  Full reconciliation (initial render, setValue, structural changes)
  // -----------------------------------------------------------------

  reconcile(lines: Array<{ id: string; html: string; lineNumber: number }>): void {
    if (!this.container) return;

    const newIds = new Set(lines.map(l => l.id));

    // Remove lines that no longer exist
    for (const [id, el] of this.lineElements) {
      if (!newIds.has(id)) {
        el.remove();
        this.lineElements.delete(id);
      }
    }

    // Add or update lines in order
    let prevEl: HTMLElement | null = null;
    for (const line of lines) {
      let el = this.lineElements.get(line.id);

      if (!el) {
        // Create new element
        el = document.createElement('div');
        el.className = 'nc-line';
        el.dataset.lineId = line.id;
        this.lineElements.set(line.id, el);
        el.innerHTML = line.html;
        el.dataset.lineNumber = String(line.lineNumber);

        // Insert in correct position
        if (prevEl && prevEl.nextSibling) {
          this.container.insertBefore(el, prevEl.nextSibling);
        } else if (!prevEl) {
          this.container.insertBefore(el, this.container.firstChild);
        } else {
          this.container.appendChild(el);
        }
      } else {
        // Update existing element if content changed
        if (el.innerHTML !== line.html) {
          el.innerHTML = line.html;
        }
        if (el.dataset.lineNumber !== String(line.lineNumber)) {
          el.dataset.lineNumber = String(line.lineNumber);
        }
        // Ensure correct order
        const expectedNext: ChildNode | null = prevEl ? prevEl.nextSibling : this.container.firstChild;
        if (el !== expectedNext) {
          if (prevEl && prevEl.nextSibling) {
            this.container.insertBefore(el, prevEl.nextSibling);
          } else if (!prevEl) {
            this.container.insertBefore(el, this.container.firstChild);
          } else {
            this.container.appendChild(el);
          }
        }
      }
      prevEl = el;
    }
  }

  // -----------------------------------------------------------------
  //  Targeted updates (for incremental edits — O(1) per changed line)
  // -----------------------------------------------------------------

  /** Update a single line's HTML. */
  updateLineHtml(lineId: string, html: string): void {
    const el = this.lineElements.get(lineId);
    if (el) {
      el.innerHTML = html;
    }
  }

  /** Insert a new line element after a given line (or at the start). */
  insertLine(afterLineId: string | null, data: { id: string; html: string; lineNumber: number }): void {
    if (!this.container) return;
    const el = document.createElement('div');
    el.className = 'nc-line';
    el.dataset.lineId = data.id;
    el.dataset.lineNumber = String(data.lineNumber);
    el.innerHTML = data.html;
    this.lineElements.set(data.id, el);

    if (afterLineId) {
      const afterEl = this.lineElements.get(afterLineId);
      if (afterEl && afterEl.nextSibling) {
        this.container.insertBefore(el, afterEl.nextSibling);
      } else if (afterEl) {
        this.container.appendChild(el);
      } else {
        this.container.appendChild(el);
      }
    } else {
      // Insert at start
      this.container.insertBefore(el, this.container.firstChild);
    }
  }

  /** Remove a line element. */
  removeLine(lineId: string): void {
    const el = this.lineElements.get(lineId);
    if (el) {
      el.remove();
      this.lineElements.delete(lineId);
    }
  }

  /** Update data-lineNumber attribute for a range of lines. */
  updateLineNumbers(lineIds: string[], startLineNumber: number): void {
    for (let i = 0; i < lineIds.length; i++) {
      const el = this.lineElements.get(lineIds[i]);
      if (el) {
        el.dataset.lineNumber = String(startLineNumber + i);
      }
    }
  }

  getLineElement(lineId: string): HTMLElement | undefined {
    return this.lineElements.get(lineId);
  }

  clear(): void {
    this.lineElements.clear();
    if (this.container) this.container.innerHTML = '';
  }
}
