import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutocompleteWidget } from '../../src/view/AutocompleteWidget';
import type { CompletionItem } from '../../src/core/completion/types';

describe('AutocompleteWidget', () => {
  let widget: AutocompleteWidget;

  const items: CompletionItem[] = [
    { label: 'forEach', kind: 'method', detail: '(callback): void', documentation: 'Calls a function for each element.' },
    { label: 'filter', kind: 'method', detail: '(predicate): T[]', documentation: 'Returns filtered elements.' },
    { label: 'find', kind: 'method', detail: '(predicate): T | undefined' },
    { label: 'fill', kind: 'method' },
  ];

  beforeEach(() => {
    widget = new AutocompleteWidget();
    document.body.appendChild(widget.getElement());
  });

  describe('show / hide / isVisible', () => {
    it('starts hidden', () => {
      expect(widget.isVisible()).toBe(false);
    });

    it('becomes visible when shown with items', () => {
      widget.show(items, { top: 100, left: 50 });
      expect(widget.isVisible()).toBe(true);
    });

    it('hides when hide() is called', () => {
      widget.show(items, { top: 100, left: 50 });
      widget.hide();
      expect(widget.isVisible()).toBe(false);
    });

    it('renders the correct number of items', () => {
      widget.show(items, { top: 0, left: 0 });
      const listEl = widget.getElement().querySelector('.nc-autocomplete-list');
      expect(listEl?.children.length).toBe(4);
    });

    it('selects the first item by default', () => {
      widget.show(items, { top: 0, left: 0 });
      expect(widget.getSelectedItem()?.label).toBe('forEach');
    });
  });

  describe('navigation', () => {
    it('selectNext moves to the next item', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.selectNext();
      expect(widget.getSelectedItem()?.label).toBe('filter');
    });

    it('selectPrev wraps around to last item', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.selectPrev();
      expect(widget.getSelectedItem()?.label).toBe('fill');
    });

    it('selectNext wraps around to first item', () => {
      widget.show(items, { top: 0, left: 0 });
      for (let i = 0; i < items.length; i++) widget.selectNext();
      expect(widget.getSelectedItem()?.label).toBe('forEach');
    });

    it('updates selected class on navigation', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.selectNext();
      const listEl = widget.getElement().querySelector('.nc-autocomplete-list')!;
      const selectedEls = listEl.querySelectorAll('.nc-autocomplete-item-selected');
      expect(selectedEls.length).toBe(1);
      expect(selectedEls[0].querySelector('.nc-autocomplete-label')?.textContent).toBe('filter');
    });
  });

  describe('updateItems', () => {
    it('updates the list with new items', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.updateItems([items[0], items[1]]);
      const listEl = widget.getElement().querySelector('.nc-autocomplete-list');
      expect(listEl?.children.length).toBe(2);
    });

    it('hides when updated with empty items', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.updateItems([]);
      expect(widget.isVisible()).toBe(false);
    });

    it('clamps selection index when items shrink', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.selectNext();
      widget.selectNext();
      widget.selectNext(); // index = 3 (last)
      widget.updateItems([items[0], items[1]]); // shrink to 2
      expect(widget.getSelectedItem()?.label).toBe('filter');
    });
  });

  describe('onAccept callback', () => {
    it('fires onAccept when an item is clicked', () => {
      const handler = vi.fn();
      widget.onAccept = handler;
      widget.show(items, { top: 0, left: 0 });

      const firstItem = widget.getElement().querySelector('.nc-autocomplete-item') as HTMLElement;
      firstItem?.click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(items[0]);
    });
  });

  describe('updateDocs', () => {
    it('shows detail and documentation for an item with docs', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.updateDocs(items[0]);

      const docsEl = widget.getElement().querySelector('.nc-autocomplete-docs')!;
      const typeEl = docsEl.querySelector('.nc-autocomplete-docs-type')!;
      const textEl = docsEl.querySelector('.nc-autocomplete-docs-text')!;

      expect(typeEl.textContent).toBe('(callback): void');
      expect(textEl.textContent).toBe('Calls a function for each element.');
    });

    it('hides docs panel for item without docs', () => {
      widget.show(items, { top: 0, left: 0 });
      widget.updateDocs(items[3]); // 'fill' has no detail or documentation

      const docsEl = widget.getElement().querySelector('.nc-autocomplete-docs') as HTMLElement;
      expect(docsEl.style.display).toBe('none');
    });
  });

  describe('destroy', () => {
    it('removes the element from DOM', () => {
      document.body.appendChild(widget.getElement());
      widget.destroy();
      expect(document.body.contains(widget.getElement())).toBe(false);
    });
  });

  describe('kind icons', () => {
    it('renders correct icon letter for method kind', () => {
      widget.show([{ label: 'test', kind: 'method' }], { top: 0, left: 0 });
      const icon = widget.getElement().querySelector('.nc-autocomplete-icon');
      expect(icon?.textContent).toBe('M');
    });

    it('renders correct icon letter for variable kind', () => {
      widget.show([{ label: 'test', kind: 'variable' }], { top: 0, left: 0 });
      const icon = widget.getElement().querySelector('.nc-autocomplete-icon');
      expect(icon?.textContent).toBe('V');
    });

    it('renders correct icon letter for class kind', () => {
      widget.show([{ label: 'MyClass', kind: 'class' }], { top: 0, left: 0 });
      const icon = widget.getElement().querySelector('.nc-autocomplete-icon');
      expect(icon?.textContent).toBe('C');
    });
  });
});
