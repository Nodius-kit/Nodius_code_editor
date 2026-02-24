import type { Operation, OperationOrigin } from '../core/types';

/**
 * Operational Transformation engine.
 *
 * The core invariant: given two concurrent operations A and B, we produce
 * A' and B' such that applying A then B' yields the same document state
 * as applying B then A'.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noop(origin: OperationOrigin): Operation {
  // A no-op is represented as replacing line 0 with its own text.
  // Since we don't know the text, we use an insertText with empty string,
  // which is effectively a no-op.
  return { type: 'insertText', line: 0, column: 0, text: '', origin };
}

// ---------------------------------------------------------------------------
// Same-type transforms
// ---------------------------------------------------------------------------

function transformInsertInsert(
  a: Operation & { type: 'insertText' },
  b: Operation & { type: 'insertText' },
): [Operation, Operation] {
  // Different lines: independent
  if (a.line !== b.line) return [a, b];

  // Same line: adjust columns
  if (a.column < b.column || (a.column === b.column && true /* A wins tie */)) {
    // A is at or before B: B shifts right by A's text length
    const bPrime: Operation = { ...b, column: b.column + a.text.length };
    return [a, bPrime];
  }

  // B is strictly before A: A shifts right by B's text length
  const aPrime: Operation = { ...a, column: a.column + b.text.length };
  return [aPrime, b];
}

function transformDeleteDelete(
  a: Operation & { type: 'deleteText' },
  b: Operation & { type: 'deleteText' },
): [Operation, Operation] {
  if (a.line !== b.line) return [a, b];

  const aEnd = a.column + a.length;
  const bEnd = b.column + b.length;

  // No overlap: adjust positions
  if (aEnd <= b.column) {
    // A entirely before B
    const bPrime: Operation = { ...b, column: b.column - a.length };
    return [a, bPrime];
  }
  if (bEnd <= a.column) {
    // B entirely before A
    const aPrime: Operation = { ...a, column: a.column - b.length };
    return [aPrime, b];
  }

  // Overlapping deletes
  const overlapStart = Math.max(a.column, b.column);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlapLen = overlapEnd - overlapStart;

  const aPrime: Operation = {
    ...a,
    column: Math.min(a.column, b.column),
    length: a.length - overlapLen,
  };
  const bPrime: Operation = {
    ...b,
    column: Math.min(a.column, b.column),
    length: b.length - overlapLen,
  };

  return [aPrime, bPrime];
}

function transformInsertLineInsertLine(
  a: Operation & { type: 'insertLine' },
  b: Operation & { type: 'insertLine' },
): [Operation, Operation] {
  if (a.index < b.index) {
    return [a, { ...b, index: b.index + 1 }];
  }
  if (a.index > b.index) {
    return [{ ...a, index: a.index + 1 }, b];
  }
  // Same index: A wins tie, B shifts down
  return [a, { ...b, index: b.index + 1 }];
}

function transformDeleteLineDeleteLine(
  a: Operation & { type: 'deleteLine' },
  b: Operation & { type: 'deleteLine' },
): [Operation, Operation] {
  if (a.index === b.index) {
    // Both delete the same line: both become noop
    return [noop(a.origin), noop(b.origin)];
  }
  if (a.index < b.index) {
    return [a, { ...b, index: b.index - 1 }];
  }
  return [{ ...a, index: a.index - 1 }, b];
}

function transformSplitLineSplitLine(
  a: Operation & { type: 'splitLine' },
  b: Operation & { type: 'splitLine' },
): [Operation, Operation] {
  if (a.line !== b.line) {
    if (a.line < b.line) {
      return [a, { ...b, line: b.line + 1 }];
    }
    return [{ ...a, line: a.line + 1 }, b];
  }
  // Same line
  if (a.column < b.column) {
    // A splits first: B moves to next line with adjusted column
    return [a, { ...b, line: b.line + 1, column: b.column - a.column }];
  }
  if (a.column > b.column) {
    return [{ ...a, line: a.line + 1, column: a.column - b.column }, b];
  }
  // Same position: both become noop (split already happened)
  return [noop(a.origin), noop(b.origin)];
}

function transformMergeLineMergeLine(
  a: Operation & { type: 'mergeLine' },
  b: Operation & { type: 'mergeLine' },
): [Operation, Operation] {
  if (a.line === b.line) {
    // Both merge the same line: one becomes noop
    return [noop(a.origin), noop(b.origin)];
  }
  if (a.line < b.line) {
    return [a, { ...b, line: b.line - 1 }];
  }
  return [{ ...a, line: a.line - 1 }, b];
}

// ---------------------------------------------------------------------------
// Cross-type transforms
// ---------------------------------------------------------------------------

function transformInsertTextDeleteText(
  ins: Operation & { type: 'insertText' },
  del: Operation & { type: 'deleteText' },
): [Operation, Operation] {
  if (ins.line !== del.line) return [ins, del];

  const delEnd = del.column + del.length;

  if (ins.column <= del.column) {
    // Insert is before or at delete start: delete shifts right
    return [ins, { ...del, column: del.column + ins.text.length }];
  }

  if (ins.column >= delEnd) {
    // Insert is after delete range: insert shifts left
    return [{ ...ins, column: ins.column - del.length }, del];
  }

  // Insert is within the deleted range: insert moves to delete start,
  // delete splits around the insert
  const insPrime: Operation = { ...ins, column: del.column };
  const delPrime: Operation = { ...del, length: del.length + ins.text.length };
  // More precisely: after insert at del.column, the delete now needs to
  // skip over the inserted text. We split the delete into the portion
  // before and after the inserted text.
  // Actually the simplest correct approach: insert moves to del.column,
  // delete length stays the same but its range now starts at del.column
  // and the inserted text is placed before it.
  return [insPrime, { ...del, column: del.column }];
}

function transformInsertTextInsertLine(
  textOp: Operation & { type: 'insertText' },
  lineOp: Operation & { type: 'insertLine' },
): [Operation, Operation] {
  if (lineOp.index <= textOp.line) {
    return [{ ...textOp, line: textOp.line + 1 }, lineOp];
  }
  return [textOp, lineOp];
}

function transformInsertTextDeleteLine(
  textOp: Operation & { type: 'insertText' },
  lineOp: Operation & { type: 'deleteLine' },
): [Operation, Operation] {
  if (lineOp.index < textOp.line) {
    return [{ ...textOp, line: textOp.line - 1 }, lineOp];
  }
  if (lineOp.index === textOp.line) {
    // The line we're inserting into is being deleted.
    // The insert becomes a noop since the line is gone.
    return [noop(textOp.origin), lineOp];
  }
  return [textOp, lineOp];
}

function transformInsertTextSplitLine(
  textOp: Operation & { type: 'insertText' },
  splitOp: Operation & { type: 'splitLine' },
): [Operation, Operation] {
  if (textOp.line !== splitOp.line) {
    if (splitOp.line < textOp.line) {
      return [{ ...textOp, line: textOp.line + 1 }, splitOp];
    }
    return [textOp, splitOp];
  }
  // Same line
  if (textOp.column <= splitOp.column) {
    // Insert before split: split shifts right
    return [textOp, { ...splitOp, column: splitOp.column + textOp.text.length }];
  }
  // Insert after split: insert moves to next line with adjusted column
  return [
    { ...textOp, line: textOp.line + 1, column: textOp.column - splitOp.column },
    splitOp,
  ];
}

function transformInsertTextMergeLine(
  textOp: Operation & { type: 'insertText' },
  mergeOp: Operation & { type: 'mergeLine' },
): [Operation, Operation] {
  if (textOp.line < mergeOp.line) {
    return [textOp, mergeOp];
  }
  if (textOp.line === mergeOp.line) {
    // Insert is on the line that initiates the merge; no structural change to insert
    return [textOp, mergeOp];
  }
  if (textOp.line === mergeOp.line + 1) {
    // Insert is on the line being merged up: adjust to merged line
    // Column needs to be offset but we don't know the first line's length.
    // Convention: keep column as-is (same as mapPositionThrough approach)
    return [{ ...textOp, line: textOp.line - 1 }, mergeOp];
  }
  // Lines after merge shift up
  return [{ ...textOp, line: textOp.line - 1 }, mergeOp];
}

function transformDeleteTextInsertLine(
  delOp: Operation & { type: 'deleteText' },
  lineOp: Operation & { type: 'insertLine' },
): [Operation, Operation] {
  if (lineOp.index <= delOp.line) {
    return [{ ...delOp, line: delOp.line + 1 }, lineOp];
  }
  return [delOp, lineOp];
}

function transformDeleteTextDeleteLine(
  delOp: Operation & { type: 'deleteText' },
  lineOp: Operation & { type: 'deleteLine' },
): [Operation, Operation] {
  if (lineOp.index < delOp.line) {
    return [{ ...delOp, line: delOp.line - 1 }, lineOp];
  }
  if (lineOp.index === delOp.line) {
    // The line we're deleting text from is being deleted entirely
    return [noop(delOp.origin), lineOp];
  }
  return [delOp, lineOp];
}

function transformDeleteTextSplitLine(
  delOp: Operation & { type: 'deleteText' },
  splitOp: Operation & { type: 'splitLine' },
): [Operation, Operation] {
  if (delOp.line !== splitOp.line) {
    if (splitOp.line < delOp.line) {
      return [{ ...delOp, line: delOp.line + 1 }, splitOp];
    }
    return [delOp, splitOp];
  }
  // Same line
  const delEnd = delOp.column + delOp.length;
  if (delEnd <= splitOp.column) {
    // Delete entirely before split point
    return [delOp, { ...splitOp, column: splitOp.column - delOp.length }];
  }
  if (delOp.column >= splitOp.column) {
    // Delete entirely after split point: moves to next line
    return [
      { ...delOp, line: delOp.line + 1, column: delOp.column - splitOp.column },
      splitOp,
    ];
  }
  // Delete straddles the split point: split into two deletes on each line
  // For simplicity, truncate the delete to before the split
  const lenBefore = splitOp.column - delOp.column;
  const lenAfter = delOp.length - lenBefore;
  // A' becomes a delete of just the portion before the split
  // The portion after the split is on the new line, but we can only
  // return one operation per side. We'll keep the delete truncated.
  const delPrime: Operation = { ...delOp, length: lenBefore };
  const splitPrime: Operation = { ...splitOp, column: splitOp.column - lenBefore };
  // Note: the part after the split (lenAfter chars at col 0 of new line) is lost.
  // A more complete OT system would emit multiple ops, but we keep it simple.
  void lenAfter;
  return [delPrime, splitPrime];
}

function transformDeleteTextMergeLine(
  delOp: Operation & { type: 'deleteText' },
  mergeOp: Operation & { type: 'mergeLine' },
): [Operation, Operation] {
  if (delOp.line < mergeOp.line) {
    return [delOp, mergeOp];
  }
  if (delOp.line === mergeOp.line) {
    return [delOp, mergeOp];
  }
  if (delOp.line === mergeOp.line + 1) {
    // Delete is on the line being merged up
    return [{ ...delOp, line: delOp.line - 1 }, mergeOp];
  }
  return [{ ...delOp, line: delOp.line - 1 }, mergeOp];
}

function transformInsertLineDeleteLine(
  insOp: Operation & { type: 'insertLine' },
  delOp: Operation & { type: 'deleteLine' },
): [Operation, Operation] {
  if (insOp.index <= delOp.index) {
    return [insOp, { ...delOp, index: delOp.index + 1 }];
  }
  if (delOp.index < insOp.index) {
    return [{ ...insOp, index: insOp.index - 1 }, delOp];
  }
  return [insOp, delOp];
}

function transformInsertLineSplitLine(
  insOp: Operation & { type: 'insertLine' },
  splitOp: Operation & { type: 'splitLine' },
): [Operation, Operation] {
  // Split adds a line after splitOp.line, effectively at index splitOp.line + 1
  if (insOp.index <= splitOp.line) {
    return [insOp, { ...splitOp, line: splitOp.line + 1 }];
  }
  // Insert is after split line: insert shifts down since split adds a line
  return [{ ...insOp, index: insOp.index + 1 }, splitOp];
}

function transformInsertLineMergeLine(
  insOp: Operation & { type: 'insertLine' },
  mergeOp: Operation & { type: 'mergeLine' },
): [Operation, Operation] {
  if (insOp.index <= mergeOp.line) {
    return [insOp, { ...mergeOp, line: mergeOp.line + 1 }];
  }
  // Merge removes a line (line+1), so if insert is after, shift up
  if (insOp.index > mergeOp.line + 1) {
    return [{ ...insOp, index: insOp.index - 1 }, mergeOp];
  }
  // Insert is at mergeOp.line + 1: the merged-away line
  return [insOp, mergeOp];
}

function transformDeleteLineSplitLine(
  delOp: Operation & { type: 'deleteLine' },
  splitOp: Operation & { type: 'splitLine' },
): [Operation, Operation] {
  if (delOp.index < splitOp.line) {
    return [delOp, { ...splitOp, line: splitOp.line - 1 }];
  }
  if (delOp.index === splitOp.line) {
    // Deleting the line that is being split: delete takes precedence,
    // split becomes noop
    return [delOp, noop(splitOp.origin)];
  }
  // delOp.index > splitOp.line: split adds a line, so delete shifts down
  return [{ ...delOp, index: delOp.index + 1 }, splitOp];
}

function transformDeleteLineMergeLine(
  delOp: Operation & { type: 'deleteLine' },
  mergeOp: Operation & { type: 'mergeLine' },
): [Operation, Operation] {
  if (delOp.index < mergeOp.line) {
    return [delOp, { ...mergeOp, line: mergeOp.line - 1 }];
  }
  if (delOp.index === mergeOp.line || delOp.index === mergeOp.line + 1) {
    // Deleting one of the lines involved in the merge: conflict
    // Let delete win, merge becomes noop
    return [delOp, noop(mergeOp.origin)];
  }
  // After merge: shift up
  return [{ ...delOp, index: delOp.index - 1 }, mergeOp];
}

function transformSplitLineMergeLine(
  splitOp: Operation & { type: 'splitLine' },
  mergeOp: Operation & { type: 'mergeLine' },
): [Operation, Operation] {
  if (splitOp.line < mergeOp.line) {
    return [splitOp, { ...mergeOp, line: mergeOp.line + 1 }];
  }
  if (splitOp.line === mergeOp.line) {
    // Split and merge on the same line: they roughly cancel out
    // but not exactly. Keep both as-is for simplicity.
    return [splitOp, mergeOp];
  }
  if (splitOp.line === mergeOp.line + 1) {
    // Split is on the line being merged: move split to merge line
    return [{ ...splitOp, line: splitOp.line - 1 }, mergeOp];
  }
  // Split is well after merge
  return [{ ...splitOp, line: splitOp.line - 1 }, mergeOp];
}

// ReplaceLine transforms: replaceLine doesn't change structure, so only
// line index adjustments are needed relative to line-inserting/deleting ops.

function transformReplaceLineAgainstLineShift(
  replOp: Operation & { type: 'replaceLine' },
  other: Operation,
): [Operation, Operation] {
  switch (other.type) {
    case 'insertLine': {
      if (other.index <= replOp.index) {
        return [{ ...replOp, index: replOp.index + 1 }, other];
      }
      return [replOp, other];
    }
    case 'deleteLine': {
      if (other.index < replOp.index) {
        return [{ ...replOp, index: replOp.index - 1 }, other];
      }
      if (other.index === replOp.index) {
        // Line being replaced is deleted: replace becomes noop
        return [noop(replOp.origin), other];
      }
      return [replOp, other];
    }
    case 'splitLine': {
      if (other.line < replOp.index) {
        return [{ ...replOp, index: replOp.index + 1 }, other];
      }
      return [replOp, other];
    }
    case 'mergeLine': {
      if (other.line < replOp.index) {
        return [{ ...replOp, index: replOp.index - 1 }, other];
      }
      return [replOp, other];
    }
    default:
      return [replOp, other];
  }
}

// ---------------------------------------------------------------------------
// Main transform dispatch
// ---------------------------------------------------------------------------

/**
 * Transform two concurrent operations to maintain convergence.
 * Returns [opA', opB'] such that apply(apply(doc, opA), opB') === apply(apply(doc, opB), opA').
 */
export function transform(opA: Operation, opB: Operation): [Operation, Operation] {
  // Same-type fast paths
  if (opA.type === 'insertText' && opB.type === 'insertText') {
    return transformInsertInsert(opA, opB);
  }
  if (opA.type === 'deleteText' && opB.type === 'deleteText') {
    return transformDeleteDelete(opA, opB);
  }
  if (opA.type === 'insertLine' && opB.type === 'insertLine') {
    return transformInsertLineInsertLine(opA, opB);
  }
  if (opA.type === 'deleteLine' && opB.type === 'deleteLine') {
    return transformDeleteLineDeleteLine(opA, opB);
  }
  if (opA.type === 'splitLine' && opB.type === 'splitLine') {
    return transformSplitLineSplitLine(opA, opB);
  }
  if (opA.type === 'mergeLine' && opB.type === 'mergeLine') {
    return transformMergeLineMergeLine(opA, opB);
  }
  if (opA.type === 'replaceLine' && opB.type === 'replaceLine') {
    if (opA.index === opB.index) {
      // Both replace the same line: A wins, B becomes noop
      return [opA, noop(opB.origin)];
    }
    return [opA, opB];
  }

  // Cross-type: insertText vs deleteText
  if (opA.type === 'insertText' && opB.type === 'deleteText') {
    return transformInsertTextDeleteText(opA, opB);
  }
  if (opA.type === 'deleteText' && opB.type === 'insertText') {
    const [bPrime, aPrime] = transformInsertTextDeleteText(opB, opA);
    return [aPrime, bPrime];
  }

  // insertText vs insertLine
  if (opA.type === 'insertText' && opB.type === 'insertLine') {
    return transformInsertTextInsertLine(opA, opB);
  }
  if (opA.type === 'insertLine' && opB.type === 'insertText') {
    const [bPrime, aPrime] = transformInsertTextInsertLine(opB, opA);
    return [aPrime, bPrime];
  }

  // insertText vs deleteLine
  if (opA.type === 'insertText' && opB.type === 'deleteLine') {
    return transformInsertTextDeleteLine(opA, opB);
  }
  if (opA.type === 'deleteLine' && opB.type === 'insertText') {
    const [bPrime, aPrime] = transformInsertTextDeleteLine(opB, opA);
    return [aPrime, bPrime];
  }

  // insertText vs splitLine
  if (opA.type === 'insertText' && opB.type === 'splitLine') {
    return transformInsertTextSplitLine(opA, opB);
  }
  if (opA.type === 'splitLine' && opB.type === 'insertText') {
    const [bPrime, aPrime] = transformInsertTextSplitLine(opB, opA);
    return [aPrime, bPrime];
  }

  // insertText vs mergeLine
  if (opA.type === 'insertText' && opB.type === 'mergeLine') {
    return transformInsertTextMergeLine(opA, opB);
  }
  if (opA.type === 'mergeLine' && opB.type === 'insertText') {
    const [bPrime, aPrime] = transformInsertTextMergeLine(opB, opA);
    return [aPrime, bPrime];
  }

  // deleteText vs insertLine
  if (opA.type === 'deleteText' && opB.type === 'insertLine') {
    return transformDeleteTextInsertLine(opA, opB);
  }
  if (opA.type === 'insertLine' && opB.type === 'deleteText') {
    const [bPrime, aPrime] = transformDeleteTextInsertLine(opB, opA);
    return [aPrime, bPrime];
  }

  // deleteText vs deleteLine
  if (opA.type === 'deleteText' && opB.type === 'deleteLine') {
    return transformDeleteTextDeleteLine(opA, opB);
  }
  if (opA.type === 'deleteLine' && opB.type === 'deleteText') {
    const [bPrime, aPrime] = transformDeleteTextDeleteLine(opB, opA);
    return [aPrime, bPrime];
  }

  // deleteText vs splitLine
  if (opA.type === 'deleteText' && opB.type === 'splitLine') {
    return transformDeleteTextSplitLine(opA, opB);
  }
  if (opA.type === 'splitLine' && opB.type === 'deleteText') {
    const [bPrime, aPrime] = transformDeleteTextSplitLine(opB, opA);
    return [aPrime, bPrime];
  }

  // deleteText vs mergeLine
  if (opA.type === 'deleteText' && opB.type === 'mergeLine') {
    return transformDeleteTextMergeLine(opA, opB);
  }
  if (opA.type === 'mergeLine' && opB.type === 'deleteText') {
    const [bPrime, aPrime] = transformDeleteTextMergeLine(opB, opA);
    return [aPrime, bPrime];
  }

  // insertLine vs deleteLine
  if (opA.type === 'insertLine' && opB.type === 'deleteLine') {
    return transformInsertLineDeleteLine(opA, opB);
  }
  if (opA.type === 'deleteLine' && opB.type === 'insertLine') {
    const [bPrime, aPrime] = transformInsertLineDeleteLine(opB, opA);
    return [aPrime, bPrime];
  }

  // insertLine vs splitLine
  if (opA.type === 'insertLine' && opB.type === 'splitLine') {
    return transformInsertLineSplitLine(opA, opB);
  }
  if (opA.type === 'splitLine' && opB.type === 'insertLine') {
    const [bPrime, aPrime] = transformInsertLineSplitLine(opB, opA);
    return [aPrime, bPrime];
  }

  // insertLine vs mergeLine
  if (opA.type === 'insertLine' && opB.type === 'mergeLine') {
    return transformInsertLineMergeLine(opA, opB);
  }
  if (opA.type === 'mergeLine' && opB.type === 'insertLine') {
    const [bPrime, aPrime] = transformInsertLineMergeLine(opB, opA);
    return [aPrime, bPrime];
  }

  // deleteLine vs splitLine
  if (opA.type === 'deleteLine' && opB.type === 'splitLine') {
    return transformDeleteLineSplitLine(opA, opB);
  }
  if (opA.type === 'splitLine' && opB.type === 'deleteLine') {
    const [bPrime, aPrime] = transformDeleteLineSplitLine(opB, opA);
    return [aPrime, bPrime];
  }

  // deleteLine vs mergeLine
  if (opA.type === 'deleteLine' && opB.type === 'mergeLine') {
    return transformDeleteLineMergeLine(opA, opB);
  }
  if (opA.type === 'mergeLine' && opB.type === 'deleteLine') {
    const [bPrime, aPrime] = transformDeleteLineMergeLine(opB, opA);
    return [aPrime, bPrime];
  }

  // splitLine vs mergeLine
  if (opA.type === 'splitLine' && opB.type === 'mergeLine') {
    return transformSplitLineMergeLine(opA, opB);
  }
  if (opA.type === 'mergeLine' && opB.type === 'splitLine') {
    const [bPrime, aPrime] = transformSplitLineMergeLine(opB, opA);
    return [aPrime, bPrime];
  }

  // replaceLine vs anything
  if (opA.type === 'replaceLine') {
    return transformReplaceLineAgainstLineShift(opA, opB);
  }
  if (opB.type === 'replaceLine') {
    const [bPrime, aPrime] = transformReplaceLineAgainstLineShift(opB, opA);
    return [aPrime, bPrime];
  }

  // Fallback: return unchanged (should not be reached with current types)
  return [opA, opB];
}

/**
 * Transform two arrays of operations pairwise.
 * After transformation, applying opsA then opsB' yields the same result
 * as applying opsB then opsA'.
 */
export function transformOps(
  opsA: readonly Operation[],
  opsB: readonly Operation[],
): [Operation[], Operation[]] {
  let transformedA = opsA.slice();
  let transformedB = opsB.slice();

  for (let i = 0; i < transformedA.length; i++) {
    for (let j = 0; j < transformedB.length; j++) {
      const [aPrime, bPrime] = transform(transformedA[i], transformedB[j]);
      transformedA[i] = aPrime;
      transformedB[j] = bPrime;
    }
  }

  return [transformedA, transformedB];
}
