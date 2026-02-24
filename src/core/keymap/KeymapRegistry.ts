export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  commandId: string;
}

export class KeymapRegistry {
  private bindings: KeyBinding[] = [];

  /**
   * Register a new key binding.
   */
  register(binding: KeyBinding): void {
    this.bindings.push(binding);
  }

  /**
   * Register VS Code-like default key bindings.
   */
  registerDefaults(): void {
    this.register({ key: 'z', ctrl: true, commandId: 'undo' });
    this.register({ key: 'z', ctrl: true, shift: true, commandId: 'redo' });
    this.register({ key: 'y', ctrl: true, commandId: 'redo' });
    this.register({ key: 'c', ctrl: true, commandId: 'copy' });
    this.register({ key: 'x', ctrl: true, commandId: 'cut' });
    this.register({ key: 'v', ctrl: true, commandId: 'paste' });
    this.register({ key: 'a', ctrl: true, commandId: 'selectAll' });
    this.register({ key: 'tab', commandId: 'indent' });
    this.register({ key: 'tab', shift: true, commandId: 'outdent' });
    this.register({ key: 'd', ctrl: true, commandId: 'duplicateLine' });
    this.register({ key: '/', ctrl: true, commandId: 'toggleComment' });
    this.register({ key: 's', ctrl: true, commandId: 'save' });
    this.register({ key: 'f', ctrl: true, commandId: 'find' });
    this.register({ key: 'h', ctrl: true, commandId: 'replace' });
  }

  /**
   * Handle a keyboard event and return the matching command id, or null.
   * Later-registered bindings take priority (checked last to first).
   */
  handleKeyDown(event: KeyboardEvent): string | null {
    const key = this.normalizeKey(event.key);

    // Iterate from last to first so later bindings override earlier ones
    for (let i = this.bindings.length - 1; i >= 0; i--) {
      const binding = this.bindings[i];
      if (this.normalizeKey(binding.key) !== key) continue;
      if (!!binding.ctrl !== event.ctrlKey) continue;
      if (!!binding.shift !== event.shiftKey) continue;
      if (!!binding.alt !== event.altKey) continue;
      if (!!binding.meta !== event.metaKey) continue;
      return binding.commandId;
    }

    return null;
  }

  /**
   * Remove all bindings for the given command id.
   */
  unregister(commandId: string): void {
    this.bindings = this.bindings.filter((b) => b.commandId !== commandId);
  }

  /**
   * Return all bindings associated with a specific command id.
   */
  getBindingsForCommand(commandId: string): KeyBinding[] {
    return this.bindings.filter((b) => b.commandId === commandId);
  }

  /**
   * Normalize a key name to lowercase.
   */
  private normalizeKey(key: string): string {
    return key.toLowerCase();
  }
}
