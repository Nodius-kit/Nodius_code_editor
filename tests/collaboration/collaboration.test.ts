import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollaborationServer } from '../../src/collaboration/CollaborationServer';
import { CollaborationClient } from '../../src/collaboration/CollaborationClient';
import type { ClientMessage, ServerMessage } from '../../src/collaboration/types';
import type { Operation } from '../../src/core/types';
import { transformOps } from '../../src/collaboration/OTEngine';
import { applyOperations } from '../../src/core/operations/OperationEngine';
import { createDocument, getText } from '../../src/core/document/Document';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a synchronous (zero-latency) local collaboration setup
 * for deterministic testing.
 */
function createLocalSetup() {
  const server = new CollaborationServer();

  function createClient(userId: string, color: string = '#ff0000') {
    const sentMessages: ClientMessage[] = [];
    const receivedMessages: ServerMessage[] = [];

    const client = new CollaborationClient({
      userId,
      color,
      send: (msg) => {
        sentMessages.push(msg);
        // Synchronous delivery to server
        server.receiveFromClient(userId, msg);
      },
    });

    // Register with server - synchronous delivery to client
    server.addClient(userId, (msg) => {
      receivedMessages.push(msg);
      client.handleMessage(msg);
    });

    return { client, sentMessages, receivedMessages };
  }

  return { server, createClient };
}

/**
 * Creates a setup with controllable message delivery (for testing
 * concurrency, out-of-order delivery, etc.)
 */
function createManualSetup() {
  const server = new CollaborationServer();

  // Queues for manual delivery
  const serverInbox: Array<{ clientId: string; msg: ClientMessage }> = [];
  const clientInboxes = new Map<string, ServerMessage[]>();

  function createClient(userId: string, color: string = '#ff0000') {
    const inbox: ServerMessage[] = [];
    clientInboxes.set(userId, inbox);

    const client = new CollaborationClient({
      userId,
      color,
      send: (msg) => {
        serverInbox.push({ clientId: userId, msg });
      },
    });

    server.addClient(userId, (msg) => {
      inbox.push(msg);
    });

    return { client, inbox };
  }

  /** Deliver all pending client messages to the server. */
  function deliverToServer() {
    const msgs = serverInbox.splice(0);
    for (const { clientId, msg } of msgs) {
      server.receiveFromClient(clientId, msg);
    }
  }

  /** Deliver all pending server messages to a specific client. */
  function deliverToClient(userId: string, client: CollaborationClient) {
    const inbox = clientInboxes.get(userId)!;
    const msgs = inbox.splice(0);
    for (const msg of msgs) {
      client.handleMessage(msg);
    }
  }

  return { server, createClient, serverInbox, clientInboxes, deliverToServer, deliverToClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollaborationClient', () => {
  it('can be created without errors', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      name: 'Alice',
      send: () => {},
    });

    expect(client.getState()).toBe('synchronized');
    expect(client.getRevision()).toBe(0);

    client.destroy();
  });

  it('transitions to awaitingConfirm when sending local ops', () => {
    const sent: ClientMessage[] = [];
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: (msg) => sent.push(msg),
    });

    const ops: Operation[] = [
      { type: 'insertText', line: 0, column: 0, text: 'Hello', origin: 'input' },
    ];

    client.applyLocal(ops);

    expect(client.getState()).toBe('awaitingConfirm');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      type: 'operation',
      revision: 0,
      ops,
    });

    client.destroy();
  });

  it('transitions to awaitingWithBuffer when buffering during awaitingConfirm', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingConfirm');

    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingWithBuffer');

    client.destroy();
  });

  it('composes into buffer in awaitingWithBuffer state', () => {
    const sent: ClientMessage[] = [];
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: (msg) => sent.push(msg),
    });

    // First op -> awaitingConfirm
    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    // Second op -> awaitingWithBuffer
    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);
    // Third op -> still awaitingWithBuffer, composed into buffer
    client.applyLocal([
      { type: 'insertText', line: 0, column: 2, text: 'C', origin: 'input' },
    ]);

    expect(client.getState()).toBe('awaitingWithBuffer');
    // Only one message sent (the first op)
    expect(sent).toHaveLength(1);

    client.destroy();
  });

  it('returns to synchronized after ACK in awaitingConfirm', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingConfirm');

    client.handleMessage({ type: 'ack', revision: 1 });

    expect(client.getState()).toBe('synchronized');
    expect(client.getRevision()).toBe(1);

    client.destroy();
  });

  it('sends buffer and transitions to awaitingConfirm after ACK in awaitingWithBuffer', () => {
    const sent: ClientMessage[] = [];
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: (msg) => sent.push(msg),
    });

    // First op -> awaitingConfirm
    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    // Second op -> awaitingWithBuffer
    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);

    expect(sent).toHaveLength(1); // Only first op sent

    // ACK the first op
    client.handleMessage({ type: 'ack', revision: 1 });

    expect(client.getState()).toBe('awaitingConfirm');
    expect(client.getRevision()).toBe(1);
    // Buffer should now have been sent
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      type: 'operation',
      revision: 1,
      ops: [{ type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' }],
    });

    // ACK the second op
    client.handleMessage({ type: 'ack', revision: 2 });
    expect(client.getState()).toBe('synchronized');
    expect(client.getRevision()).toBe(2);

    client.destroy();
  });

  it('receives remote operations in synchronized state', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    const remoteHandler = vi.fn();
    client.onRemoteOperations(remoteHandler);

    const remoteOps: Operation[] = [
      { type: 'insertText', line: 0, column: 0, text: 'Hello', origin: 'remote' },
    ];

    client.handleMessage({
      type: 'operation',
      revision: 1,
      userId: 'user2',
      ops: remoteOps,
    });

    expect(remoteHandler).toHaveBeenCalledTimes(1);
    expect(remoteHandler).toHaveBeenCalledWith(remoteOps);
    expect(client.getRevision()).toBe(1);

    client.destroy();
  });

  it('transforms remote ops against outstanding in awaitingConfirm state', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    const remoteHandler = vi.fn();
    client.onRemoteOperations(remoteHandler);

    // Send local op (insert at col 0)
    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);

    // Receive remote op (insert at col 0 from another user)
    client.handleMessage({
      type: 'operation',
      revision: 1,
      userId: 'user2',
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'B', origin: 'remote' }],
    });

    expect(remoteHandler).toHaveBeenCalledTimes(1);
    // The remote op should be transformed against our outstanding op.
    // Remote ops use server convention (opA, wins ties). Our local ops are opB.
    // Both insert at col 0: remote wins tie and stays at col 0.
    // Our outstanding 'A' shifts right to col 1.
    const transformedOps = remoteHandler.mock.calls[0][0];
    expect(transformedOps[0].column).toBe(0); // Remote wins, stays at col 0

    client.destroy();
  });

  it('transforms remote ops against outstanding and buffer in awaitingWithBuffer state', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    const remoteHandler = vi.fn();
    client.onRemoteOperations(remoteHandler);

    // First op -> awaitingConfirm
    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    // Second op -> awaitingWithBuffer
    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);

    // Receive remote op
    client.handleMessage({
      type: 'operation',
      revision: 1,
      userId: 'user2',
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'C', origin: 'remote' }],
    });

    expect(remoteHandler).toHaveBeenCalledTimes(1);
    // Remote 'C' at col 0 uses server convention (wins ties).
    // 1. Transform against outstanding 'A' at col 0: 'C' wins, stays at col 0. 'A' shifts to col 1.
    // 2. Transform against buffer 'B' at col 1: 'C' at col 0 < 'B' at col 1, no shift for 'C'. 'B' shifts to col 2.
    // Remote 'C' stays at col 0.
    const transformedOps = remoteHandler.mock.calls[0][0];
    expect(transformedOps[0].column).toBe(0);

    client.destroy();
  });

  it('handles remote cursor updates', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    const cursorHandler = vi.fn();
    client.onRemoteCursorUpdate(cursorHandler);

    client.handleMessage({
      type: 'cursor',
      userId: 'user2',
      position: { line: 5, column: 10 },
      color: '#00ff00',
    });

    expect(cursorHandler).toHaveBeenCalledTimes(1);
    const cursors = cursorHandler.mock.calls[0][0];
    expect(cursors).toHaveLength(1);
    expect(cursors[0].userId).toBe('user2');
    expect(cursors[0].position).toEqual({ line: 5, column: 10 });

    client.destroy();
  });

  it('sends cursor updates through the send function', () => {
    const sent: ClientMessage[] = [];
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: (msg) => sent.push(msg),
    });

    client.updateLocalCursor({ line: 3, column: 7 });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      type: 'cursor',
      position: { line: 3, column: 7 },
      color: '#ff0000',
    });

    client.destroy();
  });

  it('getRemoteCursors returns tracked cursors', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    client.handleMessage({
      type: 'cursor',
      userId: 'user2',
      position: { line: 1, column: 5 },
      color: '#00ff00',
    });
    client.handleMessage({
      type: 'cursor',
      userId: 'user3',
      position: { line: 3, column: 0 },
      color: '#0000ff',
    });

    const cursors = client.getRemoteCursors();
    expect(cursors).toHaveLength(2);

    client.destroy();
  });

  it('destroy clears all state', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    client.handleMessage({
      type: 'cursor',
      userId: 'user2',
      position: { line: 1, column: 5 },
      color: '#00ff00',
    });

    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'X', origin: 'input' },
    ]);

    client.destroy();

    expect(client.getState()).toBe('synchronized');
    expect(client.getRemoteCursors()).toHaveLength(0);
  });
});

describe('CollaborationServer', () => {
  it('can be created without errors', () => {
    const server = new CollaborationServer();
    expect(server.getRevision()).toBe(0);
  });

  it('adds and removes clients', () => {
    const server = new CollaborationServer();
    const send = vi.fn();

    server.addClient('user1', send);
    server.removeClient('user1');

    // Should not throw even after removing
    server.receiveFromClient('user1', {
      type: 'operation',
      revision: 0,
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' }],
    });
  });

  it('processes operations and increments revision', () => {
    const server = new CollaborationServer();
    const send = vi.fn();
    server.addClient('user1', send);

    server.receiveFromClient('user1', {
      type: 'operation',
      revision: 0,
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' }],
    });

    expect(server.getRevision()).toBe(1);
    // Client should receive ACK
    expect(send).toHaveBeenCalledWith({
      type: 'ack',
      revision: 1,
    });
  });

  it('broadcasts operations to other clients', () => {
    const server = new CollaborationServer();
    const sendAlice = vi.fn();
    const sendBob = vi.fn();

    server.addClient('alice', sendAlice);
    server.addClient('bob', sendBob);

    const ops: Operation[] = [
      { type: 'insertText', line: 0, column: 0, text: 'Hello', origin: 'input' },
    ];

    server.receiveFromClient('alice', {
      type: 'operation',
      revision: 0,
      ops,
    });

    // Alice gets ACK
    expect(sendAlice).toHaveBeenCalledWith({
      type: 'ack',
      revision: 1,
    });

    // Bob gets the operation
    expect(sendBob).toHaveBeenCalledWith({
      type: 'operation',
      revision: 1,
      userId: 'alice',
      ops,
    });
  });

  it('transforms operations against history when baseRevision is behind', () => {
    const server = new CollaborationServer();
    const sendAlice = vi.fn();
    const sendBob = vi.fn();

    server.addClient('alice', sendAlice);
    server.addClient('bob', sendBob);

    // Alice sends op at revision 0
    server.receiveFromClient('alice', {
      type: 'operation',
      revision: 0,
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' }],
    });
    // Server is now at revision 1

    // Bob sends op at revision 0 (concurrent with Alice's)
    server.receiveFromClient('bob', {
      type: 'operation',
      revision: 0,
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'B', origin: 'input' }],
    });
    // Server should transform Bob's op against Alice's op

    expect(server.getRevision()).toBe(2);

    // Bob gets ACK for revision 2
    expect(sendBob).toHaveBeenCalledWith({
      type: 'ack',
      revision: 2,
    });

    // Alice gets Bob's transformed op
    const aliceCalls = sendAlice.mock.calls;
    const bobOpBroadcast = aliceCalls.find(
      (call) => call[0].type === 'operation' && call[0].userId === 'bob',
    );
    expect(bobOpBroadcast).toBeDefined();
    // Bob's 'B' at col 0 should be shifted to col 1 because Alice's 'A' was at col 0 first
    expect(bobOpBroadcast![0].ops[0].column).toBe(1);
  });

  it('broadcasts cursor updates to other clients', () => {
    const server = new CollaborationServer();
    const sendAlice = vi.fn();
    const sendBob = vi.fn();

    server.addClient('alice', sendAlice);
    server.addClient('bob', sendBob);

    server.receiveFromClient('alice', {
      type: 'cursor',
      position: { line: 3, column: 5 },
      color: '#ff0000',
    });

    // Alice should NOT receive her own cursor
    expect(sendAlice).not.toHaveBeenCalled();

    // Bob should receive Alice's cursor
    expect(sendBob).toHaveBeenCalledWith({
      type: 'cursor',
      userId: 'alice',
      position: { line: 3, column: 5 },
      color: '#ff0000',
    });
  });
});

describe('Full client-server integration', () => {
  it('two clients with concurrent edits converge', () => {
    const setup = createManualSetup();
    const { client: alice } = setup.createClient('alice', '#ff0000');
    const { client: bob } = setup.createClient('bob', '#00ff00');

    let docAlice = createDocument('Hello World');
    let docBob = createDocument('Hello World');

    alice.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docAlice = applyOperations(docAlice, remoteOps);
    });

    bob.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docBob = applyOperations(docBob, remoteOps);
    });

    // Alice inserts " Beautiful" after "Hello"
    const aliceOps: Operation[] = [
      { type: 'insertText', line: 0, column: 5, text: ' Beautiful', origin: 'input' },
    ];
    docAlice = applyOperations(docAlice, aliceOps);
    alice.applyLocal(aliceOps);

    // Bob inserts "!" at the end (concurrent - no messages delivered yet)
    const bobOps: Operation[] = [
      { type: 'insertText', line: 0, column: 11, text: '!', origin: 'input' },
    ];
    docBob = applyOperations(docBob, bobOps);
    bob.applyLocal(bobOps);

    // Deliver all messages: client -> server -> client
    setup.deliverToServer(); // Alice's and Bob's ops go to server
    setup.deliverToClient('alice', alice); // Alice gets ACK + Bob's transformed op
    setup.deliverToClient('bob', bob); // Bob gets Bob's transformed op from server + ACK

    // Continue delivering until all queues are empty
    setup.deliverToServer();
    setup.deliverToClient('alice', alice);
    setup.deliverToClient('bob', bob);

    // Both documents should converge
    expect(getText(docAlice)).toBe(getText(docBob));
    // Both should contain all the edits
    expect(getText(docAlice)).toContain('Beautiful');
    expect(getText(docAlice)).toContain('!');

    alice.destroy();
    bob.destroy();
  });

  it('three rapid edits from each user converge', () => {
    const setup = createManualSetup();
    const { client: alice } = setup.createClient('alice', '#ff0000');
    const { client: bob } = setup.createClient('bob', '#00ff00');

    let docAlice = createDocument('ABCDEF');
    let docBob = createDocument('ABCDEF');

    alice.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docAlice = applyOperations(docAlice, remoteOps);
    });

    bob.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docBob = applyOperations(docBob, remoteOps);
    });

    // Alice types 'X', 'Y', 'Z' at column 0 (concurrent, no delivery)
    for (let i = 0; i < 3; i++) {
      const op: Operation = {
        type: 'insertText',
        line: 0,
        column: i,
        text: String.fromCharCode(88 + i), // X, Y, Z
        origin: 'input',
      };
      docAlice = applyOperations(docAlice, [op]);
      alice.applyLocal([op]);
    }

    // Bob types '1', '2', '3' at end (concurrent, no delivery)
    const baseLen = 6;
    for (let i = 0; i < 3; i++) {
      const op: Operation = {
        type: 'insertText',
        line: 0,
        column: baseLen + i,
        text: String(i + 1),
        origin: 'input',
      };
      docBob = applyOperations(docBob, [op]);
      bob.applyLocal([op]);
    }

    // Now deliver all messages back and forth until stable
    for (let round = 0; round < 10; round++) {
      setup.deliverToServer();
      setup.deliverToClient('alice', alice);
      setup.deliverToClient('bob', bob);
    }

    expect(getText(docAlice)).toBe(getText(docBob));

    alice.destroy();
    bob.destroy();
  });

  it('handles concurrent edits with manual message delivery', () => {
    const setup = createManualSetup();
    const { client: alice, inbox: aliceInbox } = setup.createClient('alice', '#ff0000');
    const { client: bob, inbox: bobInbox } = setup.createClient('bob', '#00ff00');

    let docAlice = createDocument('Hello');
    let docBob = createDocument('Hello');

    alice.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docAlice = applyOperations(docAlice, remoteOps);
    });

    bob.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docBob = applyOperations(docBob, remoteOps);
    });

    // Both make edits concurrently (before either reaches the server)
    const aliceOp: Operation = {
      type: 'insertText', line: 0, column: 5, text: '!', origin: 'input',
    };
    docAlice = applyOperations(docAlice, [aliceOp]);
    alice.applyLocal([aliceOp]);

    const bobOp: Operation = {
      type: 'insertText', line: 0, column: 0, text: '>', origin: 'input',
    };
    docBob = applyOperations(docBob, [bobOp]);
    bob.applyLocal([bobOp]);

    // Now deliver Alice's message to server first
    setup.deliverToServer();

    // Deliver server responses to both clients
    setup.deliverToClient('alice', alice);
    setup.deliverToClient('bob', bob);

    // Now deliver Bob's buffered message (if any) to server
    setup.deliverToServer();
    setup.deliverToClient('alice', alice);
    setup.deliverToClient('bob', bob);

    expect(getText(docAlice)).toBe(getText(docBob));

    alice.destroy();
    bob.destroy();
  });
});

describe('3-state machine transitions', () => {
  it('full cycle: synchronized -> awaitingConfirm -> awaitingWithBuffer -> awaitingConfirm -> synchronized', () => {
    const sent: ClientMessage[] = [];
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: (msg) => sent.push(msg),
    });

    // Start: synchronized
    expect(client.getState()).toBe('synchronized');

    // Local edit -> awaitingConfirm
    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingConfirm');
    expect(sent).toHaveLength(1);

    // Another local edit -> awaitingWithBuffer
    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingWithBuffer');
    expect(sent).toHaveLength(1); // Still only 1 sent

    // ACK from server -> sends buffer, awaitingConfirm
    client.handleMessage({ type: 'ack', revision: 1 });
    expect(client.getState()).toBe('awaitingConfirm');
    expect(sent).toHaveLength(2); // Buffer was sent

    // Second ACK -> synchronized
    client.handleMessage({ type: 'ack', revision: 2 });
    expect(client.getState()).toBe('synchronized');

    client.destroy();
  });

  it('remote ops during awaitingConfirm do not change state', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingConfirm');

    client.handleMessage({
      type: 'operation',
      revision: 1,
      userId: 'user2',
      ops: [{ type: 'insertText', line: 0, column: 5, text: 'B', origin: 'remote' }],
    });

    // Still awaitingConfirm (remote ops don't change state)
    expect(client.getState()).toBe('awaitingConfirm');

    client.destroy();
  });

  it('remote ops during awaitingWithBuffer do not change state', () => {
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      send: () => {},
    });

    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);
    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);
    expect(client.getState()).toBe('awaitingWithBuffer');

    client.handleMessage({
      type: 'operation',
      revision: 1,
      userId: 'user2',
      ops: [{ type: 'insertText', line: 0, column: 5, text: 'C', origin: 'remote' }],
    });

    expect(client.getState()).toBe('awaitingWithBuffer');

    client.destroy();
  });
});

describe('Server serialization ordering', () => {
  it('operations from different clients are serialized in arrival order', () => {
    const server = new CollaborationServer();
    const ackAlice = vi.fn();
    const ackBob = vi.fn();

    server.addClient('alice', ackAlice);
    server.addClient('bob', ackBob);

    // Alice's op arrives first
    server.receiveFromClient('alice', {
      type: 'operation',
      revision: 0,
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' }],
    });
    expect(server.getRevision()).toBe(1);

    // Bob's op arrives second (also based on revision 0)
    server.receiveFromClient('bob', {
      type: 'operation',
      revision: 0,
      ops: [{ type: 'insertText', line: 0, column: 0, text: 'B', origin: 'input' }],
    });
    expect(server.getRevision()).toBe(2);

    // Alice gets revision 1, Bob gets revision 2
    expect(ackAlice).toHaveBeenCalledWith({ type: 'ack', revision: 1 });
    expect(ackBob).toHaveBeenCalledWith({ type: 'ack', revision: 2 });
  });
});

describe('Stress scenarios', () => {
  /**
   * Helper to run a two-user collaboration scenario using pure OT
   * (no server), which allows precise control over convergence.
   */
  function assertOTConvergence(baseText: string, opsA: Operation[], opsB: Operation[]): void {
    const baseDoc = createDocument(baseText);
    const docA = applyOperations(baseDoc, opsA);
    const docB = applyOperations(baseDoc, opsB);
    const [aPrime, bPrime] = transformOps(opsA, opsB);
    const finalA = applyOperations(docA, bPrime);
    const finalB = applyOperations(docB, aPrime);
    expect(getText(finalA)).toBe(getText(finalB));
  }

  it('rapid fire 20 ops from each user (OT engine)', () => {
    const baseText = 'The quick brown fox jumps over the lazy dog';
    const aliceOps: Operation[] = [];
    for (let i = 0; i < 20; i++) {
      aliceOps.push({
        type: 'insertText',
        line: 0,
        column: i,
        text: String.fromCharCode(65 + (i % 26)),
        origin: 'input' as const,
      });
    }
    const bobOps: Operation[] = [];
    for (let i = 0; i < 20; i++) {
      bobOps.push({
        type: 'insertText',
        line: 0,
        column: baseText.length + i,
        text: String.fromCharCode(97 + (i % 26)),
        origin: 'remote' as const,
      });
    }
    assertOTConvergence(baseText, aliceOps, bobOps);
  });

  it('one user types while other deletes from same area (OT engine)', () => {
    const baseText = 'Hello Beautiful World';
    const aliceOps: Operation[] = [
      { type: 'insertText', line: 0, column: 6, text: 'SUPER ', origin: 'input' },
    ];
    const bobOps: Operation[] = [
      { type: 'deleteText', line: 0, column: 6, length: 10, origin: 'remote' },
    ];
    assertOTConvergence(baseText, aliceOps, bobOps);
  });

  it('sequential round trips: 10 exchanges verify convergence (OT engine)', () => {
    let baseDoc = createDocument('Start');
    let doc1 = baseDoc;
    let doc2 = baseDoc;

    for (let round = 0; round < 10; round++) {
      const text1 = getText(doc1);
      const aliceOp: Operation = {
        type: 'insertText',
        line: 0,
        column: 0,
        text: String.fromCharCode(65 + round),
        origin: 'input',
      };
      const bobOp: Operation = {
        type: 'insertText',
        line: 0,
        column: text1.length,
        text: String.fromCharCode(97 + round),
        origin: 'remote',
      };

      doc1 = applyOperations(doc1, [aliceOp]);
      doc2 = applyOperations(doc2, [bobOp]);

      const [aPrime, bPrime] = transformOps([aliceOp], [bobOp]);
      doc1 = applyOperations(doc1, bPrime);
      doc2 = applyOperations(doc2, aPrime);

      expect(getText(doc1)).toBe(getText(doc2));
    }
  });

  it('rapid typing through full client-server stack does not duplicate text', () => {
    const setup = createManualSetup();
    const { client: alice } = setup.createClient('alice', '#ff0000');
    const { client: bob } = setup.createClient('bob', '#00ff00');

    let docAlice = createDocument('');
    let docBob = createDocument('');

    alice.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docAlice = applyOperations(docAlice, remoteOps);
    });

    bob.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docBob = applyOperations(docBob, remoteOps);
    });

    // Alice types "Hello" one character at a time (all concurrent, no delivery)
    let aliceCol = 0;
    for (const ch of 'Hello') {
      const op: Operation = {
        type: 'insertText',
        line: 0,
        column: aliceCol,
        text: ch,
        origin: 'input',
      };
      docAlice = applyOperations(docAlice, [op]);
      alice.applyLocal([op]);
      aliceCol++;
    }

    // Bob types "World" one character at a time (all concurrent, no delivery)
    let bobCol = 0;
    for (const ch of 'World') {
      const op: Operation = {
        type: 'insertText',
        line: 0,
        column: bobCol,
        text: ch,
        origin: 'input',
      };
      docBob = applyOperations(docBob, [op]);
      bob.applyLocal([op]);
      bobCol++;
    }

    // Now deliver all messages back and forth until stable
    for (let round = 0; round < 20; round++) {
      setup.deliverToServer();
      setup.deliverToClient('alice', alice);
      setup.deliverToClient('bob', bob);
    }

    // Documents should converge
    expect(getText(docAlice)).toBe(getText(docBob));
    // No duplication: total length should be "Hello".length + "World".length = 10
    expect(getText(docAlice).length).toBe(10);

    alice.destroy();
    bob.destroy();
  });

  it('rapid typing does not duplicate with debounce enabled', () => {
    vi.useFakeTimers();

    const server = new CollaborationServer();

    const alice = new CollaborationClient({
      userId: 'alice',
      color: '#ff0000',
      debounceDelay: 50,
      send: (msg) => {
        server.receiveFromClient('alice', msg);
      },
    });

    const bob = new CollaborationClient({
      userId: 'bob',
      color: '#00ff00',
      debounceDelay: 50,
      send: (msg) => {
        server.receiveFromClient('bob', msg);
      },
    });

    server.addClient('alice', (msg) => alice.handleMessage(msg));
    server.addClient('bob', (msg) => bob.handleMessage(msg));

    let docAlice = createDocument('');
    let docBob = createDocument('');

    alice.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docAlice = applyOperations(docAlice, remoteOps);
    });

    bob.onRemoteOperations((ops) => {
      const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
      docBob = applyOperations(docBob, remoteOps);
    });

    // Alice types "AB" rapidly
    const opA: Operation = { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' };
    docAlice = applyOperations(docAlice, [opA]);
    alice.applyLocal([opA]);

    const opB: Operation = { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' };
    docAlice = applyOperations(docAlice, [opB]);
    alice.applyLocal([opB]);

    // Flush the debounce
    vi.advanceTimersByTime(50);

    // Both documents should converge
    expect(getText(docAlice)).toBe(getText(docBob));
    expect(getText(docAlice)).toBe('AB');

    alice.destroy();
    bob.destroy();

    vi.useRealTimers();
  });
});

describe('Debounce behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces ops in synchronized state', () => {
    const sent: ClientMessage[] = [];
    const client = new CollaborationClient({
      userId: 'user1',
      color: '#ff0000',
      debounceDelay: 100,
      send: (msg) => sent.push(msg),
    });

    client.applyLocal([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);

    // Not sent yet (debouncing)
    expect(sent).toHaveLength(0);
    expect(client.getState()).toBe('synchronized');

    // Add more ops during debounce window
    client.applyLocal([
      { type: 'insertText', line: 0, column: 1, text: 'B', origin: 'input' },
    ]);

    expect(sent).toHaveLength(0);

    // Flush debounce
    vi.advanceTimersByTime(100);

    // Now sent as a single batch
    expect(sent).toHaveLength(1);
    expect(client.getState()).toBe('awaitingConfirm');
    const msg = sent[0] as { type: 'operation'; ops: Operation[] };
    expect(msg.ops).toHaveLength(2);

    client.destroy();
  });
});
