import { createInstruction, OpType } from '@nodius/utils';
import type { Instruction } from '@nodius/utils';
import type { Operation, OperationOrigin } from '../core/types';

/**
 * Encodes editor Operations into @nodius/utils Instructions for wire transport.
 *
 * Mapping:
 *   insertText  → STR_INS   path=[line]          i=column  v=text
 *   deleteText  → STR_REM   path=[line]          i=column  l=length
 *   insertLine  → ARR_INS   path=[]              i=index   v=text
 *   deleteLine  → ARR_REM_IDX path=[]            i=index
 *   replaceLine → SET       path=[index]         v=text
 *   splitLine   → SET       path=["s", line]     v=column
 *   mergeLine   → SET       path=["m"]           v=line
 *
 * The `origin` field is intentionally omitted — it's always 'remote' on the receiving end.
 */
export function encodeOperation(op: Operation): Instruction {
  switch (op.type) {
    case 'insertText':
      return createInstruction().key(String(op.line)).insertString(op.column, op.text);

    case 'deleteText':
      return createInstruction().key(String(op.line)).stringRemove(op.column, op.length);

    case 'insertLine':
      return createInstruction().arrayInsertAtIndex(op.index, op.text);

    case 'deleteLine':
      return createInstruction().arrayRemoveIndex(op.index);

    case 'replaceLine':
      return createInstruction().key(String(op.index)).set(op.text);

    case 'splitLine':
      return { o: OpType.SET, p: ['s', String(op.line)], v: op.column };

    case 'mergeLine':
      return { o: OpType.SET, p: ['m'], v: op.line };
  }
}

/**
 * Encodes an array of Operations into Instructions.
 */
export function encodeOperations(ops: readonly Operation[]): Instruction[] {
  return ops.map(encodeOperation);
}

/**
 * Decodes a single @nodius/utils Instruction back into an editor Operation.
 * Origin defaults to 'remote' since decoded instructions come from the network.
 */
export function decodeInstruction(inst: Instruction, origin: OperationOrigin = 'remote'): Operation {
  switch (inst.o) {
    case OpType.STR_INS:
      return {
        type: 'insertText',
        line: Number(inst.p![0]),
        column: inst.i!,
        text: inst.v as string,
        origin,
      };

    case OpType.STR_REM:
      return {
        type: 'deleteText',
        line: Number(inst.p![0]),
        column: inst.i!,
        length: inst.l!,
        origin,
      };

    case OpType.ARR_INS:
      return {
        type: 'insertLine',
        index: inst.i!,
        text: inst.v as string,
        origin,
      };

    case OpType.ARR_REM_IDX:
      return {
        type: 'deleteLine',
        index: inst.i!,
        origin,
      };

    case OpType.SET: {
      const path = inst.p;
      if (path && path[0] === 's') {
        return {
          type: 'splitLine',
          line: Number(path[1]),
          column: inst.v as number,
          origin,
        };
      }
      if (path && path[0] === 'm') {
        return {
          type: 'mergeLine',
          line: inst.v as number,
          origin,
        };
      }
      // replaceLine: path = [index], v = text
      return {
        type: 'replaceLine',
        index: Number(path![0]),
        text: inst.v as string,
        origin,
      };
    }

    default:
      throw new Error(`Unknown instruction OpType: ${inst.o}`);
  }
}

/**
 * Decodes an array of Instructions into Operations.
 */
export function decodeInstructions(
  instructions: readonly Instruction[],
  origin: OperationOrigin = 'remote',
): Operation[] {
  return instructions.map((inst) => decodeInstruction(inst, origin));
}
