import { describe, it, expect } from 'vitest';
import { OpType } from '@nodius/utils';
import type { Instruction } from '@nodius/utils';
import {
  encodeOperation,
  encodeOperations,
  decodeInstruction,
  decodeInstructions,
} from '../../src/collaboration/InstructionCodec';
import type { Operation } from '../../src/core/types';

describe('InstructionCodec', () => {
  describe('round-trip: encode then decode', () => {
    const cases: Array<{ name: string; op: Operation }> = [
      {
        name: 'insertText',
        op: { type: 'insertText', line: 3, column: 7, text: 'hello', origin: 'input' },
      },
      {
        name: 'deleteText',
        op: { type: 'deleteText', line: 1, column: 4, length: 5, origin: 'input' },
      },
      {
        name: 'insertLine',
        op: { type: 'insertLine', index: 2, text: 'new line', origin: 'command' },
      },
      {
        name: 'deleteLine',
        op: { type: 'deleteLine', index: 5, origin: 'input' },
      },
      {
        name: 'replaceLine',
        op: { type: 'replaceLine', index: 0, text: 'replaced', origin: 'input' },
      },
      {
        name: 'splitLine',
        op: { type: 'splitLine', line: 4, column: 10, origin: 'input' },
      },
      {
        name: 'mergeLine',
        op: { type: 'mergeLine', line: 6, origin: 'input' },
      },
    ];

    for (const { name, op } of cases) {
      it(`round-trips ${name}`, () => {
        const instruction = encodeOperation(op);
        const decoded = decodeInstruction(instruction);

        // Origin is always 'remote' after decoding (wire convention)
        expect(decoded.type).toBe(op.type);
        expect(decoded.origin).toBe('remote');

        // Check all fields except origin
        const { origin: _a, ...opFields } = op;
        const { origin: _b, ...decodedFields } = decoded;
        expect(decodedFields).toEqual(opFields);
      });
    }
  });

  describe('encodeOperation produces correct OpTypes', () => {
    it('insertText → STR_INS', () => {
      const inst = encodeOperation({
        type: 'insertText', line: 0, column: 5, text: 'abc', origin: 'input',
      });
      expect(inst.o).toBe(OpType.STR_INS);
      expect(inst.p).toEqual(['0']);
      expect(inst.i).toBe(5);
      expect(inst.v).toBe('abc');
    });

    it('deleteText → STR_REM', () => {
      const inst = encodeOperation({
        type: 'deleteText', line: 2, column: 3, length: 4, origin: 'input',
      });
      expect(inst.o).toBe(OpType.STR_REM);
      expect(inst.p).toEqual(['2']);
      expect(inst.i).toBe(3);
      expect(inst.l).toBe(4);
    });

    it('insertLine → ARR_INS', () => {
      const inst = encodeOperation({
        type: 'insertLine', index: 7, text: 'hello', origin: 'input',
      });
      expect(inst.o).toBe(OpType.ARR_INS);
      expect(inst.i).toBe(7);
      expect(inst.v).toBe('hello');
    });

    it('deleteLine → ARR_REM_IDX', () => {
      const inst = encodeOperation({
        type: 'deleteLine', index: 3, origin: 'input',
      });
      expect(inst.o).toBe(OpType.ARR_REM_IDX);
      expect(inst.i).toBe(3);
    });

    it('replaceLine → SET with line index path', () => {
      const inst = encodeOperation({
        type: 'replaceLine', index: 1, text: 'new', origin: 'input',
      });
      expect(inst.o).toBe(OpType.SET);
      expect(inst.p).toEqual(['1']);
      expect(inst.v).toBe('new');
    });

    it('splitLine → SET with ["s", line] path', () => {
      const inst = encodeOperation({
        type: 'splitLine', line: 4, column: 8, origin: 'input',
      });
      expect(inst.o).toBe(OpType.SET);
      expect(inst.p).toEqual(['s', '4']);
      expect(inst.v).toBe(8);
    });

    it('mergeLine → SET with ["m"] path', () => {
      const inst = encodeOperation({
        type: 'mergeLine', line: 9, origin: 'input',
      });
      expect(inst.o).toBe(OpType.SET);
      expect(inst.p).toEqual(['m']);
      expect(inst.v).toBe(9);
    });
  });

  describe('decodeInstruction with custom origin', () => {
    it('uses provided origin instead of default remote', () => {
      const inst = encodeOperation({
        type: 'insertText', line: 0, column: 0, text: 'x', origin: 'input',
      });
      const decoded = decodeInstruction(inst, 'command');
      expect(decoded.origin).toBe('command');
    });
  });

  describe('batch encode/decode', () => {
    it('encodeOperations and decodeInstructions round-trip an array', () => {
      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
        { type: 'deleteText', line: 1, column: 5, length: 3, origin: 'input' },
        { type: 'splitLine', line: 2, column: 10, origin: 'input' },
      ];

      const instructions = encodeOperations(ops);
      expect(instructions).toHaveLength(3);

      const decoded = decodeInstructions(instructions);
      expect(decoded).toHaveLength(3);
      expect(decoded[0].type).toBe('insertText');
      expect(decoded[1].type).toBe('deleteText');
      expect(decoded[2].type).toBe('splitLine');
    });

    it('handles empty array', () => {
      expect(encodeOperations([])).toEqual([]);
      expect(decodeInstructions([])).toEqual([]);
    });
  });

  describe('decodeInstruction throws on unknown OpType', () => {
    it('throws for unrecognized operation type', () => {
      const bogus: Instruction = { o: 99 as OpType };
      expect(() => decodeInstruction(bogus)).toThrow('Unknown instruction OpType');
    });
  });

  describe('edge cases', () => {
    it('handles empty text insertions', () => {
      const op: Operation = { type: 'insertText', line: 0, column: 0, text: '', origin: 'input' };
      const inst = encodeOperation(op);
      const decoded = decodeInstruction(inst);
      expect(decoded.type).toBe('insertText');
      if (decoded.type === 'insertText') {
        expect(decoded.text).toBe('');
      }
    });

    it('handles line 0 column 0 correctly', () => {
      const op: Operation = { type: 'insertText', line: 0, column: 0, text: 'x', origin: 'input' };
      const inst = encodeOperation(op);
      const decoded = decodeInstruction(inst);
      if (decoded.type === 'insertText') {
        expect(decoded.line).toBe(0);
        expect(decoded.column).toBe(0);
      }
    });

    it('handles large line numbers', () => {
      const op: Operation = { type: 'insertText', line: 99999, column: 500, text: 'x', origin: 'input' };
      const inst = encodeOperation(op);
      const decoded = decodeInstruction(inst);
      if (decoded.type === 'insertText') {
        expect(decoded.line).toBe(99999);
        expect(decoded.column).toBe(500);
      }
    });

    it('handles multi-line text in insertText', () => {
      const op: Operation = {
        type: 'insertText', line: 0, column: 0, text: 'line1\nline2\nline3', origin: 'input',
      };
      const decoded = decodeInstruction(encodeOperation(op));
      if (decoded.type === 'insertText') {
        expect(decoded.text).toBe('line1\nline2\nline3');
      }
    });
  });
});
