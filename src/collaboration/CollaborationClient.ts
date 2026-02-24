import type { Operation, Position, RemoteCursor } from '../core/types';
import type { ClientMessage, ServerMessage, CollaborationClientOptions } from './types';
import { transformOps } from './OTEngine';
import { CursorSync } from './CursorSync';

/**
 * The three states of the Jupiter/Wave OT client state machine.
 *
 * - `synchronized`: No outstanding operations. Client and server are in sync.
 * - `awaitingConfirm`: One batch of ops has been sent, waiting for ACK.
 * - `awaitingWithBuffer`: One batch is in-flight AND we have additional buffered ops.
 */
type ClientState = 'synchronized' | 'awaitingConfirm' | 'awaitingWithBuffer';

/**
 * Collaboration client implementing the Jupiter/Wave OT protocol.
 *
 * This is a 3-state machine that ensures:
 * - Only one message is in-flight at a time (ACK-gated sending).
 * - Local ops are buffered while waiting for ACK.
 * - Remote ops are correctly transformed against outstanding/buffered ops.
 */
export class CollaborationClient {
  private readonly userId: string;
  private readonly color: string;
  private readonly name?: string;
  private readonly sendFn: (msg: ClientMessage) => void;
  private readonly debounceDelay: number;
  private readonly cursorSync: CursorSync;

  private state: ClientState = 'synchronized';

  /** Last server revision we know about. */
  private revision: number = 0;

  /** Ops that have been sent to the server but not yet ACKed. */
  private outstanding: Operation[] | null = null;

  /** Ops buffered locally while waiting for ACK on outstanding ops. */
  private buffer: Operation[] | null = null;

  /** Debounce timer for the synchronized -> awaitingConfirm transition. */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ops accumulated during the debounce window. */
  private debounceBuffer: Operation[] | null = null;

  /** Callback for remote operations to apply locally. */
  private remoteOpsHandler: ((ops: Operation[]) => void) | null = null;

  /** Callback for remote cursor updates. */
  private remoteCursorHandler: ((cursors: RemoteCursor[]) => void) | null = null;

  constructor(options: CollaborationClientOptions) {
    this.userId = options.userId;
    this.color = options.color;
    this.name = options.name;
    this.sendFn = options.send;
    this.debounceDelay = options.debounceDelay ?? 0;
    this.cursorSync = new CursorSync();
  }

  /**
   * Get the current protocol state (for testing/debugging).
   */
  getState(): ClientState {
    return this.state;
  }

  /**
   * Get the current server revision this client knows about.
   */
  getRevision(): number {
    return this.revision;
  }

  // ---------------------------------------------------------------------------
  // Local operations
  // ---------------------------------------------------------------------------

  /**
   * Called when the user makes local edits.
   * Routes through the 3-state machine.
   */
  applyLocal(ops: Operation[]): void {
    if (ops.length === 0) return;

    // Map remote cursors through local ops so they stay accurate
    this.cursorSync.mapCursorsThroughOps(ops);

    switch (this.state) {
      case 'synchronized':
        if (this.debounceDelay > 0) {
          // Accumulate ops during debounce window
          if (this.debounceBuffer === null) {
            this.debounceBuffer = [...ops];
          } else {
            this.debounceBuffer.push(...ops);
          }

          if (this.debounceTimer === null) {
            this.debounceTimer = setTimeout(() => {
              this.flushDebounce();
            }, this.debounceDelay);
          }
        } else {
          // Send immediately, transition to awaitingConfirm
          this.outstanding = [...ops];
          this.sendFn({
            type: 'operation',
            revision: this.revision,
            ops: this.outstanding,
          });
          this.state = 'awaitingConfirm';
        }
        break;

      case 'awaitingConfirm':
        // Buffer the ops, transition to awaitingWithBuffer
        this.buffer = [...ops];
        this.state = 'awaitingWithBuffer';
        break;

      case 'awaitingWithBuffer':
        // Compose into existing buffer (concatenate)
        this.buffer!.push(...ops);
        break;
    }
  }

  /**
   * Flush the debounce buffer and send.
   */
  private flushDebounce(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.debounceBuffer !== null && this.debounceBuffer.length > 0) {
      const ops = this.debounceBuffer;
      this.debounceBuffer = null;

      // We should still be in synchronized state when debounce fires,
      // because we only debounce in synchronized state.
      // However, if a remote op arrived and we're still synchronized, proceed.
      if (this.state === 'synchronized') {
        this.outstanding = ops;
        this.sendFn({
          type: 'operation',
          revision: this.revision,
          ops: this.outstanding,
        });
        this.state = 'awaitingConfirm';
      } else if (this.state === 'awaitingConfirm') {
        // We transitioned due to a debounce flush while another arrived
        this.buffer = ops;
        this.state = 'awaitingWithBuffer';
      } else if (this.state === 'awaitingWithBuffer') {
        this.buffer!.push(...ops);
      }
    } else {
      this.debounceBuffer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Server message handling
  // ---------------------------------------------------------------------------

  /**
   * Called when receiving a message from the server.
   * Dispatches to the appropriate handler.
   */
  handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'ack':
        this.handleAck(msg.revision);
        break;
      case 'operation':
        this.handleRemoteOps(msg.revision, msg.ops);
        break;
      case 'cursor':
        this.handleCursor(msg.userId, msg.position, msg.color);
        break;
    }
  }

  /**
   * Handle ACK from the server.
   */
  private handleAck(revision: number): void {
    this.revision = revision;

    switch (this.state) {
      case 'awaitingConfirm':
        // Our outstanding ops were applied. Go back to synchronized.
        this.outstanding = null;
        this.state = 'synchronized';
        break;

      case 'awaitingWithBuffer':
        // Our outstanding ops were applied. Send the buffer as the next batch.
        this.outstanding = this.buffer;
        this.buffer = null;
        this.sendFn({
          type: 'operation',
          revision: this.revision,
          ops: this.outstanding!,
        });
        this.state = 'awaitingConfirm';
        break;

      case 'synchronized':
        // Unexpected ACK in synchronized state. Should not happen in normal flow.
        // Just update the revision.
        break;
    }
  }

  /**
   * Handle a remote operation broadcast from the server.
   */
  private handleRemoteOps(revision: number, ops: Operation[]): void {
    this.revision = revision;

    // If we have a pending debounce, flush it first so the state machine
    // is in a clean state before we process remote ops.
    if (this.debounceBuffer !== null && this.debounceBuffer.length > 0) {
      this.flushDebounce();
    }

    switch (this.state) {
      case 'synchronized':
        // Apply remote ops directly
        this.cursorSync.mapCursorsThroughOps(ops);
        this.emitRemoteOps(ops);
        break;

      case 'awaitingConfirm': {
        // Transform remote ops (server-canonical, A) against outstanding (client, B).
        // Server ops win ties (A wins), matching the server's transform convention.
        const [transformedOps, newOutstanding] = transformOps(ops, this.outstanding!);
        this.outstanding = newOutstanding;
        this.cursorSync.mapCursorsThroughOps(transformedOps);
        this.emitRemoteOps(transformedOps);
        break;
      }

      case 'awaitingWithBuffer': {
        // Transform remote ops against outstanding, then against buffer.
        // Remote ops (server-canonical) are always A to match server convention.
        const [temp, newOut] = transformOps(ops, this.outstanding!);
        const [transformedOps, newBuf] = transformOps(temp, this.buffer!);
        this.outstanding = newOut;
        this.buffer = newBuf;
        this.cursorSync.mapCursorsThroughOps(transformedOps);
        this.emitRemoteOps(transformedOps);
        break;
      }
    }
  }

  /**
   * Handle a remote cursor update from the server.
   */
  private handleCursor(userId: string, position: Position, color: string): void {
    this.cursorSync.updateRemoteCursor(userId, position, color);
    if (this.remoteCursorHandler) {
      this.remoteCursorHandler(this.cursorSync.getCursors());
    }
  }

  // ---------------------------------------------------------------------------
  // Emit helpers
  // ---------------------------------------------------------------------------

  private emitRemoteOps(ops: Operation[]): void {
    if (this.remoteOpsHandler && ops.length > 0) {
      this.remoteOpsHandler(ops);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API: callbacks
  // ---------------------------------------------------------------------------

  /**
   * Register a callback for remote operations that should be applied to the editor.
   */
  onRemoteOperations(handler: (ops: Operation[]) => void): void {
    this.remoteOpsHandler = handler;
  }

  /**
   * Register a callback for remote cursor updates.
   */
  onRemoteCursorUpdate(handler: (cursors: RemoteCursor[]) => void): void {
    this.remoteCursorHandler = handler;
  }

  /**
   * Send the local user's cursor position to the server.
   */
  updateLocalCursor(position: Position): void {
    this.sendFn({
      type: 'cursor',
      position,
      color: this.color,
    });
  }

  /**
   * Get all currently tracked remote cursors.
   */
  getRemoteCursors(): RemoteCursor[] {
    return this.cursorSync.getCursors();
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.debounceBuffer = null;
    this.outstanding = null;
    this.buffer = null;
    this.cursorSync.clear();
    this.remoteOpsHandler = null;
    this.remoteCursorHandler = null;
    this.state = 'synchronized';
  }
}
