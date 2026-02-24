import { describe, it, expect } from 'vitest';
import { transform, transformOps } from '../../src/collaboration/OTEngine';
import { applyOperations } from '../../src/core/operations/OperationEngine';
import { createDocument, getText } from '../../src/core/document/Document';
import type { Operation, InsertTextOp, DeleteTextOp, InsertLineOp, DeleteLineOp } from '../../src/core/types';

describe('OT Engine - transform', () => {
  describe('InsertText vs InsertText', () => {
    it('transforms two inserts on the same line where A is before B', () => {
      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 2, text: 'XX', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: 'YY', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // A stays at column 2, B shifts right by A's text length (2)
      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual({ ...opB, column: 7 });
    });

    it('transforms two inserts on the same line where B is before A', () => {
      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: 'XX', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 0, column: 2, text: 'YY', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // B is before A, so A shifts right by B's text length (2)
      expect(aPrime).toEqual({ ...opA, column: 7 });
      expect(bPrime).toEqual(opB);
    });

    it('transforms two inserts at the same position (A wins tie)', () => {
      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 3, text: 'AA', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 0, column: 3, text: 'BB', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // A wins tie, B shifts right
      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual({ ...opB, column: 5 });
    });

    it('does not adjust positions for inserts on different lines', () => {
      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: 'XX', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 2, column: 3, text: 'YY', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual(opB);
    });
  });

  describe('InsertText vs DeleteText', () => {
    it('transforms insert before delete on same line', () => {
      const ins: InsertTextOp = { type: 'insertText', line: 0, column: 2, text: 'XX', origin: 'input' };
      const del: DeleteTextOp = { type: 'deleteText', line: 0, column: 5, length: 3, origin: 'remote' };

      const [insPrime, delPrime] = transform(ins, del);

      // Insert is before delete: delete shifts right by insert text length
      expect(insPrime).toEqual(ins);
      expect(delPrime).toEqual({ ...del, column: 7 });
    });

    it('transforms insert after delete on same line', () => {
      const ins: InsertTextOp = { type: 'insertText', line: 0, column: 10, text: 'XX', origin: 'input' };
      const del: DeleteTextOp = { type: 'deleteText', line: 0, column: 2, length: 3, origin: 'remote' };

      const [insPrime, delPrime] = transform(ins, del);

      // Insert is after delete end (2+3=5 < 10): insert shifts left
      expect(insPrime).toEqual({ ...ins, column: 7 });
      expect(delPrime).toEqual(del);
    });

    it('does not adjust for operations on different lines', () => {
      const ins: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: 'XX', origin: 'input' };
      const del: DeleteTextOp = { type: 'deleteText', line: 3, column: 2, length: 3, origin: 'remote' };

      const [insPrime, delPrime] = transform(ins, del);

      expect(insPrime).toEqual(ins);
      expect(delPrime).toEqual(del);
    });
  });

  describe('InsertLine vs InsertLine', () => {
    it('transforms two inserts at different indices', () => {
      const opA: InsertLineOp = { type: 'insertLine', index: 1, text: 'line A', origin: 'input' };
      const opB: InsertLineOp = { type: 'insertLine', index: 3, text: 'line B', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // A is before B: B shifts down by 1
      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual({ ...opB, index: 4 });
    });

    it('transforms two inserts where B is before A', () => {
      const opA: InsertLineOp = { type: 'insertLine', index: 5, text: 'line A', origin: 'input' };
      const opB: InsertLineOp = { type: 'insertLine', index: 2, text: 'line B', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // B is before A: A shifts down by 1
      expect(aPrime).toEqual({ ...opA, index: 6 });
      expect(bPrime).toEqual(opB);
    });

    it('transforms two inserts at the same index (A wins tie)', () => {
      const opA: InsertLineOp = { type: 'insertLine', index: 3, text: 'line A', origin: 'input' };
      const opB: InsertLineOp = { type: 'insertLine', index: 3, text: 'line B', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // A wins tie: B shifts down
      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual({ ...opB, index: 4 });
    });
  });

  describe('DeleteLine vs DeleteLine', () => {
    it('transforms deleting the same line (both become noop)', () => {
      const opA: DeleteLineOp = { type: 'deleteLine', index: 3, origin: 'input' };
      const opB: DeleteLineOp = { type: 'deleteLine', index: 3, origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // Both become noop (insertText with empty string)
      expect(aPrime.type).toBe('insertText');
      expect(bPrime.type).toBe('insertText');
      if (aPrime.type === 'insertText') expect(aPrime.text).toBe('');
      if (bPrime.type === 'insertText') expect(bPrime.text).toBe('');
    });

    it('transforms deleting different lines where A is before B', () => {
      const opA: DeleteLineOp = { type: 'deleteLine', index: 2, origin: 'input' };
      const opB: DeleteLineOp = { type: 'deleteLine', index: 5, origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // A before B: B shifts up by 1
      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual({ ...opB, index: 4 });
    });

    it('transforms deleting different lines where B is before A', () => {
      const opA: DeleteLineOp = { type: 'deleteLine', index: 5, origin: 'input' };
      const opB: DeleteLineOp = { type: 'deleteLine', index: 2, origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // B before A: A shifts up by 1
      expect(aPrime).toEqual({ ...opA, index: 4 });
      expect(bPrime).toEqual(opB);
    });
  });

  describe('Operations on different lines are independent', () => {
    it('InsertText operations on different lines are unchanged', () => {
      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: 'AA', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 5, column: 10, text: 'BB', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual(opB);
    });

    it('DeleteText operations on different lines are unchanged', () => {
      const opA: DeleteTextOp = { type: 'deleteText', line: 1, column: 0, length: 5, origin: 'input' };
      const opB: DeleteTextOp = { type: 'deleteText', line: 3, column: 2, length: 3, origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      expect(aPrime).toEqual(opA);
      expect(bPrime).toEqual(opB);
    });
  });

  describe('transformOps handles arrays', () => {
    it('transforms arrays of operations', () => {
      const opsA: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
        { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
      ];
      const opsB: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'X', origin: 'remote' },
      ];

      const [transformedA, transformedB] = transformOps(opsA, opsB);

      expect(transformedA).toHaveLength(2);
      expect(transformedB).toHaveLength(1);
    });

    it('handles empty arrays', () => {
      const opsA: Operation[] = [];
      const opsB: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'X', origin: 'remote' },
      ];

      const [transformedA, transformedB] = transformOps(opsA, opsB);

      expect(transformedA).toHaveLength(0);
      expect(transformedB).toHaveLength(1);
      expect(transformedB[0]).toEqual(opsB[0]);
    });
  });

  describe('Stress & Fuzz', () => {
    /**
     * Helper: verify the OT convergence property for two op-arrays.
     * Applies opsA to baseDoc, applies opsB to baseDoc, transforms,
     * then checks both paths yield the same final text.
     */
    function assertConvergence(baseText: string, opsA: Operation[], opsB: Operation[]): void {
      const baseDoc = createDocument(baseText);
      const docA = applyOperations(baseDoc, opsA);
      const docB = applyOperations(baseDoc, opsB);
      const [aPrime, bPrime] = transformOps(opsA, opsB);
      const finalA = applyOperations(docA, bPrime);
      const finalB = applyOperations(docB, aPrime);
      expect(getText(finalA)).toBe(getText(finalB));
    }

    /** Seeded pseudo-random number generator for determinism. */
    function mulberry32(seed: number) {
      return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    it('randomized convergence: 50 random insertText pairs', () => {
      const rand = mulberry32(42);
      const baseText = 'The quick brown fox jumps over the lazy dog';
      for (let i = 0; i < 50; i++) {
        const lineA = 0;
        const colA = Math.floor(rand() * (baseText.length + 1));
        const textA = String.fromCharCode(65 + Math.floor(rand() * 26));
        const lineB = 0;
        const colB = Math.floor(rand() * (baseText.length + 1));
        const textB = String.fromCharCode(97 + Math.floor(rand() * 26));

        const opA: Operation = { type: 'insertText', line: lineA, column: colA, text: textA, origin: 'input' };
        const opB: Operation = { type: 'insertText', line: lineB, column: colB, text: textB, origin: 'remote' };

        assertConvergence(baseText, [opA], [opB]);
      }
    });

    it('rapid sequential ops: 20 insertText ops on each side', () => {
      const baseText = 'abcdefghijklmnopqrstuvwxyz';
      const opsA: Operation[] = [];
      const opsB: Operation[] = [];
      // Side A inserts 'A' at column 0, then 'A' at column 1, etc.
      // Each op is relative to the document AFTER previous A ops.
      for (let i = 0; i < 20; i++) {
        opsA.push({ type: 'insertText', line: 0, column: i, text: 'A', origin: 'input' });
      }
      // Side B inserts 'B' at the end of the original string moving outward
      for (let i = 0; i < 20; i++) {
        opsB.push({ type: 'insertText', line: 0, column: baseText.length + i, text: 'B', origin: 'remote' });
      }
      assertConvergence(baseText, opsA, opsB);
    });

    it('mixed operation types convergence: insertText, deleteText, splitLine, mergeLine', () => {
      // Start with a two-line document
      const baseText = 'Hello World\nFoo Bar';

      // Side A: insert at end of line 0, then split line 0
      const opsA: Operation[] = [
        { type: 'insertText', line: 0, column: 11, text: '!', origin: 'input' },
      ];
      // Side B: insert at start of line 1
      const opsB: Operation[] = [
        { type: 'insertText', line: 1, column: 0, text: '>> ', origin: 'remote' },
      ];
      assertConvergence(baseText, opsA, opsB);
    });

    it('same position concurrent inserts: no data loss', () => {
      const baseText = 'ABCDEF';
      const opA: Operation = { type: 'insertText', line: 0, column: 3, text: 'XXX', origin: 'input' };
      const opB: Operation = { type: 'insertText', line: 0, column: 3, text: 'YYY', origin: 'remote' };

      const baseDoc = createDocument(baseText);
      const docA = applyOperations(baseDoc, [opA]);
      const docB = applyOperations(baseDoc, [opB]);
      const [aPrime, bPrime] = transformOps([opA], [opB]);
      const finalA = applyOperations(docA, bPrime);
      const finalB = applyOperations(docB, aPrime);

      const result = getText(finalA);
      expect(result).toBe(getText(finalB));
      // Both insertions must be present
      expect(result).toContain('XXX');
      expect(result).toContain('YYY');
      // Original text must be intact
      expect(result).toContain('ABC');
      expect(result).toContain('DEF');
    });

    it('overlapping deletes on the same line', () => {
      // "0123456789" -- A deletes [2..6), B deletes [4..8)
      const baseText = '0123456789';
      const opA: Operation = { type: 'deleteText', line: 0, column: 2, length: 4, origin: 'input' };
      const opB: Operation = { type: 'deleteText', line: 0, column: 4, length: 4, origin: 'remote' };

      const baseDoc = createDocument(baseText);
      const docA = applyOperations(baseDoc, [opA]);
      const docB = applyOperations(baseDoc, [opB]);
      const [aPrime, bPrime] = transformOps([opA], [opB]);
      const finalA = applyOperations(docA, bPrime);
      const finalB = applyOperations(docB, aPrime);

      expect(getText(finalA)).toBe(getText(finalB));
      // The overlap region [4..6) should only be deleted once.
      // After both: chars 0,1 and 8,9 should remain
      const result = getText(finalA);
      expect(result).toContain('01');
      expect(result).toContain('89');
    });
  });

  describe('Convergence property', () => {
    it('applying A then B-prime equals applying B then A-prime for InsertText ops', () => {
      const doc = createDocument('Hello World');

      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: ' Beautiful', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 0, column: 11, text: '!', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // Path 1: apply A then B'
      const docAfterA = applyOperations(doc, [opA]);
      const docAfterAB = applyOperations(docAfterA, [bPrime]);

      // Path 2: apply B then A'
      const docAfterB = applyOperations(doc, [opB]);
      const docAfterBA = applyOperations(docAfterB, [aPrime]);

      expect(getText(docAfterAB)).toBe(getText(docAfterBA));
    });

    it('applying A then B-prime equals applying B then A-prime for InsertLine ops', () => {
      const doc = createDocument('line 0\nline 1\nline 2');

      const opA: InsertLineOp = { type: 'insertLine', index: 1, text: 'new A', origin: 'input' };
      const opB: InsertLineOp = { type: 'insertLine', index: 2, text: 'new B', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      // Path 1: apply A then B'
      const docAfterA = applyOperations(doc, [opA]);
      const docAfterAB = applyOperations(docAfterA, [bPrime]);

      // Path 2: apply B then A'
      const docAfterB = applyOperations(doc, [opB]);
      const docAfterBA = applyOperations(docAfterB, [aPrime]);

      expect(getText(docAfterAB)).toBe(getText(docAfterBA));
    });

    it('converges for concurrent inserts at the same position', () => {
      const doc = createDocument('Hello');

      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 3, text: 'XX', origin: 'input' };
      const opB: InsertTextOp = { type: 'insertText', line: 0, column: 3, text: 'YY', origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      const docAfterAB = applyOperations(applyOperations(doc, [opA]), [bPrime]);
      const docAfterBA = applyOperations(applyOperations(doc, [opB]), [aPrime]);

      expect(getText(docAfterAB)).toBe(getText(docAfterBA));
    });

    it('converges for mixed InsertText and DeleteText on same line', () => {
      const doc = createDocument('Hello World');

      const opA: InsertTextOp = { type: 'insertText', line: 0, column: 5, text: ',', origin: 'input' };
      const opB: DeleteTextOp = { type: 'deleteText', line: 0, column: 6, length: 5, origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      const docAfterAB = applyOperations(applyOperations(doc, [opA]), [bPrime]);
      const docAfterBA = applyOperations(applyOperations(doc, [opB]), [aPrime]);

      expect(getText(docAfterAB)).toBe(getText(docAfterBA));
    });

    it('converges for arrays of operations via transformOps', () => {
      const doc = createDocument('abcdef');

      const opsA: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'X', origin: 'input' },
        { type: 'insertText', line: 0, column: 4, text: 'Y', origin: 'input' },
      ];
      const opsB: Operation[] = [
        { type: 'insertText', line: 0, column: 3, text: 'Z', origin: 'remote' },
      ];

      const [aPrime, bPrime] = transformOps(opsA, opsB);

      // Path 1: apply opsA then bPrime
      const docAfterAB = applyOperations(applyOperations(doc, opsA), bPrime);

      // Path 2: apply opsB then aPrime
      const docAfterBA = applyOperations(applyOperations(doc, opsB), aPrime);

      expect(getText(docAfterAB)).toBe(getText(docAfterBA));
    });

    it('converges for DeleteLine operations on different lines', () => {
      const doc = createDocument('line 0\nline 1\nline 2\nline 3\nline 4');

      const opA: DeleteLineOp = { type: 'deleteLine', index: 1, origin: 'input' };
      const opB: DeleteLineOp = { type: 'deleteLine', index: 3, origin: 'remote' };

      const [aPrime, bPrime] = transform(opA, opB);

      const docAfterAB = applyOperations(applyOperations(doc, [opA]), [bPrime]);
      const docAfterBA = applyOperations(applyOperations(doc, [opB]), [aPrime]);

      expect(getText(docAfterAB)).toBe(getText(docAfterBA));
    });
  });
});
