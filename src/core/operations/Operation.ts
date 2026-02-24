export type {
  Operation,
  OperationOrigin,
  InsertTextOp,
  DeleteTextOp,
  InsertLineOp,
  DeleteLineOp,
  SplitLineOp,
  MergeLineOp,
  ReplaceLineOp,
} from '../types';

import type { Operation } from '../types';

export function createOp<T extends Operation>(type: T['type'], params: Omit<T, 'type'>): T {
  return { type, ...params } as T;
}
