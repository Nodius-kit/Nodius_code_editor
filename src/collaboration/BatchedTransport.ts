/**
 * @deprecated BatchedTransport is no longer used. The Jupiter/Wave OT protocol
 * in CollaborationClient handles operation batching via its 3-state machine
 * (synchronized / awaitingConfirm / awaitingWithBuffer). The buffer state
 * naturally batches operations while waiting for server ACKs.
 *
 * This file is kept as a no-op stub for backward compatibility.
 * Use CollaborationClient + CollaborationServer instead.
 */

import type { Operation, Delta, Position } from '../core/types';
import type { TransportAdapter } from './types';

/**
 * @deprecated Use CollaborationClient instead.
 */
export class BatchedTransport {
  constructor(
    private readonly transport: TransportAdapter,
    private readonly userId: string,
    private readonly _delay: number = 300,
    private readonly _maxBatchSize: number = 50,
  ) {}

  queueOps(_ops: readonly Operation[]): void {
    // No-op: batching is handled by CollaborationClient's state machine
  }

  flush(): void {
    // No-op
  }

  setLastSeenRemoteVersion(_version: number): void {
    // No-op
  }

  onReceive(handler: (delta: Delta) => void): void {
    this.transport.onReceive(handler);
  }

  sendCursor(position: Position, color: string): void {
    this.transport.sendCursor(this.userId, position, color);
  }

  onCursorUpdate(
    handler: (userId: string, position: Position, color: string) => void,
  ): void {
    this.transport.onCursorUpdate(handler);
  }

  destroy(): void {
    // No-op
  }
}
