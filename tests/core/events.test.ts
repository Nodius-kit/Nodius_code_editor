import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/events/EventBus';

interface TestEvents {
  'test:event': { value: number };
  'other:event': { message: string };
  'empty:event': {};
}

describe('EventBus', () => {
  describe('on', () => {
    it('registers a handler and receives events', () => {
      const bus = new EventBus<TestEvents>();
      const handler = vi.fn();
      bus.on('test:event', handler);
      bus.emit('test:event', { value: 42 });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it('returns an unsubscribe function', () => {
      const bus = new EventBus<TestEvents>();
      const handler = vi.fn();
      const unsubscribe = bus.on('test:event', handler);

      bus.emit('test:event', { value: 1 });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      bus.emit('test:event', { value: 2 });
      expect(handler).toHaveBeenCalledTimes(1); // still 1, not called again
    });

    it('supports multiple handlers on the same event', () => {
      const bus = new EventBus<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test:event', handler1);
      bus.on('test:event', handler2);
      bus.emit('test:event', { value: 10 });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('removes a specific handler', () => {
      const bus = new EventBus<TestEvents>();
      const handler = vi.fn();
      bus.on('test:event', handler);

      bus.emit('test:event', { value: 1 });
      expect(handler).toHaveBeenCalledTimes(1);

      bus.off('test:event', handler);

      bus.emit('test:event', { value: 2 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not affect other handlers on the same event', () => {
      const bus = new EventBus<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test:event', handler1);
      bus.on('test:event', handler2);

      bus.off('test:event', handler1);

      bus.emit('test:event', { value: 5 });
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('does nothing when removing a handler that was never registered', () => {
      const bus = new EventBus<TestEvents>();
      const handler = vi.fn();
      // Should not throw
      bus.off('test:event', handler);
    });
  });

  describe('once', () => {
    it('fires the handler only once', () => {
      const bus = new EventBus<TestEvents>();
      const handler = vi.fn();
      bus.once('test:event', handler);

      bus.emit('test:event', { value: 1 });
      bus.emit('test:event', { value: 2 });
      bus.emit('test:event', { value: 3 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ value: 1 });
    });

    it('returns an unsubscribe function that prevents the handler from firing', () => {
      const bus = new EventBus<TestEvents>();
      const handler = vi.fn();
      const unsubscribe = bus.once('test:event', handler);

      unsubscribe();

      bus.emit('test:event', { value: 1 });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('calls all handlers registered for the event', () => {
      const bus = new EventBus<TestEvents>();
      const handlers = [vi.fn(), vi.fn(), vi.fn()];
      handlers.forEach((h) => bus.on('test:event', h));

      bus.emit('test:event', { value: 99 });

      handlers.forEach((h) => {
        expect(h).toHaveBeenCalledTimes(1);
        expect(h).toHaveBeenCalledWith({ value: 99 });
      });
    });

    it('does not call handlers registered for a different event', () => {
      const bus = new EventBus<TestEvents>();
      const testHandler = vi.fn();
      const otherHandler = vi.fn();
      bus.on('test:event', testHandler);
      bus.on('other:event', otherHandler);

      bus.emit('test:event', { value: 1 });

      expect(testHandler).toHaveBeenCalledTimes(1);
      expect(otherHandler).not.toHaveBeenCalled();
    });

    it('does nothing when emitting an event with no handlers', () => {
      const bus = new EventBus<TestEvents>();
      // Should not throw
      bus.emit('test:event', { value: 1 });
    });
  });

  describe('removeAllListeners', () => {
    it('clears all listeners for all events', () => {
      const bus = new EventBus<TestEvents>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.on('test:event', handler1);
      bus.on('other:event', handler2);

      bus.removeAllListeners();

      bus.emit('test:event', { value: 1 });
      bus.emit('other:event', { message: 'hi' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('allows new listeners to be added after clearing', () => {
      const bus = new EventBus<TestEvents>();
      const handler1 = vi.fn();
      bus.on('test:event', handler1);

      bus.removeAllListeners();

      const handler2 = vi.fn();
      bus.on('test:event', handler2);
      bus.emit('test:event', { value: 42 });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});
