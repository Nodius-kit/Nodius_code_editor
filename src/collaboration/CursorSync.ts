import type { Position, Operation, RemoteCursor } from '../core/types';

/**
 * Map a position through a single operation, adjusting for structural
 * document changes. This mirrors the logic in Selection.ts but operates
 * on a mutable position for cursor tracking.
 */
function mapPositionThrough(pos: Position, op: Operation): Position {
  switch (op.type) {
    case 'insertText': {
      if (pos.line !== op.line) return pos;
      if (pos.column < op.column) return pos;
      return { line: pos.line, column: pos.column + op.text.length };
    }

    case 'deleteText': {
      if (pos.line !== op.line) return pos;
      if (pos.column <= op.column) return pos;
      const deleteEnd = op.column + op.length;
      if (pos.column >= deleteEnd) {
        return { line: pos.line, column: pos.column - op.length };
      }
      // Position is within deleted range: clamp to delete start
      return { line: pos.line, column: op.column };
    }

    case 'insertLine': {
      if (pos.line < op.index) return pos;
      return { line: pos.line + 1, column: pos.column };
    }

    case 'deleteLine': {
      if (pos.line < op.index) return pos;
      if (pos.line === op.index) {
        return { line: Math.max(0, pos.line - 1), column: 0 };
      }
      return { line: pos.line - 1, column: pos.column };
    }

    case 'splitLine': {
      if (pos.line < op.line) return pos;
      if (pos.line === op.line) {
        if (pos.column <= op.column) return pos;
        // After split point: moves to next line with adjusted column
        return { line: pos.line + 1, column: pos.column - op.column };
      }
      // Lines after split shift down
      return { line: pos.line + 1, column: pos.column };
    }

    case 'mergeLine': {
      if (pos.line < op.line) return pos;
      if (pos.line === op.line) return pos;
      if (pos.line === op.line + 1) {
        // This line is being merged into the previous one.
        // Without knowing the length of the previous line, we keep
        // the column as-is (same convention as the Selection module).
        return { line: op.line, column: pos.column };
      }
      // Lines after the merge shift up
      return { line: pos.line - 1, column: pos.column };
    }

    case 'replaceLine': {
      // replaceLine does not change structure
      return pos;
    }

    default:
      return pos;
  }
}

/**
 * Manages remote cursor positions for collaborative editing.
 * Tracks where other users' cursors are and adjusts their positions
 * as local or remote operations modify the document.
 */
export class CursorSync {
  private cursors: Map<string, RemoteCursor> = new Map();

  /**
   * Update or create a remote cursor for the given user.
   */
  updateRemoteCursor(
    userId: string,
    position: Position,
    color: string,
    name?: string,
  ): void {
    const cursor: RemoteCursor = { userId, position, color };
    if (name !== undefined) {
      (cursor as { name?: string }).name = name;
    }
    this.cursors.set(userId, cursor);
  }

  /**
   * Remove a remote cursor (e.g., when a user disconnects).
   */
  removeRemoteCursor(userId: string): void {
    this.cursors.delete(userId);
  }

  /**
   * Returns all currently tracked remote cursors.
   */
  getCursors(): RemoteCursor[] {
    return Array.from(this.cursors.values());
  }

  /**
   * Returns a specific user's cursor, or undefined if not tracked.
   */
  getCursor(userId: string): RemoteCursor | undefined {
    return this.cursors.get(userId);
  }

  /**
   * Adjust all remote cursor positions through a sequence of operations.
   * This should be called whenever operations are applied to the document
   * so that cursors remain accurate.
   */
  mapCursorsThroughOps(ops: readonly Operation[]): void {
    for (const [userId, cursor] of this.cursors) {
      let position = cursor.position;
      for (const op of ops) {
        position = mapPositionThrough(position, op);
      }
      if (position !== cursor.position) {
        this.cursors.set(userId, { ...cursor, position });
      }
    }
  }

  /**
   * Remove all tracked cursors.
   */
  clear(): void {
    this.cursors.clear();
  }
}
