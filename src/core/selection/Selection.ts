import type { Position, Range, MultiSelection, Operation } from '../types';

export function createPosition(line: number, column: number): Position {
  return { line, column };
}

export function createRange(anchor: Position, focus: Position): Range {
  return { anchor, focus };
}

export function createCollapsedRange(pos: Position): Range {
  return { anchor: pos, focus: pos };
}

export function createSelection(ranges?: Range[]): MultiSelection {
  if (ranges && ranges.length > 0) {
    return { ranges, primary: 0 };
  }
  const defaultRange = createCollapsedRange(createPosition(0, 0));
  return { ranges: [defaultRange], primary: 0 };
}

export function isCollapsed(range: Range): boolean {
  return (
    range.anchor.line === range.focus.line &&
    range.anchor.column === range.focus.column
  );
}

export function isSelectionCollapsed(sel: MultiSelection): boolean {
  return sel.ranges.every(isCollapsed);
}

function rangeStart(range: Range): Position {
  if (
    range.anchor.line < range.focus.line ||
    (range.anchor.line === range.focus.line && range.anchor.column <= range.focus.column)
  ) {
    return range.anchor;
  }
  return range.focus;
}

function rangeEnd(range: Range): Position {
  if (
    range.anchor.line > range.focus.line ||
    (range.anchor.line === range.focus.line && range.anchor.column >= range.focus.column)
  ) {
    return range.anchor;
  }
  return range.focus;
}

export function rangeContains(range: Range, pos: Position): boolean {
  const start = rangeStart(range);
  const end = rangeEnd(range);

  if (pos.line < start.line || pos.line > end.line) return false;
  if (pos.line === start.line && pos.column < start.column) return false;
  if (pos.line === end.line && pos.column > end.column) return false;
  return true;
}

export function mapPositionThrough(pos: Position, op: Operation): Position {
  switch (op.type) {
    case 'insertText': {
      if (pos.line !== op.line) return pos;
      if (pos.column < op.column) return pos;
      return createPosition(pos.line, pos.column + op.text.length);
    }

    case 'deleteText': {
      if (pos.line !== op.line) return pos;
      if (pos.column <= op.column) return pos;
      const deleteEnd = op.column + op.length;
      if (pos.column >= deleteEnd) {
        return createPosition(pos.line, pos.column - op.length);
      }
      // Position is within the deleted range; clamp to delete start
      return createPosition(pos.line, op.column);
    }

    case 'insertLine': {
      if (pos.line < op.index) return pos;
      return createPosition(pos.line + 1, pos.column);
    }

    case 'deleteLine': {
      if (pos.line < op.index) return pos;
      if (pos.line === op.index) {
        // Line was deleted; move to start of same index (now the next line)
        return createPosition(Math.max(0, op.index), 0);
      }
      return createPosition(pos.line - 1, pos.column);
    }

    case 'splitLine': {
      if (pos.line < op.line) return pos;
      if (pos.line === op.line) {
        if (pos.column <= op.column) return pos;
        // Position is after the split point; moves to next line
        return createPosition(pos.line + 1, pos.column - op.column);
      }
      // Lines after the split shift down by one
      return createPosition(pos.line + 1, pos.column);
    }

    case 'mergeLine': {
      if (pos.line < op.line) return pos;
      if (pos.line === op.line) return pos;
      if (pos.line === op.line + 1) {
        // This line is being merged into the previous one.
        // We need the length of the line at op.line, but we don't have the document here.
        // Convention: column is offset by the merge point. We use op as-is.
        // The merge joins line[op.line] + line[op.line+1], so the column
        // on the merged-away line needs to be shifted by the length of line[op.line].
        // Since we don't have that info, we store the column offset marker.
        // Practical approach: we cannot know the exact column without document context,
        // so we return the position moved up with column unchanged. The caller or a
        // higher-level function should adjust if needed.
        // However, following the spec "adjust column" - the standard convention is:
        // the column on the next line gets shifted right by the length of the current line.
        // Without that info here, we just move the line up.
        return createPosition(op.line, pos.column);
      }
      // Lines after the merged pair shift up by one
      return createPosition(pos.line - 1, pos.column);
    }

    case 'replaceLine': {
      // replaceLine does not change line count or positions structurally
      return pos;
    }

    default:
      return pos;
  }
}

export function mapRangeThrough(range: Range, op: Operation): Range {
  return createRange(
    mapPositionThrough(range.anchor, op),
    mapPositionThrough(range.focus, op),
  );
}

export function mapSelectionThrough(sel: MultiSelection, op: Operation): MultiSelection {
  return {
    ranges: sel.ranges.map((r) => mapRangeThrough(r, op)),
    primary: sel.primary,
  };
}

export function mapSelectionThroughOps(
  sel: MultiSelection,
  ops: readonly Operation[],
): MultiSelection {
  return ops.reduce<MultiSelection>((s, op) => mapSelectionThrough(s, op), sel);
}
