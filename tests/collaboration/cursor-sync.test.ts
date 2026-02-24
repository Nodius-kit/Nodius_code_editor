import { describe, it, expect } from 'vitest';
import { CursorSync } from '../../src/collaboration/CursorSync';
import type { Operation } from '../../src/core/types';

describe('CursorSync', () => {
  it('updateRemoteCursor adds a cursor', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');

    const cursors = sync.getCursors();
    expect(cursors).toHaveLength(1);
    expect(cursors[0].userId).toBe('user1');
    expect(cursors[0].position).toEqual({ line: 0, column: 5 });
    expect(cursors[0].color).toBe('#ff0000');
  });

  it('updateRemoteCursor updates an existing cursor', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');
    sync.updateRemoteCursor('user1', { line: 2, column: 10 }, '#ff0000');

    const cursors = sync.getCursors();
    expect(cursors).toHaveLength(1);
    expect(cursors[0].position).toEqual({ line: 2, column: 10 });
  });

  it('updateRemoteCursor stores name when provided', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 0 }, '#ff0000', 'Alice');

    const cursor = sync.getCursor('user1');
    expect(cursor).toBeDefined();
    expect(cursor!.name).toBe('Alice');
  });

  it('removeRemoteCursor removes a cursor', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');
    sync.updateRemoteCursor('user2', { line: 1, column: 3 }, '#00ff00');

    sync.removeRemoteCursor('user1');

    const cursors = sync.getCursors();
    expect(cursors).toHaveLength(1);
    expect(cursors[0].userId).toBe('user2');
  });

  it('removeRemoteCursor is a no-op for unknown user', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');
    sync.removeRemoteCursor('unknown');

    expect(sync.getCursors()).toHaveLength(1);
  });

  it('getCursors returns all cursors', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');
    sync.updateRemoteCursor('user2', { line: 1, column: 3 }, '#00ff00');
    sync.updateRemoteCursor('user3', { line: 2, column: 8 }, '#0000ff');

    const cursors = sync.getCursors();
    expect(cursors).toHaveLength(3);

    const userIds = cursors.map((c) => c.userId);
    expect(userIds).toContain('user1');
    expect(userIds).toContain('user2');
    expect(userIds).toContain('user3');
  });

  it('getCursors returns empty array when no cursors exist', () => {
    const sync = new CursorSync();
    expect(sync.getCursors()).toEqual([]);
  });

  it('getCursor returns specific cursor or undefined', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');

    expect(sync.getCursor('user1')).toBeDefined();
    expect(sync.getCursor('unknown')).toBeUndefined();
  });

  describe('mapCursorsThroughOps', () => {
    it('adjusts cursor position for insertText on same line after cursor', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 0, column: 10 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 5, text: 'XX', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      expect(cursor!.position).toEqual({ line: 0, column: 12 });
    });

    it('does not adjust cursor for insertText on same line before cursor column', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 0, column: 2 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 5, text: 'XX', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      expect(cursor!.position).toEqual({ line: 0, column: 2 });
    });

    it('does not adjust cursor for insertText on different line', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 3, column: 5 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'XX', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      expect(cursor!.position).toEqual({ line: 3, column: 5 });
    });

    it('adjusts cursor position for insertLine before cursor line', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 3, column: 5 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'insertLine', index: 1, text: 'new line', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      expect(cursor!.position).toEqual({ line: 4, column: 5 });
    });

    it('does not adjust cursor for insertLine after cursor line', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 1, column: 5 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'insertLine', index: 5, text: 'new line', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      expect(cursor!.position).toEqual({ line: 1, column: 5 });
    });

    it('adjusts cursor position for deleteLine before cursor', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 5, column: 3 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'deleteLine', index: 2, origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      expect(cursor!.position).toEqual({ line: 4, column: 3 });
    });

    it('adjusts cursor position for deleteText that includes cursor', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'deleteText', line: 0, column: 3, length: 5, origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      // cursor is within the deleted range, clamped to delete start
      expect(cursor!.position).toEqual({ line: 0, column: 3 });
    });

    it('handles multiple operations sequentially', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');

      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 0, text: 'AA', origin: 'input' },
        { type: 'insertText', line: 0, column: 10, text: 'BB', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      const cursor = sync.getCursor('user1');
      // First op inserts 2 chars before column 5 -> column becomes 7
      // Second op inserts 2 chars at column 10 which is after 7 -> stays 7
      expect(cursor!.position).toEqual({ line: 0, column: 7 });
    });

    it('adjusts multiple cursors simultaneously', () => {
      const sync = new CursorSync();
      sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');
      sync.updateRemoteCursor('user2', { line: 0, column: 10 }, '#00ff00');

      const ops: Operation[] = [
        { type: 'insertText', line: 0, column: 3, text: 'XX', origin: 'input' },
      ];

      sync.mapCursorsThroughOps(ops);

      expect(sync.getCursor('user1')!.position).toEqual({ line: 0, column: 7 });
      expect(sync.getCursor('user2')!.position).toEqual({ line: 0, column: 12 });
    });
  });

  it('clear removes all cursors', () => {
    const sync = new CursorSync();

    sync.updateRemoteCursor('user1', { line: 0, column: 5 }, '#ff0000');
    sync.updateRemoteCursor('user2', { line: 1, column: 3 }, '#00ff00');
    sync.updateRemoteCursor('user3', { line: 2, column: 8 }, '#0000ff');

    sync.clear();

    expect(sync.getCursors()).toEqual([]);
    expect(sync.getCursor('user1')).toBeUndefined();
    expect(sync.getCursor('user2')).toBeUndefined();
    expect(sync.getCursor('user3')).toBeUndefined();
  });
});
