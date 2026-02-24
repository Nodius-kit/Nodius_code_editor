import type { Operation, Position, Delta } from '../core/types';

// ========== Legacy types (kept for backward compatibility) ==========

export interface TransportAdapter {
  send(delta: Delta): void;
  onReceive(handler: (delta: Delta) => void): void;
  sendCursor(userId: string, position: Position, color: string): void;
  onCursorUpdate(handler: (userId: string, position: Position, color: string) => void): void;
  disconnect(): void;
}

export interface CollaborationOptions {
  userId: string;
  color: string;
  name?: string;
  transport: TransportAdapter;
  batchDelay?: number;
  maxBatchSize?: number;
}

// ========== Jupiter/Wave OT Protocol Messages ==========

/**
 * Messages sent from a client to the server.
 */
export type ClientMessage = {
  type: 'operation';
  /** The last server revision the client had seen when it generated these ops. */
  revision: number;
  ops: Operation[];
} | {
  type: 'cursor';
  position: Position;
  color: string;
};

/**
 * Messages sent from the server to clients.
 */
export type ServerMessage = {
  type: 'ack';
  /** The new server revision after applying the client's ops. */
  revision: number;
} | {
  type: 'operation';
  /** The new server revision after applying this operation. */
  revision: number;
  userId: string;
  ops: Operation[];
} | {
  type: 'cursor';
  userId: string;
  position: Position;
  color: string;
};

/**
 * Options for creating a CollaborationClient.
 */
export interface CollaborationClientOptions {
  userId: string;
  color: string;
  name?: string;
  /** Function to send messages to the server. */
  send: (msg: ClientMessage) => void;
  /** Optional debounce delay (ms) before sending in synchronized state. */
  debounceDelay?: number;
}
