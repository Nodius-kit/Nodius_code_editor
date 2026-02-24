import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryManager } from '../../src/core/history/HistoryManager';
import type { HistoryEntry } from '../../src/core/types';
import { createDocument } from '../../src/core/document/Document';
import { createSelection } from '../../src/core/selection/Selection';

function makeEntry(overrides?: Partial<HistoryEntry>): HistoryEntry {
  return {
    doc: createDocument('test'),
    selection: createSelection(),
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('HistoryManager', () => {
  describe('pushState', () => {
    it('adds an entry to the undo stack', () => {
      const manager = new HistoryManager();
      const entry = makeEntry();

      // Push with enough time gap to avoid batching
      vi.spyOn(Date, 'now').mockReturnValue(0);
      manager.pushState(entry);

      expect(manager.canUndo()).toBe(true);
    });

    it('clears the redo stack when a new state is pushed', () => {
      const manager = new HistoryManager();
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      manager.pushState(makeEntry());
      manager.pushState(makeEntry());

      // Undo to put something on the redo stack
      manager.undo();
      expect(manager.canRedo()).toBe(false); // redo stack doesn't automatically get entries from undo

      // Actually let's test recordForRedo manually
      manager.recordForRedo(makeEntry());
      expect(manager.canRedo()).toBe(true);

      // Now push a new state -- it should clear the redo stack
      manager.pushState(makeEntry());
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('returns the last pushed state', () => {
      const manager = new HistoryManager();
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      const entry1 = makeEntry();
      const entry2 = makeEntry();
      manager.pushState(entry1);
      manager.pushState(entry2);

      const result = manager.undo();
      expect(result).toBe(entry2);
    });

    it('returns undefined when the undo stack is empty', () => {
      const manager = new HistoryManager();
      expect(manager.undo()).toBeUndefined();
    });
  });

  describe('redo', () => {
    it('returns the last entry added via recordForRedo', () => {
      const manager = new HistoryManager();
      const entry = makeEntry();
      manager.recordForRedo(entry);

      const result = manager.redo();
      expect(result).toBe(entry);
    });

    it('returns undefined when the redo stack is empty', () => {
      const manager = new HistoryManager();
      expect(manager.redo()).toBeUndefined();
    });
  });

  describe('canUndo / canRedo', () => {
    it('canUndo returns false when undo stack is empty', () => {
      const manager = new HistoryManager();
      expect(manager.canUndo()).toBe(false);
    });

    it('canUndo returns true when undo stack has entries', () => {
      const manager = new HistoryManager();
      vi.spyOn(Date, 'now').mockReturnValue(0);
      manager.pushState(makeEntry());
      expect(manager.canUndo()).toBe(true);
    });

    it('canRedo returns false when redo stack is empty', () => {
      const manager = new HistoryManager();
      expect(manager.canRedo()).toBe(false);
    });

    it('canRedo returns true when redo stack has entries', () => {
      const manager = new HistoryManager();
      manager.recordForRedo(makeEntry());
      expect(manager.canRedo()).toBe(true);
    });
  });

  describe('batching', () => {
    it('replaces top of undo stack for rapid pushes within batchDelay', () => {
      const manager = new HistoryManager(100, 500);

      // All pushes happen at the "same" time (within 500ms)
      vi.spyOn(Date, 'now').mockReturnValue(1000);

      const entry1 = makeEntry();
      manager.pushState(entry1);

      // Push again within the batch delay -- should replace, not add
      const entry2 = makeEntry();
      manager.pushState(entry2);

      const entry3 = makeEntry();
      manager.pushState(entry3);

      // Only one entry should be on the undo stack (the last one replaces)
      const result1 = manager.undo();
      expect(result1).toBe(entry3);

      // Undo again should return undefined since only one entry was on the stack
      const result2 = manager.undo();
      expect(result2).toBeUndefined();
    });

    it('pushes a new entry when time exceeds batchDelay', () => {
      const manager = new HistoryManager(100, 500);
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000; // each call 1 second apart, exceeding the 500ms batch delay
        return time;
      });

      const entry1 = makeEntry();
      const entry2 = makeEntry();
      manager.pushState(entry1);
      manager.pushState(entry2);

      // Both should be on the stack
      const result2 = manager.undo();
      expect(result2).toBe(entry2);

      const result1 = manager.undo();
      expect(result1).toBe(entry1);
    });
  });

  describe('clear', () => {
    it('resets both undo and redo stacks', () => {
      const manager = new HistoryManager();
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      manager.pushState(makeEntry());
      manager.pushState(makeEntry());
      manager.recordForRedo(makeEntry());

      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(true);

      manager.clear();

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('recordForUndo / recordForRedo', () => {
    it('recordForUndo adds an entry to the undo stack', () => {
      const manager = new HistoryManager();
      const entry = makeEntry();
      manager.recordForUndo(entry);

      expect(manager.canUndo()).toBe(true);
      const result = manager.undo();
      expect(result).toBe(entry);
    });

    it('recordForRedo adds an entry to the redo stack', () => {
      const manager = new HistoryManager();
      const entry = makeEntry();
      manager.recordForRedo(entry);

      expect(manager.canRedo()).toBe(true);
      const result = manager.redo();
      expect(result).toBe(entry);
    });

    it('recordForUndo respects maxSize', () => {
      const manager = new HistoryManager(2, 500);

      const entry1 = makeEntry();
      const entry2 = makeEntry();
      const entry3 = makeEntry();

      manager.recordForUndo(entry1);
      manager.recordForUndo(entry2);
      manager.recordForUndo(entry3);

      // Only the last 2 should remain (maxSize = 2)
      const result1 = manager.undo();
      expect(result1).toBe(entry3);

      const result2 = manager.undo();
      expect(result2).toBe(entry2);

      const result3 = manager.undo();
      expect(result3).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('maxSize=1 only keeps last entry', () => {
      const manager = new HistoryManager(1, 0);
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      const entry1 = makeEntry();
      const entry2 = makeEntry();
      const entry3 = makeEntry();

      manager.pushState(entry1);
      manager.pushState(entry2);
      manager.pushState(entry3);

      const result1 = manager.undo();
      expect(result1).toBe(entry3);

      const result2 = manager.undo();
      expect(result2).toBeUndefined();
    });

    it('rapid push within batchDelay followed by push after delay', () => {
      const manager = new HistoryManager(100, 500);
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => time);

      // Push three entries rapidly (same timestamp)
      time = 1000;
      const rapid1 = makeEntry();
      manager.pushState(rapid1);

      time = 1100; // within 500ms batch delay
      const rapid2 = makeEntry();
      manager.pushState(rapid2);

      time = 1200; // still within batch delay of last push
      const rapid3 = makeEntry();
      manager.pushState(rapid3);

      // Now push after the batch delay
      time = 2000; // 800ms after last push, exceeds 500ms batchDelay
      const delayed = makeEntry();
      manager.pushState(delayed);

      // Should have 2 entries: the batched one (rapid3) and the delayed one
      const result1 = manager.undo();
      expect(result1).toBe(delayed);

      const result2 = manager.undo();
      expect(result2).toBe(rapid3);

      const result3 = manager.undo();
      expect(result3).toBeUndefined();
    });

    it('undo past the beginning returns undefined repeatedly', () => {
      const manager = new HistoryManager();
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      manager.pushState(makeEntry());

      // First undo pops the entry
      expect(manager.undo()).toBeDefined();

      // Subsequent undos should all return undefined
      expect(manager.undo()).toBeUndefined();
      expect(manager.undo()).toBeUndefined();
      expect(manager.undo()).toBeUndefined();
    });

    it('redo past the end returns undefined repeatedly', () => {
      const manager = new HistoryManager();
      const entry = makeEntry();
      manager.recordForRedo(entry);

      // First redo pops the entry
      expect(manager.redo()).toBe(entry);

      // Subsequent redos should all return undefined
      expect(manager.redo()).toBeUndefined();
      expect(manager.redo()).toBeUndefined();
      expect(manager.redo()).toBeUndefined();
    });

    it('push after undo clears redo stack', () => {
      const manager = new HistoryManager();
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      manager.pushState(makeEntry());
      manager.pushState(makeEntry());

      // Undo and record for redo (simulating real undo workflow)
      const undone = manager.undo();
      expect(undone).toBeDefined();
      manager.recordForRedo(undone!);
      expect(manager.canRedo()).toBe(true);

      // Push a new state should clear redo
      manager.pushState(makeEntry());
      expect(manager.canRedo()).toBe(false);
    });

    it('100 pushes, then 100 undos, then 100 redos', () => {
      const manager = new HistoryManager(200, 0);
      let time = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        time += 1000;
        return time;
      });

      const entries: HistoryEntry[] = [];
      for (let i = 0; i < 100; i++) {
        const entry = makeEntry();
        entries.push(entry);
        manager.pushState(entry);
      }

      // 100 undos
      const undoneEntries: HistoryEntry[] = [];
      for (let i = 0; i < 100; i++) {
        const undone = manager.undo();
        expect(undone).toBeDefined();
        undoneEntries.push(undone!);
        manager.recordForRedo(undone!);
      }
      // Should get entries in reverse order
      expect(undoneEntries[0]).toBe(entries[99]);
      expect(undoneEntries[99]).toBe(entries[0]);

      // No more undos
      expect(manager.undo()).toBeUndefined();

      // 100 redos
      const redoneEntries: HistoryEntry[] = [];
      for (let i = 0; i < 100; i++) {
        const redone = manager.redo();
        expect(redone).toBeDefined();
        redoneEntries.push(redone!);
      }
      // Redo stack is LIFO, so redone order reverses the undo order
      expect(redoneEntries[0]).toBe(entries[0]);
      expect(redoneEntries[99]).toBe(entries[99]);

      // No more redos
      expect(manager.redo()).toBeUndefined();
    });
  });
});
