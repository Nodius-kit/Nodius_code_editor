import { describe, it, expect, beforeEach } from 'vitest';
import { Reconciler } from '../../src/view/Reconciler';

describe('Reconciler', () => {
  let reconciler: Reconciler;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    reconciler = new Reconciler();
    reconciler.setContainer(container);
  });

  it('creates new line elements for new data', () => {
    reconciler.reconcile([
      { id: 'a', html: '<span>hello</span>', lineNumber: 1 },
      { id: 'b', html: '<span>world</span>', lineNumber: 2 },
    ]);

    expect(container.children.length).toBe(2);

    const first = container.children[0] as HTMLElement;
    const second = container.children[1] as HTMLElement;

    expect(first.className).toBe('nc-line');
    expect(first.dataset.lineId).toBe('a');
    expect(first.innerHTML).toBe('<span>hello</span>');
    expect(first.dataset.lineNumber).toBe('1');

    expect(second.dataset.lineId).toBe('b');
    expect(second.innerHTML).toBe('<span>world</span>');
    expect(second.dataset.lineNumber).toBe('2');
  });

  it('updates innerHTML when content changes', () => {
    reconciler.reconcile([
      { id: 'a', html: '<span>old</span>', lineNumber: 1 },
    ]);

    expect(container.children[0].innerHTML).toBe('<span>old</span>');

    reconciler.reconcile([
      { id: 'a', html: '<span>new</span>', lineNumber: 1 },
    ]);

    expect(container.children.length).toBe(1);
    expect(container.children[0].innerHTML).toBe('<span>new</span>');
  });

  it('removes elements for deleted lines', () => {
    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
      { id: 'b', html: 'B', lineNumber: 2 },
      { id: 'c', html: 'C', lineNumber: 3 },
    ]);

    expect(container.children.length).toBe(3);

    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
      { id: 'c', html: 'C', lineNumber: 2 },
    ]);

    expect(container.children.length).toBe(2);
    expect((container.children[0] as HTMLElement).dataset.lineId).toBe('a');
    expect((container.children[1] as HTMLElement).dataset.lineId).toBe('c');
  });

  it('preserves elements with unchanged content (same DOM node)', () => {
    reconciler.reconcile([
      { id: 'a', html: '<span>stable</span>', lineNumber: 1 },
    ]);

    const originalNode = container.children[0];

    reconciler.reconcile([
      { id: 'a', html: '<span>stable</span>', lineNumber: 1 },
    ]);

    // The same DOM node should be reused, not recreated
    expect(container.children[0]).toBe(originalNode);
  });

  it('handles reordering of lines', () => {
    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
      { id: 'b', html: 'B', lineNumber: 2 },
      { id: 'c', html: 'C', lineNumber: 3 },
    ]);

    const elA = reconciler.getLineElement('a');
    const elB = reconciler.getLineElement('b');
    const elC = reconciler.getLineElement('c');

    // Reverse the order
    reconciler.reconcile([
      { id: 'c', html: 'C', lineNumber: 1 },
      { id: 'b', html: 'B', lineNumber: 2 },
      { id: 'a', html: 'A', lineNumber: 3 },
    ]);

    expect(container.children.length).toBe(3);
    expect(container.children[0]).toBe(elC);
    expect(container.children[1]).toBe(elB);
    expect(container.children[2]).toBe(elA);
  });

  it('clear() removes all elements', () => {
    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
      { id: 'b', html: 'B', lineNumber: 2 },
    ]);

    expect(container.children.length).toBe(2);

    reconciler.clear();

    expect(container.children.length).toBe(0);
    expect(container.innerHTML).toBe('');
    expect(reconciler.getLineElement('a')).toBeUndefined();
    expect(reconciler.getLineElement('b')).toBeUndefined();
  });

  it('works with an empty array', () => {
    reconciler.reconcile([]);
    expect(container.children.length).toBe(0);
  });

  it('transitions from populated to empty array', () => {
    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
      { id: 'b', html: 'B', lineNumber: 2 },
    ]);

    expect(container.children.length).toBe(2);

    reconciler.reconcile([]);

    expect(container.children.length).toBe(0);
  });

  it('updates lineNumber data attribute when it changes', () => {
    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
      { id: 'b', html: 'B', lineNumber: 2 },
    ]);

    expect((container.children[0] as HTMLElement).dataset.lineNumber).toBe('1');
    expect((container.children[1] as HTMLElement).dataset.lineNumber).toBe('2');

    // After removing the first line, b becomes line 1
    reconciler.reconcile([
      { id: 'b', html: 'B', lineNumber: 1 },
    ]);

    expect(container.children.length).toBe(1);
    expect((container.children[0] as HTMLElement).dataset.lineNumber).toBe('1');
  });

  it('getLineElement returns the correct element by id', () => {
    reconciler.reconcile([
      { id: 'x', html: 'X', lineNumber: 1 },
      { id: 'y', html: 'Y', lineNumber: 2 },
    ]);

    const elX = reconciler.getLineElement('x');
    const elY = reconciler.getLineElement('y');

    expect(elX).toBeDefined();
    expect(elX!.dataset.lineId).toBe('x');
    expect(elY).toBeDefined();
    expect(elY!.dataset.lineId).toBe('y');
  });

  it('getLineElement returns undefined for unknown id', () => {
    reconciler.reconcile([
      { id: 'a', html: 'A', lineNumber: 1 },
    ]);

    expect(reconciler.getLineElement('nonexistent')).toBeUndefined();
  });

  it('does nothing when no container is set', () => {
    const orphan = new Reconciler();
    // Should not throw
    orphan.reconcile([{ id: 'a', html: 'A', lineNumber: 1 }]);
    expect(orphan.getLineElement('a')).toBeUndefined();
  });

  describe('Edge cases', () => {
    it('reconcile 100 lines', () => {
      const lines = Array.from({ length: 100 }, (_, i) => ({
        id: `line-${i}`,
        html: `<span>Line ${i}</span>`,
        lineNumber: i + 1,
      }));

      reconciler.reconcile(lines);

      expect(container.children.length).toBe(100);
      for (let i = 0; i < 100; i++) {
        const el = container.children[i] as HTMLElement;
        expect(el.dataset.lineId).toBe(`line-${i}`);
        expect(el.innerHTML).toBe(`<span>Line ${i}</span>`);
        expect(el.dataset.lineNumber).toBe(String(i + 1));
      }
    });

    it('reconcile then immediately reconcile with all different content', () => {
      const lines1 = Array.from({ length: 5 }, (_, i) => ({
        id: `a-${i}`,
        html: `<span>A${i}</span>`,
        lineNumber: i + 1,
      }));

      reconciler.reconcile(lines1);
      expect(container.children.length).toBe(5);

      // Completely different set of lines
      const lines2 = Array.from({ length: 3 }, (_, i) => ({
        id: `b-${i}`,
        html: `<span>B${i}</span>`,
        lineNumber: i + 1,
      }));

      reconciler.reconcile(lines2);
      expect(container.children.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const el = container.children[i] as HTMLElement;
        expect(el.dataset.lineId).toBe(`b-${i}`);
        expect(el.innerHTML).toBe(`<span>B${i}</span>`);
      }

      // Old elements should be gone
      expect(reconciler.getLineElement('a-0')).toBeUndefined();
      expect(reconciler.getLineElement('a-4')).toBeUndefined();
    });

    it('reconcile with same data twice (DOM should not change)', () => {
      const lines = [
        { id: 'x', html: '<span>X</span>', lineNumber: 1 },
        { id: 'y', html: '<span>Y</span>', lineNumber: 2 },
      ];

      reconciler.reconcile(lines);
      const node1 = container.children[0];
      const node2 = container.children[1];

      // Reconcile with same data again
      reconciler.reconcile(lines);

      // Same DOM nodes should be reused
      expect(container.children[0]).toBe(node1);
      expect(container.children[1]).toBe(node2);
      expect(container.children.length).toBe(2);
    });

    it('reconcile with lines whose ids contain special characters', () => {
      const lines = [
        { id: 'line-with-spaces and stuff', html: 'A', lineNumber: 1 },
        { id: 'line<with>html', html: 'B', lineNumber: 2 },
        { id: 'line"with"quotes', html: 'C', lineNumber: 3 },
        { id: "line'with'single", html: 'D', lineNumber: 4 },
        { id: 'line&with&ampersands', html: 'E', lineNumber: 5 },
      ];

      reconciler.reconcile(lines);

      expect(container.children.length).toBe(5);
      expect((container.children[0] as HTMLElement).dataset.lineId).toBe('line-with-spaces and stuff');
      expect((container.children[1] as HTMLElement).dataset.lineId).toBe('line<with>html');
      expect((container.children[2] as HTMLElement).dataset.lineId).toBe('line"with"quotes');
      expect((container.children[3] as HTMLElement).dataset.lineId).toBe("line'with'single");
      expect((container.children[4] as HTMLElement).dataset.lineId).toBe('line&with&ampersands');
    });

    it('reconcile with HTML content that needs escaping in the html field', () => {
      const lines = [
        { id: 'esc1', html: '&lt;script&gt;alert("xss")&lt;/script&gt;', lineNumber: 1 },
        { id: 'esc2', html: '<b>bold &amp; italic</b>', lineNumber: 2 },
        { id: 'esc3', html: 'text with &amp; ampersand and &lt;tag&gt;', lineNumber: 3 },
      ];

      reconciler.reconcile(lines);

      expect(container.children.length).toBe(3);
      // Entities like &lt; and &gt; are preserved in innerHTML as they represent text content
      expect((container.children[0] as HTMLElement).innerHTML).toBe(
        '&lt;script&gt;alert("xss")&lt;/script&gt;'
      );
      // <b> is real HTML, &amp; is an entity that stays as &amp; in innerHTML
      expect((container.children[1] as HTMLElement).innerHTML).toBe(
        '<b>bold &amp; italic</b>'
      );
      // &amp; stays as &amp;, &lt;/&gt; stay as &lt;/&gt; in innerHTML
      expect((container.children[2] as HTMLElement).innerHTML).toBe(
        'text with &amp; ampersand and &lt;tag&gt;'
      );
    });
  });
});
