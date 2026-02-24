import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '../../src/view/EditorView';
import { KeymapRegistry } from '../../src/core/keymap/KeymapRegistry';
import { createDocument } from '../../src/core/document/Document';
import { createSelection } from '../../src/core/selection/Selection';

describe('EditorView', () => {
  let container: HTMLElement;
  let keymapRegistry: KeymapRegistry;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    keymapRegistry = new KeymapRegistry();
    view = new EditorView(container, keymapRegistry);
  });

  afterEach(() => {
    try {
      view.destroy();
    } catch {
      // already destroyed
    }
    container.remove();
  });

  it('creates DOM structure with gutter and content areas', () => {
    const root = view.getRootElement();
    expect(root.className).toBe('nc-editor');
    expect(root.getAttribute('tabindex')).toBe('0');

    // Root should have gutter and content children
    const gutter = root.querySelector('.nc-gutter');
    const content = root.querySelector('.nc-content');
    expect(gutter).not.toBeNull();
    expect(content).not.toBeNull();
  });

  it('content area is contenteditable', () => {
    const content = view.getContentElement();
    expect(content.getAttribute('contenteditable')).toBe('true');
    expect(content.getAttribute('spellcheck')).toBe('false');
  });

  it('renders document lines', () => {
    const doc = createDocument('hello\nworld');
    const selection = createSelection();

    view.render(doc, selection);

    const content = view.getContentElement();
    const lineEls = content.querySelectorAll('.nc-line');
    expect(lineEls.length).toBe(2);

    // Lines should contain the text (rendered as plain tokens)
    expect(lineEls[0].textContent).toContain('hello');
    expect(lineEls[1].textContent).toContain('world');
  });

  it('updates on re-render with changed content', () => {
    const doc1 = createDocument('first');
    const selection = createSelection();
    view.render(doc1, selection);

    const content = view.getContentElement();
    let lineEls = content.querySelectorAll('.nc-line');
    expect(lineEls.length).toBe(1);
    expect(lineEls[0].textContent).toContain('first');

    const doc2 = createDocument('updated\ncontent');
    view.render(doc2, selection);

    lineEls = content.querySelectorAll('.nc-line');
    expect(lineEls.length).toBe(2);
    expect(lineEls[0].textContent).toContain('updated');
    expect(lineEls[1].textContent).toContain('content');
  });

  it('renders gutter with correct number of lines', () => {
    const doc = createDocument('line1\nline2\nline3');
    const selection = createSelection();

    view.render(doc, selection);

    const root = view.getRootElement();
    const gutterLines = root.querySelectorAll('.nc-gutter-line');
    expect(gutterLines.length).toBe(3);
  });

  it('sets parser for syntax highlighting', () => {
    const tokens = [
      { kind: 'keyword' as const, text: 'const', start: 0, end: 5, line: 0, column: 0 },
      { kind: 'whitespace' as const, text: ' ', start: 5, end: 6, line: 0, column: 5 },
      { kind: 'identifier' as const, text: 'x', start: 6, end: 7, line: 0, column: 6 },
    ];

    const mockParser = {
      language: { id: 'test', name: 'Test', extensions: ['.test'] },
      tokenize: () => tokens,
      parse: () => null,
      getDiagnostics: () => [],
    };

    view.setParser(mockParser);

    const doc = createDocument('const x');
    const selection = createSelection();
    view.render(doc, selection);

    const content = view.getContentElement();
    const keywordSpan = content.querySelector('.nc-token-keyword');
    expect(keywordSpan).not.toBeNull();
    expect(keywordSpan!.textContent).toBe('const');

    const identSpan = content.querySelector('.nc-token-identifier');
    expect(identSpan).not.toBeNull();
    expect(identSpan!.textContent).toBe('x');
  });

  it('clears token cache when parser is changed', () => {
    const mockParser1 = {
      language: { id: 'test1', name: 'Test1', extensions: ['.t1'] },
      tokenize: () => [
        { kind: 'keyword' as const, text: 'let', start: 0, end: 3, line: 0, column: 0 },
      ],
      parse: () => null,
      getDiagnostics: () => [],
    };

    view.setParser(mockParser1);

    const doc = createDocument('let');
    const selection = createSelection();
    view.render(doc, selection);

    const content = view.getContentElement();
    expect(content.querySelector('.nc-token-keyword')).not.toBeNull();

    // Setting parser to null should clear tokens and render as plain
    view.setParser(null);
    view.render(doc, selection);

    expect(content.querySelector('.nc-token-keyword')).toBeNull();
    expect(content.querySelector('.nc-token-plain')).not.toBeNull();
  });

  it('getRootElement returns the root', () => {
    const root = view.getRootElement();
    expect(root).toBeInstanceOf(HTMLElement);
    expect(root.className).toBe('nc-editor');
    expect(container.contains(root)).toBe(true);
  });

  it('getContentElement returns content div', () => {
    const content = view.getContentElement();
    expect(content).toBeInstanceOf(HTMLElement);
    expect(content.className).toBe('nc-content');
    expect(view.getRootElement().contains(content)).toBe(true);
  });

  it('destroy removes elements', () => {
    expect(container.querySelector('.nc-editor')).not.toBeNull();

    view.destroy();

    expect(container.querySelector('.nc-editor')).toBeNull();
  });

  it('renders single-line document', () => {
    const doc = createDocument('single line');
    const selection = createSelection();
    view.render(doc, selection);

    const content = view.getContentElement();
    const lineEls = content.querySelectorAll('.nc-line');
    expect(lineEls.length).toBe(1);
    expect(lineEls[0].textContent).toContain('single line');
  });

  it('renders empty document', () => {
    const doc = createDocument('');
    const selection = createSelection();
    view.render(doc, selection);

    const content = view.getContentElement();
    const lineEls = content.querySelectorAll('.nc-line');
    expect(lineEls.length).toBe(1);
  });

  it('root element is appended to container', () => {
    expect(container.children.length).toBeGreaterThanOrEqual(1);
    const root = view.getRootElement();
    expect(root.parentElement).toBe(container);
  });
});
