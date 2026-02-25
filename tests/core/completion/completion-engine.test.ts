import { describe, it, expect } from 'vitest';
import { CompletionEngine } from '../../../src/core/completion/CompletionEngine';
import type { CompletionItem, CompletionProvider, CompletionContext } from '../../../src/core/completion/types';

function makeContext(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    documentText: '',
    position: { line: 0, column: 0 },
    lineText: '',
    wordPrefix: '',
    triggerKind: 'invoke',
    language: 'typescript',
    fileName: 'test.ts',
    ...overrides,
  };
}

describe('CompletionEngine', () => {
  describe('registerProvider / registerSimpleCompletions', () => {
    it('registers a provider and returns an unsubscribe function', async () => {
      const engine = new CompletionEngine();
      const items: CompletionItem[] = [
        { label: 'foo', kind: 'function' },
        { label: 'bar', kind: 'variable' },
      ];
      const unsub = engine.registerSimpleCompletions(items);

      const result = await engine.getCompletions(makeContext());
      expect(result.items).toHaveLength(2);

      unsub();
      const result2 = await engine.getCompletions(makeContext());
      expect(result2.items).toHaveLength(0);
    });

    it('registers a custom provider', async () => {
      const engine = new CompletionEngine();
      const provider: CompletionProvider = {
        triggerCharacters: ['.'],
        provideCompletions() {
          return { items: [{ label: 'hello', kind: 'method' }] };
        },
      };
      engine.registerProvider(provider);

      const result = await engine.getCompletions(makeContext());
      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toBe('hello');
    });

    it('merges results from multiple providers', async () => {
      const engine = new CompletionEngine();
      engine.registerSimpleCompletions([{ label: 'aaa', kind: 'variable' }]);
      engine.registerSimpleCompletions([{ label: 'bbb', kind: 'function' }]);

      const result = await engine.getCompletions(makeContext());
      expect(result.items).toHaveLength(2);
    });
  });

  describe('getTriggerCharacters', () => {
    it('returns union of trigger characters from all providers', () => {
      const engine = new CompletionEngine();
      engine.registerProvider({
        triggerCharacters: ['.', ':'],
        provideCompletions() { return { items: [] }; },
      });
      engine.registerProvider({
        triggerCharacters: ['.', '<'],
        provideCompletions() { return { items: [] }; },
      });

      const chars = engine.getTriggerCharacters();
      expect(chars).toEqual(new Set(['.', ':', '<']));
    });

    it('returns empty set when no providers have trigger characters', () => {
      const engine = new CompletionEngine();
      engine.registerSimpleCompletions([{ label: 'x', kind: 'text' }]);
      expect(engine.getTriggerCharacters().size).toBe(0);
    });
  });

  describe('getWordPrefix', () => {
    it('extracts word before cursor', () => {
      const engine = new CompletionEngine();
      expect(engine.getWordPrefix('const foo = bar', 15)).toBe('bar');
      expect(engine.getWordPrefix('const foo = bar', 9)).toBe('foo');
      expect(engine.getWordPrefix('const foo = bar', 5)).toBe('const');
    });

    it('handles cursor at start of line', () => {
      const engine = new CompletionEngine();
      expect(engine.getWordPrefix('hello', 0)).toBe('');
    });

    it('handles cursor after a dot', () => {
      const engine = new CompletionEngine();
      expect(engine.getWordPrefix('window.', 7)).toBe('');
    });

    it('handles partial word after dot', () => {
      const engine = new CompletionEngine();
      expect(engine.getWordPrefix('window.loc', 10)).toBe('loc');
    });

    it('handles $ in identifiers', () => {
      const engine = new CompletionEngine();
      expect(engine.getWordPrefix('this.$em', 8)).toBe('$em');
    });
  });

  describe('filterAndSort', () => {
    const items: CompletionItem[] = [
      { label: 'forEach', kind: 'method' },
      { label: 'filter', kind: 'method' },
      { label: 'find', kind: 'method' },
      { label: 'fill', kind: 'method' },
      { label: 'flat', kind: 'method' },
      { label: 'from', kind: 'method' },
      { label: 'push', kind: 'method' },
      { label: 'pop', kind: 'method' },
    ];

    it('returns all items when prefix is empty', () => {
      const engine = new CompletionEngine();
      const result = engine.filterAndSort(items, '');
      expect(result).toHaveLength(items.length);
    });

    it('filters by prefix match', () => {
      const engine = new CompletionEngine();
      const result = engine.filterAndSort(items, 'fi');
      // Should match: filter, fill, find
      expect(result.length).toBeGreaterThanOrEqual(3);
      const labels = result.map(i => i.label);
      expect(labels).toContain('filter');
      expect(labels).toContain('fill');
      expect(labels).toContain('find');
    });

    it('filters using subsequence matching', () => {
      const engine = new CompletionEngine();
      const result = engine.filterAndSort(items, 'fE');
      // Should match forEach (f...E...) via case-insensitive subsequence
      const labels = result.map(i => i.label);
      expect(labels).toContain('forEach');
    });

    it('ranks exact prefix matches higher', () => {
      const engine = new CompletionEngine();
      const result = engine.filterAndSort(items, 'for');
      // forEach starts with 'for', should be first
      expect(result[0].label).toBe('forEach');
    });

    it('uses filterText when available', () => {
      const engine = new CompletionEngine();
      const custom: CompletionItem[] = [
        { label: 'Display Label', kind: 'function', filterText: 'myFunc' },
        { label: 'myFunc2', kind: 'function' },
      ];
      const result = engine.filterAndSort(custom, 'my');
      const labels = result.map(i => i.label);
      expect(labels).toContain('Display Label');
    });

    it('returns nothing for non-matching prefix', () => {
      const engine = new CompletionEngine();
      const result = engine.filterAndSort(items, 'xyz');
      expect(result).toHaveLength(0);
    });
  });

  describe('getCompletions', () => {
    it('computes replaceStart and replaceEnd from word prefix', async () => {
      const engine = new CompletionEngine();
      engine.registerSimpleCompletions([
        { label: 'console', kind: 'variable' },
        { label: 'const', kind: 'keyword' },
      ]);

      const result = await engine.getCompletions(makeContext({
        lineText: 'con',
        position: { line: 0, column: 3 },
        wordPrefix: 'con',
      }));

      expect(result.replaceStart).toBe(0);
      expect(result.replaceEnd).toBe(3);
      expect(result.items.length).toBe(2);
    });

    it('handles async providers', async () => {
      const engine = new CompletionEngine();
      const asyncProvider: CompletionProvider = {
        async provideCompletions() {
          return { items: [{ label: 'asyncResult', kind: 'function' }] };
        },
      };
      engine.registerProvider(asyncProvider);

      const result = await engine.getCompletions(makeContext());
      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toBe('asyncResult');
    });

    it('propagates isIncomplete flag', async () => {
      const engine = new CompletionEngine();
      engine.registerProvider({
        provideCompletions() {
          return { items: [{ label: 'a', kind: 'text' }], isIncomplete: true };
        },
      });

      const result = await engine.getCompletions(makeContext());
      expect(result.isIncomplete).toBe(true);
    });
  });
});
