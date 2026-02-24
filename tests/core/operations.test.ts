import { describe, it, expect } from 'vitest';
import {
  applyOperation,
  applyOperations,
} from '../../src/core/operations/OperationEngine';
import { createDocument, getText, getLineCount, getLine } from '../../src/core/document/Document';
import { createOp } from '../../src/core/operations/Operation';
import type {
  InsertTextOp,
  DeleteTextOp,
  InsertLineOp,
  DeleteLineOp,
  SplitLineOp,
  MergeLineOp,
  ReplaceLineOp,
  Operation,
} from '../../src/core/types';

describe('OperationEngine', () => {
  describe('insertText', () => {
    it('inserts text at the correct position', () => {
      const doc = createDocument('hello world');
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 5,
        text: ' beautiful',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello beautiful world');
    });

    it('inserts text at the beginning of a line', () => {
      const doc = createDocument('world');
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 0,
        text: 'hello ',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello world');
    });

    it('inserts text at the end of a line', () => {
      const doc = createDocument('hello');
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 5,
        text: ' world',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello world');
    });

    it('increments the document version', () => {
      const doc = createDocument('test');
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 0,
        text: 'a',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result.version).toBe(doc.version + 1);
    });
  });

  describe('deleteText', () => {
    it('removes the correct characters', () => {
      const doc = createDocument('hello world');
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 5,
        length: 6,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello');
    });

    it('removes characters from the beginning', () => {
      const doc = createDocument('hello world');
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 0,
        length: 6,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('world');
    });

    it('removes characters from the end', () => {
      const doc = createDocument('hello world');
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 5,
        length: 6,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello');
    });
  });

  describe('insertLine', () => {
    it('adds a line at the given index', () => {
      const doc = createDocument('first\nthird');
      const op: InsertLineOp = {
        type: 'insertLine',
        index: 1,
        text: 'second',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(3);
      expect(getLine(result, 0)!.text).toBe('first');
      expect(getLine(result, 1)!.text).toBe('second');
      expect(getLine(result, 2)!.text).toBe('third');
    });

    it('adds a line at the beginning', () => {
      const doc = createDocument('second');
      const op: InsertLineOp = {
        type: 'insertLine',
        index: 0,
        text: 'first',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('first');
      expect(getLine(result, 1)!.text).toBe('second');
    });

    it('adds a line at the end', () => {
      const doc = createDocument('first');
      const op: InsertLineOp = {
        type: 'insertLine',
        index: 1,
        text: 'second',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 1)!.text).toBe('second');
    });
  });

  describe('deleteLine', () => {
    it('removes the line at the given index', () => {
      const doc = createDocument('first\nsecond\nthird');
      const op: DeleteLineOp = {
        type: 'deleteLine',
        index: 1,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('first');
      expect(getLine(result, 1)!.text).toBe('third');
    });

    it('removes the first line', () => {
      const doc = createDocument('first\nsecond');
      const op: DeleteLineOp = {
        type: 'deleteLine',
        index: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(1);
      expect(getLine(result, 0)!.text).toBe('second');
    });

    it('removes the last line', () => {
      const doc = createDocument('first\nsecond');
      const op: DeleteLineOp = {
        type: 'deleteLine',
        index: 1,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(1);
      expect(getLine(result, 0)!.text).toBe('first');
    });
  });

  describe('splitLine', () => {
    it('splits a line at the correct column', () => {
      const doc = createDocument('hello world');
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 5,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('hello');
      expect(getLine(result, 1)!.text).toBe(' world');
    });

    it('splits at the beginning of a line', () => {
      const doc = createDocument('hello');
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('');
      expect(getLine(result, 1)!.text).toBe('hello');
    });

    it('splits at the end of a line', () => {
      const doc = createDocument('hello');
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 5,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('hello');
      expect(getLine(result, 1)!.text).toBe('');
    });
  });

  describe('mergeLine', () => {
    it('merges a line with the next line', () => {
      const doc = createDocument('hello\n world');
      const op: MergeLineOp = {
        type: 'mergeLine',
        line: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(1);
      expect(getLine(result, 0)!.text).toBe('hello world');
    });

    it('merges with an empty next line', () => {
      const doc = createDocument('hello\n');
      const op: MergeLineOp = {
        type: 'mergeLine',
        line: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(1);
      expect(getLine(result, 0)!.text).toBe('hello');
    });

    it('returns doc unchanged when merging the last line (no next line)', () => {
      const doc = createDocument('only line');
      const op: MergeLineOp = {
        type: 'mergeLine',
        line: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });
  });

  describe('replaceLine', () => {
    it('replaces the text of the line at the given index', () => {
      const doc = createDocument('old text\nsecond line');
      const op: ReplaceLineOp = {
        type: 'replaceLine',
        index: 0,
        text: 'new text',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLine(result, 0)!.text).toBe('new text');
      expect(getLine(result, 1)!.text).toBe('second line');
    });

    it('preserves the line id when replacing', () => {
      const doc = createDocument('old text');
      const originalId = doc.lines[0].id;
      const op: ReplaceLineOp = {
        type: 'replaceLine',
        index: 0,
        text: 'new text',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result.lines[0].id).toBe(originalId);
    });
  });

  describe('out of bounds operations', () => {
    it('insertText returns doc unchanged for negative line', () => {
      const doc = createDocument('hello');
      const op: InsertTextOp = {
        type: 'insertText',
        line: -1,
        column: 0,
        text: 'x',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('insertText returns doc unchanged for line beyond last', () => {
      const doc = createDocument('hello');
      const op: InsertTextOp = {
        type: 'insertText',
        line: 5,
        column: 0,
        text: 'x',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('deleteText returns doc unchanged for out-of-bounds line', () => {
      const doc = createDocument('hello');
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 10,
        column: 0,
        length: 1,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('insertLine returns doc unchanged for negative index', () => {
      const doc = createDocument('hello');
      const op: InsertLineOp = {
        type: 'insertLine',
        index: -1,
        text: 'x',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('insertLine returns doc unchanged for index beyond length', () => {
      const doc = createDocument('hello');
      const op: InsertLineOp = {
        type: 'insertLine',
        index: 100,
        text: 'x',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('deleteLine returns doc unchanged for out-of-bounds index', () => {
      const doc = createDocument('hello');
      const op: DeleteLineOp = {
        type: 'deleteLine',
        index: 5,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('splitLine returns doc unchanged for out-of-bounds line', () => {
      const doc = createDocument('hello');
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 10,
        column: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('replaceLine returns doc unchanged for out-of-bounds index', () => {
      const doc = createDocument('hello');
      const op: ReplaceLineOp = {
        type: 'replaceLine',
        index: 10,
        text: 'x',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });
  });

  describe('applyOperations', () => {
    it('chains multiple operations', () => {
      const doc = createDocument('hello');
      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 5, text: ' world', origin: 'input' },
        { type: 'splitLine', line: 0, column: 5, origin: 'input' },
      ];
      const result = applyOperations(doc, ops);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('hello');
      expect(getLine(result, 1)!.text).toBe(' world');
    });

    it('returns the same doc when given no operations', () => {
      const doc = createDocument('hello');
      const result = applyOperations(doc, []);
      expect(result).toBe(doc);
    });

    it('applies insert then delete correctly', () => {
      const doc = createDocument('abc');
      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 3, text: 'def', origin: 'input' },
        { type: 'deleteText', line: 0, column: 0, length: 3, origin: 'input' },
      ];
      const result = applyOperations(doc, ops);
      expect(getText(result)).toBe('def');
    });
  });

  describe('Edge cases & stress', () => {
    it('insertText with empty string is a no-op (text unchanged)', () => {
      const doc = createDocument('hello');
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 3,
        text: '',
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello');
    });

    it('deleteText with length 0 is a no-op (text unchanged)', () => {
      const doc = createDocument('hello');
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 2,
        length: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getText(result)).toBe('hello');
    });

    it('deleteText that exceeds line length clamps to actual length', () => {
      const doc = createDocument('hi');
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 0,
        length: 100,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      // slice(0, 0) + slice(0 + 100) = '' + '' = ''
      expect(getText(result)).toBe('');
    });

    it('splitLine at column 0 creates empty line before', () => {
      const doc = createDocument('hello');
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 0,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('');
      expect(getLine(result, 1)!.text).toBe('hello');
    });

    it('splitLine at end of line creates empty line after', () => {
      const doc = createDocument('hello');
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 5,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(getLineCount(result)).toBe(2);
      expect(getLine(result, 0)!.text).toBe('hello');
      expect(getLine(result, 1)!.text).toBe('');
    });

    it('mergeLine on last line (no next line) returns doc unchanged', () => {
      const doc = createDocument('first\nsecond');
      const op: MergeLineOp = {
        type: 'mergeLine',
        line: 1,
        origin: 'input',
      };
      const result = applyOperation(doc, op);
      expect(result).toBe(doc);
    });

    it('100 sequential insertText ops on same line', () => {
      let doc = createDocument('');
      for (let i = 0; i < 100; i++) {
        const op: InsertTextOp = {
          type: 'insertText',
          line: 0,
          column: i,
          text: 'a',
          origin: 'input',
        };
        doc = applyOperation(doc, op);
      }
      expect(getText(doc)).toBe('a'.repeat(100));
      expect(doc.version).toBe(100);
    });

    it('insert then delete same text = original document text', () => {
      const doc = createDocument('hello world');
      const insertOp: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 5,
        text: ' beautiful',
        origin: 'input',
      };
      const afterInsert = applyOperation(doc, insertOp);
      expect(getText(afterInsert)).toBe('hello beautiful world');

      const deleteOp: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 5,
        length: 10,
        origin: 'input',
      };
      const afterDelete = applyOperation(afterInsert, deleteOp);
      expect(getText(afterDelete)).toBe('hello world');
    });

    it('split then merge = original document text', () => {
      const doc = createDocument('hello world');
      const splitOp: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 5,
        origin: 'input',
      };
      const afterSplit = applyOperation(doc, splitOp);
      expect(getLineCount(afterSplit)).toBe(2);

      const mergeOp: MergeLineOp = {
        type: 'mergeLine',
        line: 0,
        origin: 'input',
      };
      const afterMerge = applyOperation(afterSplit, mergeOp);
      expect(getLineCount(afterMerge)).toBe(1);
      expect(getText(afterMerge)).toBe('hello world');
    });
  });

  describe('createOp', () => {
    it('creates an insertText operation with correct shape', () => {
      const op = createOp<InsertTextOp>('insertText', {
        line: 0,
        column: 0,
        text: 'hello',
        origin: 'input',
      });
      expect(op.type).toBe('insertText');
      expect(op.line).toBe(0);
      expect(op.column).toBe(0);
      expect(op.text).toBe('hello');
      expect(op.origin).toBe('input');
    });

    it('creates a deleteText operation with correct shape', () => {
      const op = createOp<DeleteTextOp>('deleteText', {
        line: 1,
        column: 3,
        length: 5,
        origin: 'command',
      });
      expect(op.type).toBe('deleteText');
      expect(op.line).toBe(1);
      expect(op.column).toBe(3);
      expect(op.length).toBe(5);
      expect(op.origin).toBe('command');
    });

    it('creates a deleteLine operation with correct shape', () => {
      const op = createOp<DeleteLineOp>('deleteLine', {
        index: 2,
        origin: 'input',
      });
      expect(op.type).toBe('deleteLine');
      expect(op.index).toBe(2);
    });
  });
});
