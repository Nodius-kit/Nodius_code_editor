import type { Position, Range as EditorRange, MultiSelection } from '../core/types';
import { createPosition, createRange, createSelection } from '../core/selection/Selection';

export class SelectionDOM {
  private contentEl: HTMLElement | null = null;

  setContentElement(el: HTMLElement): void {
    this.contentEl = el;
  }

  /** Capture current DOM selection and convert to model Position */
  capture(): MultiSelection | null {
    if (!this.contentEl) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const ranges: EditorRange[] = [];
    for (let i = 0; i < sel.rangeCount; i++) {
      const domRange = sel.getRangeAt(i);
      const anchor = this.domToPosition(sel.anchorNode, sel.anchorOffset);
      const focus = this.domToPosition(sel.focusNode, sel.focusOffset);
      if (anchor && focus) {
        ranges.push(createRange(anchor, focus));
      }
    }

    if (ranges.length === 0) return null;
    return createSelection(ranges);
  }

  /** Restore model selection to DOM */
  restore(selection: MultiSelection): void {
    if (!this.contentEl) return;
    const sel = window.getSelection();
    if (!sel) return;

    sel.removeAllRanges();
    const primary = selection.ranges[selection.primary];
    if (!primary) return;

    const anchorNode = this.positionToDom(primary.anchor);
    const focusNode = this.positionToDom(primary.focus);
    if (!anchorNode || !focusNode) return;

    try {
      sel.setBaseAndExtent(
        anchorNode.node, anchorNode.offset,
        focusNode.node, focusNode.offset
      );
    } catch {
      // DOM might be in inconsistent state during updates
    }
  }

  private domToPosition(node: Node | null, offset: number): Position | null {
    if (!node || !this.contentEl) return null;

    // Find the line element
    let lineEl: HTMLElement | null = null;
    let current: Node | null = node;
    while (current && current !== this.contentEl) {
      if (current instanceof HTMLElement && current.dataset.lineId) {
        lineEl = current;
        break;
      }
      current = current.parentNode;
    }

    if (!lineEl) return null;

    const lineNumber = parseInt(lineEl.dataset.lineNumber || '0', 10) - 1;

    // Calculate column offset within the line
    let column = 0;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
      if (textNode === node) {
        column += offset;
        break;
      }
      column += (textNode.textContent || '').length;
    }

    return createPosition(Math.max(0, lineNumber), column);
  }

  private positionToDom(pos: Position): { node: Node; offset: number } | null {
    if (!this.contentEl) return null;

    // Find line element by line number
    const lines = this.contentEl.querySelectorAll('.nc-line');
    const lineEl = lines[pos.line];
    if (!lineEl) return null;

    // Empty line (contains only <br>) - place cursor at the element itself
    if (pos.column === 0 && lineEl.childNodes.length === 1 && lineEl.firstChild?.nodeName === 'BR') {
      return { node: lineEl, offset: 0 };
    }

    // Walk text nodes to find the right offset
    let remaining = pos.column;
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    let textNode: Node | null;
    while ((textNode = walker.nextNode())) {
      const len = (textNode.textContent || '').length;
      if (remaining <= len) {
        return { node: textNode, offset: remaining };
      }
      remaining -= len;
    }

    // If past end, return end of last text node or the element itself
    if (lineEl.lastChild) {
      const last = lineEl.lastChild;
      if (last.nodeType === Node.TEXT_NODE) {
        return { node: last, offset: (last.textContent || '').length };
      }
      return { node: lineEl, offset: lineEl.childNodes.length };
    }
    return { node: lineEl, offset: 0 };
  }
}
