import { describe, it, expect } from 'vitest';
import {
  createDocument,
  getText,
  getLineCount,
  getLine,
  cloneDocumentWithLines,
  createLine,
} from '../../src/core/document/Document';

describe('Document', () => {
  describe('createDocument', () => {
    it('creates a document with one empty line when called with no arguments', () => {
      const doc = createDocument();
      expect(doc.version).toBe(0);
      expect(doc.lines.length).toBe(1);
      expect(doc.lines[0].text).toBe('');
      expect(doc.id).toBeDefined();
    });

    it('creates a document with one empty line when called with an empty string', () => {
      const doc = createDocument('');
      expect(doc.lines.length).toBe(1);
      expect(doc.lines[0].text).toBe('');
    });

    it('creates correct lines from multi-line text', () => {
      const doc = createDocument('hello\nworld\nfoo');
      expect(doc.lines.length).toBe(3);
      expect(doc.lines[0].text).toBe('hello');
      expect(doc.lines[1].text).toBe('world');
      expect(doc.lines[2].text).toBe('foo');
    });

    it('creates correct lines from single-line text', () => {
      const doc = createDocument('single line');
      expect(doc.lines.length).toBe(1);
      expect(doc.lines[0].text).toBe('single line');
    });

    it('assigns unique ids to each line', () => {
      const doc = createDocument('a\nb\nc');
      const ids = doc.lines.map((l) => l.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('getText', () => {
    it('returns the original single-line text', () => {
      const doc = createDocument('hello world');
      expect(getText(doc)).toBe('hello world');
    });

    it('returns the original multi-line text', () => {
      const text = 'line one\nline two\nline three';
      const doc = createDocument(text);
      expect(getText(doc)).toBe(text);
    });

    it('returns an empty string for an empty document', () => {
      const doc = createDocument('');
      expect(getText(doc)).toBe('');
    });
  });

  describe('getLineCount', () => {
    it('returns 1 for an empty document', () => {
      const doc = createDocument('');
      expect(getLineCount(doc)).toBe(1);
    });

    it('returns correct count for multi-line document', () => {
      const doc = createDocument('a\nb\nc\nd');
      expect(getLineCount(doc)).toBe(4);
    });
  });

  describe('getLine', () => {
    it('returns the correct line by index', () => {
      const doc = createDocument('first\nsecond\nthird');
      const line = getLine(doc, 1);
      expect(line).toBeDefined();
      expect(line!.text).toBe('second');
    });

    it('returns undefined for an out-of-bounds index', () => {
      const doc = createDocument('only');
      expect(getLine(doc, 5)).toBeUndefined();
    });

    it('returns undefined for a negative index', () => {
      const doc = createDocument('only');
      expect(getLine(doc, -1)).toBeUndefined();
    });
  });

  describe('cloneDocumentWithLines', () => {
    it('returns a new document with incremented version', () => {
      const doc = createDocument('hello');
      const newLines = [createLine('goodbye')];
      const cloned = cloneDocumentWithLines(doc, newLines);

      expect(cloned.version).toBe(doc.version + 1);
      expect(cloned.id).toBe(doc.id);
      expect(cloned.lines.length).toBe(1);
      expect(cloned.lines[0].text).toBe('goodbye');
    });

    it('preserves the original document id', () => {
      const doc = createDocument('test');
      const cloned = cloneDocumentWithLines(doc, [createLine('new')]);
      expect(cloned.id).toBe(doc.id);
    });

    it('does not mutate the original document (immutability)', () => {
      const doc = createDocument('original\ntext');
      const originalVersion = doc.version;
      const originalLineCount = doc.lines.length;
      const originalText = getText(doc);

      cloneDocumentWithLines(doc, [createLine('completely different')]);

      expect(doc.version).toBe(originalVersion);
      expect(doc.lines.length).toBe(originalLineCount);
      expect(getText(doc)).toBe(originalText);
    });
  });

  describe('Edge cases', () => {
    it('createDocument with very long text (10000 chars)', () => {
      const longText = 'a'.repeat(10000);
      const doc = createDocument(longText);
      expect(doc.lines.length).toBe(1);
      expect(doc.lines[0].text.length).toBe(10000);
      expect(getText(doc)).toBe(longText);
    });

    it('createDocument with many lines (1000 lines)', () => {
      const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
      const text = lines.join('\n');
      const doc = createDocument(text);
      expect(getLineCount(doc)).toBe(1000);
      expect(doc.lines[0].text).toBe('line 0');
      expect(doc.lines[999].text).toBe('line 999');
      expect(getText(doc)).toBe(text);
    });

    it('createDocument with unicode text', () => {
      const unicodeText = 'Hello \u4e16\u754c \ud83c\udf0d \u00e9\u00e0\u00fc\u00f1 \u0410\u0411\u0412';
      const doc = createDocument(unicodeText);
      expect(doc.lines.length).toBe(1);
      expect(getText(doc)).toBe(unicodeText);
    });

    it('createDocument with empty lines in the middle', () => {
      const text = 'first\n\n\nmiddle\n\nlast';
      const doc = createDocument(text);
      expect(getLineCount(doc)).toBe(6);
      expect(doc.lines[0].text).toBe('first');
      expect(doc.lines[1].text).toBe('');
      expect(doc.lines[2].text).toBe('');
      expect(doc.lines[3].text).toBe('middle');
      expect(doc.lines[4].text).toBe('');
      expect(doc.lines[5].text).toBe('last');
    });

    it('getText roundtrip: createDocument(text) -> getText should equal original text for various inputs', () => {
      const inputs = [
        '',
        'single line',
        'two\nlines',
        '\n',
        '\n\n\n',
        'line1\nline2\nline3\n',
        'trailing newline\n',
        '\nleading newline',
        'mixed\n\ncontent\nwith\n\nempty lines',
        'tabs\tand\tspaces   mixed',
        'special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/',
      ];

      for (const input of inputs) {
        const doc = createDocument(input);
        expect(getText(doc)).toBe(input);
      }
    });
  });
});
