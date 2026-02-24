import { describe, it, expect } from 'vitest';
import {
  createPosition,
  createRange,
  createCollapsedRange,
  createSelection,
  isCollapsed,
  rangeContains,
  mapPositionThrough,
  mapSelectionThroughOps,
  mapRangeThrough,
  mapSelectionThrough,
} from '../../src/core/selection/Selection';
import type { Operation, InsertTextOp, DeleteTextOp, InsertLineOp, DeleteLineOp, SplitLineOp, MergeLineOp, ReplaceLineOp } from '../../src/core/types';

describe('Selection', () => {
  describe('createPosition', () => {
    it('creates a position with the correct line and column', () => {
      const pos = createPosition(3, 7);
      expect(pos.line).toBe(3);
      expect(pos.column).toBe(7);
    });

    it('creates a position at the origin', () => {
      const pos = createPosition(0, 0);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);
    });
  });

  describe('createRange', () => {
    it('creates a range with the correct anchor and focus', () => {
      const anchor = createPosition(1, 5);
      const focus = createPosition(3, 10);
      const range = createRange(anchor, focus);
      expect(range.anchor).toBe(anchor);
      expect(range.focus).toBe(focus);
    });
  });

  describe('createCollapsedRange', () => {
    it('creates a range where anchor and focus are the same position', () => {
      const pos = createPosition(2, 4);
      const range = createCollapsedRange(pos);
      expect(range.anchor).toBe(pos);
      expect(range.focus).toBe(pos);
    });
  });

  describe('isCollapsed', () => {
    it('returns true for a collapsed range', () => {
      const pos = createPosition(1, 1);
      const range = createCollapsedRange(pos);
      expect(isCollapsed(range)).toBe(true);
    });

    it('returns true when anchor and focus are different objects but same values', () => {
      const range = createRange(createPosition(2, 3), createPosition(2, 3));
      expect(isCollapsed(range)).toBe(true);
    });

    it('returns false for an expanded range (different columns)', () => {
      const range = createRange(createPosition(1, 0), createPosition(1, 5));
      expect(isCollapsed(range)).toBe(false);
    });

    it('returns false for an expanded range (different lines)', () => {
      const range = createRange(createPosition(0, 0), createPosition(2, 0));
      expect(isCollapsed(range)).toBe(false);
    });
  });

  describe('rangeContains', () => {
    it('returns true for a position inside the range', () => {
      const range = createRange(createPosition(1, 0), createPosition(3, 10));
      expect(rangeContains(range, createPosition(2, 5))).toBe(true);
    });

    it('returns true for a position at the start of the range', () => {
      const range = createRange(createPosition(1, 5), createPosition(3, 10));
      expect(rangeContains(range, createPosition(1, 5))).toBe(true);
    });

    it('returns true for a position at the end of the range', () => {
      const range = createRange(createPosition(1, 5), createPosition(3, 10));
      expect(rangeContains(range, createPosition(3, 10))).toBe(true);
    });

    it('returns false for a position before the range', () => {
      const range = createRange(createPosition(2, 5), createPosition(4, 10));
      expect(rangeContains(range, createPosition(1, 0))).toBe(false);
    });

    it('returns false for a position after the range', () => {
      const range = createRange(createPosition(2, 5), createPosition(4, 10));
      expect(rangeContains(range, createPosition(5, 0))).toBe(false);
    });

    it('returns false for a position on start line but before start column', () => {
      const range = createRange(createPosition(2, 5), createPosition(4, 10));
      expect(rangeContains(range, createPosition(2, 3))).toBe(false);
    });

    it('returns false for a position on end line but after end column', () => {
      const range = createRange(createPosition(2, 5), createPosition(4, 10));
      expect(rangeContains(range, createPosition(4, 15))).toBe(false);
    });

    it('works correctly with reversed anchor/focus (focus before anchor)', () => {
      // anchor is after focus -- rangeContains should still work
      const range = createRange(createPosition(5, 10), createPosition(2, 3));
      expect(rangeContains(range, createPosition(3, 0))).toBe(true);
      expect(rangeContains(range, createPosition(1, 0))).toBe(false);
    });
  });

  describe('mapPositionThrough', () => {
    describe('insertText', () => {
      it('adjusts column forward when inserting before the position on the same line', () => {
        const pos = createPosition(0, 5);
        const op: InsertTextOp = {
          type: 'insertText',
          line: 0,
          column: 2,
          text: 'abc',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(8); // 5 + 3
      });

      it('does not adjust position when inserting after the position on the same line', () => {
        const pos = createPosition(0, 2);
        const op: InsertTextOp = {
          type: 'insertText',
          line: 0,
          column: 5,
          text: 'abc',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(2);
      });

      it('does not adjust position when inserting on a different line', () => {
        const pos = createPosition(3, 5);
        const op: InsertTextOp = {
          type: 'insertText',
          line: 0,
          column: 0,
          text: 'abc',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(3);
        expect(result.column).toBe(5);
      });

      it('adjusts column when inserting at the exact position', () => {
        const pos = createPosition(0, 5);
        const op: InsertTextOp = {
          type: 'insertText',
          line: 0,
          column: 5,
          text: 'xx',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(7); // 5 + 2
      });
    });

    describe('deleteText', () => {
      it('adjusts column backward when deleting before the position on the same line', () => {
        const pos = createPosition(0, 10);
        const op: DeleteTextOp = {
          type: 'deleteText',
          line: 0,
          column: 2,
          length: 3,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(7); // 10 - 3
      });

      it('clamps position to delete start when position is within deleted range', () => {
        const pos = createPosition(0, 4);
        const op: DeleteTextOp = {
          type: 'deleteText',
          line: 0,
          column: 2,
          length: 5,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(2);
      });

      it('does not adjust position when deleting after the position', () => {
        const pos = createPosition(0, 2);
        const op: DeleteTextOp = {
          type: 'deleteText',
          line: 0,
          column: 5,
          length: 3,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(2);
      });

      it('does not adjust position when position is at or before delete column', () => {
        const pos = createPosition(0, 2);
        const op: DeleteTextOp = {
          type: 'deleteText',
          line: 0,
          column: 2,
          length: 3,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(2);
      });

      it('does not adjust position when deleting on a different line', () => {
        const pos = createPosition(3, 5);
        const op: DeleteTextOp = {
          type: 'deleteText',
          line: 1,
          column: 0,
          length: 3,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(3);
        expect(result.column).toBe(5);
      });
    });

    describe('insertLine', () => {
      it('shifts position down when inserting a line before it', () => {
        const pos = createPosition(3, 5);
        const op: InsertLineOp = {
          type: 'insertLine',
          index: 1,
          text: 'new line',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(4);
        expect(result.column).toBe(5);
      });

      it('shifts position down when inserting at the same line', () => {
        const pos = createPosition(2, 5);
        const op: InsertLineOp = {
          type: 'insertLine',
          index: 2,
          text: 'new line',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(3);
        expect(result.column).toBe(5);
      });

      it('does not shift position when inserting a line after it', () => {
        const pos = createPosition(1, 5);
        const op: InsertLineOp = {
          type: 'insertLine',
          index: 5,
          text: 'new line',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(1);
        expect(result.column).toBe(5);
      });
    });

    describe('deleteLine', () => {
      it('shifts position up when deleting a line before it', () => {
        const pos = createPosition(3, 5);
        const op: DeleteLineOp = {
          type: 'deleteLine',
          index: 1,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(2);
        expect(result.column).toBe(5);
      });

      it('moves position to start of index when deleting the exact line', () => {
        const pos = createPosition(2, 10);
        const op: DeleteLineOp = {
          type: 'deleteLine',
          index: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(2);
        expect(result.column).toBe(0);
      });

      it('does not shift position when deleting a line after it', () => {
        const pos = createPosition(1, 5);
        const op: DeleteLineOp = {
          type: 'deleteLine',
          index: 5,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(1);
        expect(result.column).toBe(5);
      });
    });

    describe('splitLine', () => {
      it('does not change position before the split point on the same line', () => {
        const pos = createPosition(0, 2);
        const op: SplitLineOp = {
          type: 'splitLine',
          line: 0,
          column: 5,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(2);
      });

      it('moves position to next line with adjusted column when after split point', () => {
        const pos = createPosition(0, 8);
        const op: SplitLineOp = {
          type: 'splitLine',
          line: 0,
          column: 5,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(1);
        expect(result.column).toBe(3); // 8 - 5
      });

      it('does not move position at exactly the split column', () => {
        const pos = createPosition(0, 5);
        const op: SplitLineOp = {
          type: 'splitLine',
          line: 0,
          column: 5,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(5);
      });

      it('shifts lines after the split line down by one', () => {
        const pos = createPosition(3, 5);
        const op: SplitLineOp = {
          type: 'splitLine',
          line: 1,
          column: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(4);
        expect(result.column).toBe(5);
      });

      it('does not affect positions on lines before the split', () => {
        const pos = createPosition(0, 5);
        const op: SplitLineOp = {
          type: 'splitLine',
          line: 3,
          column: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(5);
      });
    });

    describe('mergeLine', () => {
      it('does not change position on a line before the merge', () => {
        const pos = createPosition(0, 5);
        const op: MergeLineOp = {
          type: 'mergeLine',
          line: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(0);
        expect(result.column).toBe(5);
      });

      it('does not change position on the merge line itself', () => {
        const pos = createPosition(2, 5);
        const op: MergeLineOp = {
          type: 'mergeLine',
          line: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(2);
        expect(result.column).toBe(5);
      });

      it('moves position on the merged-away line up to the merge line', () => {
        const pos = createPosition(3, 4);
        const op: MergeLineOp = {
          type: 'mergeLine',
          line: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(2);
        expect(result.column).toBe(4);
      });

      it('shifts lines after the merged pair up by one', () => {
        const pos = createPosition(5, 3);
        const op: MergeLineOp = {
          type: 'mergeLine',
          line: 2,
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(4);
        expect(result.column).toBe(3);
      });
    });

    describe('replaceLine', () => {
      it('does not change position because replaceLine has no structural effect', () => {
        const pos = createPosition(2, 5);
        const op: ReplaceLineOp = {
          type: 'replaceLine',
          index: 2,
          text: 'completely new text',
          origin: 'input',
        };
        const result = mapPositionThrough(pos, op);
        expect(result.line).toBe(2);
        expect(result.column).toBe(5);
      });
    });
  });

  describe('mapSelectionThroughOps', () => {
    it('chains multiple operations through a selection', () => {
      const sel = createSelection([
        createCollapsedRange(createPosition(0, 5)),
      ]);

      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'abc', origin: 'input' as const },
        { type: 'insertLine', index: 0, text: 'new line', origin: 'input' as const },
      ];

      const result = mapSelectionThroughOps(sel, ops);
      // After insertText at col 0 with 'abc' (3 chars): position becomes (0, 8)
      // After insertLine at index 0: position becomes (1, 8)
      expect(result.ranges[0].anchor.line).toBe(1);
      expect(result.ranges[0].anchor.column).toBe(8);
    });

    it('returns unchanged selection when given no operations', () => {
      const sel = createSelection([
        createCollapsedRange(createPosition(2, 3)),
      ]);
      const result = mapSelectionThroughOps(sel, []);
      expect(result).toBe(sel);
    });
  });

  describe('Edge cases', () => {
    it('mapPositionThrough with position at (0,0) for insertText', () => {
      const pos = createPosition(0, 0);
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 0,
        text: 'abc',
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      expect(result.line).toBe(0);
      expect(result.column).toBe(3);
    });

    it('mapPositionThrough with position at (0,0) for deleteText', () => {
      const pos = createPosition(0, 0);
      const op: DeleteTextOp = {
        type: 'deleteText',
        line: 0,
        column: 0,
        length: 3,
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      // pos.column (0) <= op.column (0) => no change
      expect(result.line).toBe(0);
      expect(result.column).toBe(0);
    });

    it('mapPositionThrough with position at (0,0) for insertLine', () => {
      const pos = createPosition(0, 0);
      const op: InsertLineOp = {
        type: 'insertLine',
        index: 0,
        text: 'new',
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
    });

    it('mapPositionThrough with position at (0,0) for deleteLine', () => {
      const pos = createPosition(0, 0);
      const op: DeleteLineOp = {
        type: 'deleteLine',
        index: 0,
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      expect(result.line).toBe(0);
      expect(result.column).toBe(0);
    });

    it('mapPositionThrough with position at (0,0) for splitLine', () => {
      const pos = createPosition(0, 0);
      const op: SplitLineOp = {
        type: 'splitLine',
        line: 0,
        column: 0,
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      // pos.column (0) <= op.column (0) => stays at (0, 0)
      expect(result.line).toBe(0);
      expect(result.column).toBe(0);
    });

    it('mapPositionThrough with position at (0,0) for mergeLine', () => {
      const pos = createPosition(0, 0);
      const op: MergeLineOp = {
        type: 'mergeLine',
        line: 0,
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      // pos.line === op.line => no change
      expect(result.line).toBe(0);
      expect(result.column).toBe(0);
    });

    it('mapPositionThrough with position at (0,0) for replaceLine', () => {
      const pos = createPosition(0, 0);
      const op: ReplaceLineOp = {
        type: 'replaceLine',
        index: 0,
        text: 'new text',
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      expect(result.line).toBe(0);
      expect(result.column).toBe(0);
    });

    it('mapPositionThrough insertText on different line does not change column', () => {
      const pos = createPosition(5, 10);
      const op: InsertTextOp = {
        type: 'insertText',
        line: 3,
        column: 0,
        text: 'inserted text',
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      expect(result.line).toBe(5);
      expect(result.column).toBe(10);
    });

    it('mapSelectionThroughOps with empty ops array returns unchanged selection', () => {
      const sel = createSelection([
        createRange(createPosition(1, 2), createPosition(3, 4)),
      ]);
      const result = mapSelectionThroughOps(sel, []);
      expect(result).toBe(sel);
    });

    it('mapPositionThrough with position beyond document bounds', () => {
      const pos = createPosition(999, 999);
      const op: InsertTextOp = {
        type: 'insertText',
        line: 0,
        column: 0,
        text: 'hello',
        origin: 'input',
      };
      const result = mapPositionThrough(pos, op);
      // Different line, no adjustment
      expect(result.line).toBe(999);
      expect(result.column).toBe(999);
    });

    it('range containing entire single-line content', () => {
      const range = createRange(createPosition(0, 0), createPosition(0, 20));
      expect(rangeContains(range, createPosition(0, 0))).toBe(true);
      expect(rangeContains(range, createPosition(0, 10))).toBe(true);
      expect(rangeContains(range, createPosition(0, 20))).toBe(true);
      expect(rangeContains(range, createPosition(0, 21))).toBe(false);
      expect(rangeContains(range, createPosition(1, 0))).toBe(false);
    });

    it('multi-range selection mapping through ops', () => {
      const sel = createSelection([
        createCollapsedRange(createPosition(0, 5)),
        createCollapsedRange(createPosition(2, 3)),
        createCollapsedRange(createPosition(4, 0)),
      ]);

      const ops: Operation[] = [
        { type: 'insertLine', index: 1, text: 'new line', origin: 'input' as const },
      ];

      const result = mapSelectionThroughOps(sel, ops);
      // Range 0 at line 0 => not affected (insertLine at index 1)
      expect(result.ranges[0].anchor.line).toBe(0);
      expect(result.ranges[0].anchor.column).toBe(5);
      // Range 1 at line 2 => shifted to line 3
      expect(result.ranges[1].anchor.line).toBe(3);
      expect(result.ranges[1].anchor.column).toBe(3);
      // Range 2 at line 4 => shifted to line 5
      expect(result.ranges[2].anchor.line).toBe(5);
      expect(result.ranges[2].anchor.column).toBe(0);
    });
  });
});
