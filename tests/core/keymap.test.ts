import { describe, it, expect } from 'vitest';
import { KeymapRegistry } from '../../src/core/keymap/KeymapRegistry';

function createKeyEvent(
  key: string,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false,
    metaKey: modifiers.metaKey ?? false,
  });
}

describe('KeymapRegistry', () => {
  describe('registerDefaults', () => {
    it('registers default key bindings', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      // Ctrl+Z should map to undo
      const event = createKeyEvent('z', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('undo');
    });

    it('registers Ctrl+Shift+Z as redo', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('z', { ctrlKey: true, shiftKey: true });
      expect(registry.handleKeyDown(event)).toBe('redo');
    });

    it('registers Ctrl+Y as redo', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('y', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('redo');
    });

    it('registers Ctrl+C as copy', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('c', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('copy');
    });

    it('registers Ctrl+X as cut', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('x', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('cut');
    });

    it('registers Ctrl+V as paste', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('v', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('paste');
    });

    it('registers Ctrl+A as selectAll', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('a', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('selectAll');
    });

    it('registers Tab as indent', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('tab');
      expect(registry.handleKeyDown(event)).toBe('indent');
    });

    it('registers Shift+Tab as outdent', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('tab', { shiftKey: true });
      expect(registry.handleKeyDown(event)).toBe('outdent');
    });

    it('registers Ctrl+S as save', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('s', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('save');
    });

    it('registers Ctrl+F as find', () => {
      const registry = new KeymapRegistry();
      registry.registerDefaults();

      const event = createKeyEvent('f', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('find');
    });
  });

  describe('handleKeyDown', () => {
    it('returns the correct commandId for a matching binding', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'a', ctrl: true, commandId: 'selectAll' });

      const event = createKeyEvent('a', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('selectAll');
    });

    it('returns null when no binding matches', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'a', ctrl: true, commandId: 'selectAll' });

      const event = createKeyEvent('b', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBeNull();
    });

    it('returns null for an empty registry', () => {
      const registry = new KeymapRegistry();
      const event = createKeyEvent('z', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBeNull();
    });
  });

  describe('later bindings override earlier ones', () => {
    it('returns the later binding when two bindings match the same key combo', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'z', ctrl: true, commandId: 'undo' });
      registry.register({ key: 'z', ctrl: true, commandId: 'customUndo' });

      const event = createKeyEvent('z', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('customUndo');
    });
  });

  describe('modifier keys are checked correctly', () => {
    it('does not match when ctrl is required but not pressed', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'z', ctrl: true, commandId: 'undo' });

      const event = createKeyEvent('z'); // no ctrl
      expect(registry.handleKeyDown(event)).toBeNull();
    });

    it('does not match when ctrl is pressed but not required', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'tab', commandId: 'indent' });

      const event = createKeyEvent('tab', { ctrlKey: true }); // ctrl is pressed but binding has no ctrl
      expect(registry.handleKeyDown(event)).toBeNull();
    });

    it('does not match when shift is required but not pressed', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'tab', shift: true, commandId: 'outdent' });

      const event = createKeyEvent('tab'); // no shift
      expect(registry.handleKeyDown(event)).toBeNull();
    });

    it('does not match when alt is required but not pressed', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'a', alt: true, commandId: 'altAction' });

      const event = createKeyEvent('a'); // no alt
      expect(registry.handleKeyDown(event)).toBeNull();
    });

    it('does not match when meta is required but not pressed', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'a', meta: true, commandId: 'metaAction' });

      const event = createKeyEvent('a'); // no meta
      expect(registry.handleKeyDown(event)).toBeNull();
    });

    it('matches when all required modifiers are pressed', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'a', ctrl: true, shift: true, alt: true, commandId: 'complex' });

      const event = createKeyEvent('a', { ctrlKey: true, shiftKey: true, altKey: true });
      expect(registry.handleKeyDown(event)).toBe('complex');
    });

    it('key matching is case-insensitive', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'Z', ctrl: true, commandId: 'undo' });

      const event = createKeyEvent('z', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('undo');
    });
  });

  describe('unregister', () => {
    it('removes all bindings for a given command', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'z', ctrl: true, commandId: 'undo' });
      registry.register({ key: 'z', meta: true, commandId: 'undo' });

      registry.unregister('undo');

      const event1 = createKeyEvent('z', { ctrlKey: true });
      expect(registry.handleKeyDown(event1)).toBeNull();

      const event2 = createKeyEvent('z', { metaKey: true });
      expect(registry.handleKeyDown(event2)).toBeNull();
    });

    it('does not remove bindings for other commands', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'z', ctrl: true, commandId: 'undo' });
      registry.register({ key: 'c', ctrl: true, commandId: 'copy' });

      registry.unregister('undo');

      const event = createKeyEvent('c', { ctrlKey: true });
      expect(registry.handleKeyDown(event)).toBe('copy');
    });
  });

  describe('getBindingsForCommand', () => {
    it('returns all bindings associated with a specific command', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'z', ctrl: true, commandId: 'undo' });
      registry.register({ key: 'z', meta: true, commandId: 'undo' });
      registry.register({ key: 'c', ctrl: true, commandId: 'copy' });

      const bindings = registry.getBindingsForCommand('undo');
      expect(bindings.length).toBe(2);
      expect(bindings[0].key).toBe('z');
      expect(bindings[0].ctrl).toBe(true);
      expect(bindings[1].key).toBe('z');
      expect(bindings[1].meta).toBe(true);
    });

    it('returns an empty array when no bindings match the command', () => {
      const registry = new KeymapRegistry();
      registry.register({ key: 'z', ctrl: true, commandId: 'undo' });

      const bindings = registry.getBindingsForCommand('nonexistent');
      expect(bindings).toEqual([]);
    });

    it('returns an empty array for an empty registry', () => {
      const registry = new KeymapRegistry();
      const bindings = registry.getBindingsForCommand('anything');
      expect(bindings).toEqual([]);
    });
  });
});
