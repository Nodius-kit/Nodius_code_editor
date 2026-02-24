import type { KeymapRegistry } from '../core/keymap/KeymapRegistry';

export type InputAction =
  | { type: 'command'; commandId: string }
  | { type: 'insertText'; text: string }
  | { type: 'deleteBackward' }
  | { type: 'deleteForward' }
  | { type: 'newLine' }
  | { type: 'none' };

export type InputActionHandler = (action: InputAction) => void;

export class InputHandler {
  private container: HTMLElement | null = null;
  private keymapRegistry: KeymapRegistry;
  private handler: InputActionHandler | null = null;
  private composing: boolean = false;

  // Bound handlers for cleanup
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundBeforeInput: (e: InputEvent) => void;
  private boundCompositionStart: () => void;
  private boundCompositionEnd: (e: CompositionEvent) => void;
  private boundPaste: (e: ClipboardEvent) => void;
  private boundCopy: (e: ClipboardEvent) => void;
  private boundCut: (e: ClipboardEvent) => void;

  constructor(keymapRegistry: KeymapRegistry) {
    this.keymapRegistry = keymapRegistry;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundBeforeInput = this.onBeforeInput.bind(this);
    this.boundCompositionStart = () => { this.composing = true; };
    this.boundCompositionEnd = this.onCompositionEnd.bind(this);
    this.boundPaste = this.onPaste.bind(this);
    this.boundCopy = this.onCopy.bind(this);
    this.boundCut = this.onCut.bind(this);
  }

  attach(container: HTMLElement, handler: InputActionHandler): void {
    this.container = container;
    this.handler = handler;
    container.addEventListener('keydown', this.boundKeyDown);
    container.addEventListener('beforeinput', this.boundBeforeInput as EventListener);
    container.addEventListener('compositionstart', this.boundCompositionStart);
    container.addEventListener('compositionend', this.boundCompositionEnd as EventListener);
    container.addEventListener('paste', this.boundPaste as EventListener);
    container.addEventListener('copy', this.boundCopy as EventListener);
    container.addEventListener('cut', this.boundCut as EventListener);
  }

  detach(): void {
    if (!this.container) return;
    this.container.removeEventListener('keydown', this.boundKeyDown);
    this.container.removeEventListener('beforeinput', this.boundBeforeInput as EventListener);
    this.container.removeEventListener('compositionstart', this.boundCompositionStart);
    this.container.removeEventListener('compositionend', this.boundCompositionEnd as EventListener);
    this.container.removeEventListener('paste', this.boundPaste as EventListener);
    this.container.removeEventListener('copy', this.boundCopy as EventListener);
    this.container.removeEventListener('cut', this.boundCut as EventListener);
    this.container = null;
    this.handler = null;
  }

  private dispatch(action: InputAction): void {
    if (this.handler) this.handler(action);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.composing) return;
    const commandId = this.keymapRegistry.handleKeyDown(e);
    if (commandId) {
      e.preventDefault();
      this.dispatch({ type: 'command', commandId });
    }
  }

  private onBeforeInput(e: InputEvent): void {
    if (this.composing) return;
    switch (e.inputType) {
      case 'insertText':
        if (e.data) {
          e.preventDefault();
          this.dispatch({ type: 'insertText', text: e.data });
        }
        break;
      case 'insertParagraph':
      case 'insertLineBreak':
        e.preventDefault();
        this.dispatch({ type: 'newLine' });
        break;
      case 'deleteContentBackward':
        e.preventDefault();
        this.dispatch({ type: 'deleteBackward' });
        break;
      case 'deleteContentForward':
        e.preventDefault();
        this.dispatch({ type: 'deleteForward' });
        break;
    }
  }

  private onCompositionEnd(e: CompositionEvent): void {
    this.composing = false;
    if (e.data) {
      this.dispatch({ type: 'insertText', text: e.data });
    }
  }

  private onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      this.dispatch({ type: 'insertText', text });
    }
  }

  private onCopy(e: ClipboardEvent): void {
    e.preventDefault();
    this.dispatch({ type: 'command', commandId: 'copy' });
  }

  private onCut(e: ClipboardEvent): void {
    e.preventDefault();
    this.dispatch({ type: 'command', commandId: 'cut' });
  }
}
