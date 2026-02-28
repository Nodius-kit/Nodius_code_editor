import type { Operation, Position } from '../core/types';
import type { ClientMessage, ServerMessage } from './types';
import { transformOps } from './OTEngine';
import { encodeOperations, decodeInstructions } from './InstructionCodec';

/**
 * Represents a connected client on the server side.
 */
interface ServerClient {
  readonly id: string;
  readonly send: (msg: ServerMessage) => void;
}

/**
 * A single entry in the server's operation history.
 */
interface HistoryEntry {
  readonly ops: Operation[];
  readonly userId: string;
}

/**
 * Central collaboration server that serializes all operations.
 *
 * Implements the server side of the Jupiter/Wave OT protocol:
 * 1. Receives operations from clients with a baseRevision.
 * 2. Transforms the ops against any history entries after the client's baseRevision.
 * 3. Appends the transformed ops to the canonical history.
 * 4. Sends an ACK (with new revision) to the originating client.
 * 5. Broadcasts the transformed ops to all OTHER clients.
 */
export class CollaborationServer {
  /** Canonical history of applied operations. */
  private history: HistoryEntry[] = [];

  /** Current server revision (= history.length). */
  private revision: number = 0;

  /** Connected clients. */
  private clients: Map<string, ServerClient> = new Map();

  /**
   * Register a new client with the server.
   *
   * @param clientId - Unique identifier for the client.
   * @param send - Function to send a ServerMessage to this client.
   */
  addClient(clientId: string, send: (msg: ServerMessage) => void): void {
    this.clients.set(clientId, { id: clientId, send });
  }

  /**
   * Remove a client from the server.
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Get the current server revision.
   */
  getRevision(): number {
    return this.revision;
  }

  /**
   * Process a message received from a client.
   */
  receiveFromClient(clientId: string, message: ClientMessage): void {
    switch (message.type) {
      case 'operation':
        this.handleOperation(clientId, message.revision, decodeInstructions(message.instructions));
        break;
      case 'cursor':
        this.handleCursor(clientId, message.position, message.color);
        break;
    }
  }

  /**
   * Handle an operation message from a client.
   *
   * The client's ops were generated against server revision `baseRevision`.
   * We need to transform them against all history entries from baseRevision
   * to the current revision, then apply and broadcast.
   */
  private handleOperation(clientId: string, baseRevision: number, clientOps: Operation[]): void {
    let ops = clientOps.slice();

    // Transform against all operations that happened after the client's base revision
    for (let i = baseRevision; i < this.revision; i++) {
      const historyEntry = this.history[i];
      const [, transformedClient] = transformOps(historyEntry.ops, ops);
      ops = transformedClient;
    }

    // Append to history and increment revision
    this.history.push({ ops, userId: clientId });
    this.revision++;

    const client = this.clients.get(clientId);

    // Send ACK to the originating client
    if (client) {
      client.send({
        type: 'ack',
        revision: this.revision,
      });
    }

    // Broadcast transformed ops to all OTHER clients
    const instructions = encodeOperations(ops);
    for (const [id, otherClient] of this.clients) {
      if (id !== clientId) {
        otherClient.send({
          type: 'operation',
          revision: this.revision,
          userId: clientId,
          instructions,
        });
      }
    }
  }

  /**
   * Handle a cursor message from a client.
   * Broadcasts to all other clients.
   */
  private handleCursor(clientId: string, position: Position, color: string): void {
    for (const [id, client] of this.clients) {
      if (id !== clientId) {
        client.send({
          type: 'cursor',
          userId: clientId,
          position,
          color,
        });
      }
    }
  }
}
