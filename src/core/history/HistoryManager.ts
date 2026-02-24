import type { HistoryEntry } from '../types';

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private lastPushTime: number = 0;

  private readonly maxSize: number;
  private readonly batchDelay: number;

  constructor(maxSize: number = 100, batchDelay: number = 500) {
    this.maxSize = maxSize;
    this.batchDelay = batchDelay;
  }

  /**
   * Push a new state onto the undo stack.
   * If the time since the last push is less than batchDelay, replaces the
   * top entry instead of pushing (batching rapid edits together).
   * Clears the redo stack on every new push.
   */
  pushState(entry: HistoryEntry): void {
    const now = Date.now();
    const timeSinceLastPush = now - this.lastPushTime;

    if (timeSinceLastPush < this.batchDelay && this.undoStack.length > 0) {
      // Replace top of undo stack (batch rapid edits)
      this.undoStack[this.undoStack.length - 1] = entry;
    } else {
      this.undoStack.push(entry);

      // Enforce max size by removing oldest entries
      if (this.undoStack.length > this.maxSize) {
        this.undoStack.splice(0, this.undoStack.length - this.maxSize);
      }
    }

    this.lastPushTime = now;

    // Clear redo stack whenever a new state is pushed
    this.redoStack.length = 0;
  }

  /**
   * Pop and return the most recent undo entry, or undefined if empty.
   */
  undo(): HistoryEntry | undefined {
    return this.undoStack.pop();
  }

  /**
   * Pop and return the most recent redo entry, or undefined if empty.
   */
  redo(): HistoryEntry | undefined {
    return this.redoStack.pop();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Push an entry to the undo stack (used when undoing to save state for redo).
   */
  recordForUndo(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.splice(0, this.undoStack.length - this.maxSize);
    }
  }

  /**
   * Push an entry to the redo stack (used when redoing to save state for undo).
   */
  recordForRedo(entry: HistoryEntry): void {
    this.redoStack.push(entry);
  }

  /**
   * Clear all undo and redo history.
   */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lastPushTime = 0;
  }
}
