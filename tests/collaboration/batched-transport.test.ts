import { describe, it, expect, vi } from 'vitest';
import { BatchedTransport } from '../../src/collaboration/BatchedTransport';
import type { TransportAdapter } from '../../src/collaboration/types';
import type { Delta, Position } from '../../src/core/types';

function createMockTransport(): TransportAdapter & {
  sentDeltas: Delta[];
  sentCursors: Array<{ userId: string; position: Position; color: string }>;
} {
  const sentDeltas: Delta[] = [];
  const sentCursors: Array<{ userId: string; position: Position; color: string }> = [];
  let receiveHandler: ((delta: Delta) => void) | null = null;
  let cursorHandler: ((userId: string, position: Position, color: string) => void) | null = null;
  return {
    sentDeltas,
    sentCursors,
    send(delta: Delta) { sentDeltas.push(delta); },
    onReceive(handler) { receiveHandler = handler; },
    sendCursor(userId, position, color) { sentCursors.push({ userId, position, color }); },
    onCursorUpdate(handler) { cursorHandler = handler; },
    disconnect() {},
  };
}

describe('BatchedTransport (deprecated - no-op stub)', () => {
  it('can be created without errors', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);
    expect(transport).toBeDefined();
  });

  it('queueOps is a no-op', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);

    transport.queueOps([
      { type: 'insertText', line: 0, column: 0, text: 'A', origin: 'input' },
    ]);

    // No-op: nothing sent
    expect(mock.sentDeltas).toHaveLength(0);
  });

  it('flush is a no-op', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);

    transport.flush();

    expect(mock.sentDeltas).toHaveLength(0);
  });

  it('sendCursor delegates to transport', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);

    const position: Position = { line: 3, column: 7 };
    transport.sendCursor(position, '#ff0000');

    expect(mock.sentCursors).toHaveLength(1);
    expect(mock.sentCursors[0]).toEqual({
      userId: 'user1',
      position: { line: 3, column: 7 },
      color: '#ff0000',
    });
  });

  it('onReceive registers handler on transport', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);

    const handler = vi.fn();
    transport.onReceive(handler);

    // Verify no error
    expect(handler).not.toHaveBeenCalled();
  });

  it('onCursorUpdate registers handler on transport', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);

    const handler = vi.fn();
    transport.onCursorUpdate(handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy is a no-op', () => {
    const mock = createMockTransport();
    const transport = new BatchedTransport(mock, 'user1', 300, 50);

    // Should not throw
    expect(() => transport.destroy()).not.toThrow();
  });
});
