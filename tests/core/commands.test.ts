import { describe, it, expect, vi } from 'vitest';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';

describe('CommandRegistry', () => {
  describe('register and execute', () => {
    it('registers a command and executes it successfully', () => {
      const registry = new CommandRegistry();
      const handler = vi.fn();
      registry.register('test.command', handler);

      const result = registry.execute('test.command');
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to the command handler', () => {
      const registry = new CommandRegistry();
      const handler = vi.fn();
      registry.register('test.command', handler);

      registry.execute('test.command', 'arg1', 42, { key: 'value' });
      expect(handler).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });

    it('overrides a previously registered command with the same id', () => {
      const registry = new CommandRegistry();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      registry.register('test.command', handler1);
      registry.register('test.command', handler2);

      registry.execute('test.command');
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute', () => {
    it('returns false for an unknown command', () => {
      const registry = new CommandRegistry();
      const result = registry.execute('nonexistent.command');
      expect(result).toBe(false);
    });
  });

  describe('has', () => {
    it('returns true for a registered command', () => {
      const registry = new CommandRegistry();
      registry.register('my.command', vi.fn());
      expect(registry.has('my.command')).toBe(true);
    });

    it('returns false for an unregistered command', () => {
      const registry = new CommandRegistry();
      expect(registry.has('unknown.command')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('returns all registered command ids', () => {
      const registry = new CommandRegistry();
      registry.register('cmd.a', vi.fn());
      registry.register('cmd.b', vi.fn());
      registry.register('cmd.c', vi.fn());

      const all = registry.getAll();
      expect(all).toContain('cmd.a');
      expect(all).toContain('cmd.b');
      expect(all).toContain('cmd.c');
      expect(all.length).toBe(3);
    });

    it('returns an empty array when no commands are registered', () => {
      const registry = new CommandRegistry();
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('removes a registered command and returns true', () => {
      const registry = new CommandRegistry();
      registry.register('my.command', vi.fn());

      const result = registry.unregister('my.command');
      expect(result).toBe(true);
      expect(registry.has('my.command')).toBe(false);
    });

    it('returns false when unregistering a command that does not exist', () => {
      const registry = new CommandRegistry();
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('makes execute return false for the removed command', () => {
      const registry = new CommandRegistry();
      const handler = vi.fn();
      registry.register('my.command', handler);

      registry.unregister('my.command');

      const result = registry.execute('my.command');
      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
