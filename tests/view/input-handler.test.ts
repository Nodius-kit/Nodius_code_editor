import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputHandler, InputAction } from '../../src/view/InputHandler';
import { KeymapRegistry } from '../../src/core/keymap/KeymapRegistry';

describe('InputHandler', () => {
  let keymapRegistry: KeymapRegistry;
  let handler: InputHandler;
  let actions: InputAction[];
  let container: HTMLElement;

  beforeEach(() => {
    keymapRegistry = new KeymapRegistry();
    keymapRegistry.register({ key: 'z', ctrl: true, commandId: 'undo' });
    keymapRegistry.register({ key: 's', ctrl: true, commandId: 'save' });
    handler = new InputHandler(keymapRegistry);
    actions = [];
    container = document.createElement('div');
    handler.attach(container, (action) => actions.push(action));
  });

  it('dispatches command action on keydown matching keymap', () => {
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'command', commandId: 'undo' });
  });

  it('does not dispatch on keydown that does not match any binding', () => {
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    );

    expect(actions).toHaveLength(0);
  });

  it('dispatches insertText on beforeinput with inputType insertText', () => {
    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'a',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'insertText', text: 'a' });
  });

  it('dispatches deleteBackward on beforeinput with deleteContentBackward', () => {
    const event = new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'deleteBackward' });
  });

  it('dispatches deleteForward on beforeinput with deleteContentForward', () => {
    const event = new InputEvent('beforeinput', {
      inputType: 'deleteContentForward',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'deleteForward' });
  });

  it('dispatches newLine on beforeinput with insertParagraph', () => {
    const event = new InputEvent('beforeinput', {
      inputType: 'insertParagraph',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'newLine' });
  });

  it('dispatches newLine on beforeinput with insertLineBreak', () => {
    const event = new InputEvent('beforeinput', {
      inputType: 'insertLineBreak',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'newLine' });
  });

  it('does not dispatch during composition (composing = true)', () => {
    // Start composition
    container.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true })
    );

    // Keydown during composition should be ignored
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    );

    // beforeinput during composition should be ignored
    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'k',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(0);
  });

  it('dispatches insertText on compositionend with data', () => {
    // Start composition
    container.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true })
    );

    // End composition with data
    container.dispatchEvent(
      new CompositionEvent('compositionend', { data: 'konnichiwa', bubbles: true })
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'insertText', text: 'konnichiwa' });
  });

  it('resumes normal dispatching after compositionend', () => {
    container.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true })
    );
    container.dispatchEvent(
      new CompositionEvent('compositionend', { data: 'abc', bubbles: true })
    );

    // Now composing is false, so normal keydown should work
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    );

    expect(actions).toHaveLength(2);
    expect(actions[0]).toEqual({ type: 'insertText', text: 'abc' });
    expect(actions[1]).toEqual({ type: 'command', commandId: 'undo' });
  });

  it('detach removes all listeners', () => {
    handler.detach();

    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    );

    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'x',
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(0);
  });

  it('dispatches command for copy event', () => {
    // jsdom does not define ClipboardEvent globally; use Event as fallback
    const EventCtor = typeof ClipboardEvent !== 'undefined' ? ClipboardEvent : Event;
    const event = new EventCtor('copy', { bubbles: true });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'command', commandId: 'copy' });
  });

  it('dispatches command for cut event', () => {
    const EventCtor = typeof ClipboardEvent !== 'undefined' ? ClipboardEvent : Event;
    const event = new EventCtor('cut', { bubbles: true });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'command', commandId: 'cut' });
  });

  it('does not dispatch insertText on beforeinput when data is null', () => {
    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: null,
      bubbles: true,
    });
    container.dispatchEvent(event);

    expect(actions).toHaveLength(0);
  });

  it('does not dispatch insertText on compositionend with empty data', () => {
    container.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true })
    );
    container.dispatchEvent(
      new CompositionEvent('compositionend', { data: '', bubbles: true })
    );

    expect(actions).toHaveLength(0);
  });

  it('matches different keymap bindings', () => {
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'command', commandId: 'save' });
  });

  describe('Edge cases', () => {
    it('multiple rapid keydown events', () => {
      for (let i = 0; i < 20; i++) {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
        );
      }

      expect(actions).toHaveLength(20);
      for (const action of actions) {
        expect(action).toEqual({ type: 'command', commandId: 'undo' });
      }
    });

    it('beforeinput with unknown inputType does nothing', () => {
      const event = new InputEvent('beforeinput', {
        inputType: 'formatBold',
        bubbles: true,
      });
      container.dispatchEvent(event);

      expect(actions).toHaveLength(0);
    });

    it('detach then try to dispatch (should not throw)', () => {
      handler.detach();

      // Dispatching events after detach should not throw
      expect(() => {
        container.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
        );
      }).not.toThrow();

      expect(() => {
        container.dispatchEvent(
          new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: 'a',
            bubbles: true,
          })
        );
      }).not.toThrow();

      // No actions should have been dispatched
      expect(actions).toHaveLength(0);
    });

    it('reattach after detach works', () => {
      handler.detach();

      // No events should be handled after detach
      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
      expect(actions).toHaveLength(0);

      // Reattach to the same container with a new handler callback
      const newActions: InputAction[] = [];
      handler.attach(container, (action) => newActions.push(action));

      container.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
      );
      expect(newActions).toHaveLength(1);
      expect(newActions[0]).toEqual({ type: 'command', commandId: 'undo' });

      // Also verify beforeinput works after reattach
      container.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: 'x',
          bubbles: true,
        })
      );
      expect(newActions).toHaveLength(2);
      expect(newActions[1]).toEqual({ type: 'insertText', text: 'x' });
    });
  });
});
