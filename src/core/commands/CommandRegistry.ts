import type { CommandHandler } from '../types';

export class CommandRegistry {
  private commands: Map<string, CommandHandler> = new Map();

  /**
   * Register a command handler for the given id.
   */
  register(id: string, handler: CommandHandler): void {
    this.commands.set(id, handler);
  }

  /**
   * Execute a command by id. Returns false if the command is not found.
   */
  execute(id: string, ...args: unknown[]): boolean {
    const handler = this.commands.get(id);
    if (!handler) {
      return false;
    }
    handler(...args);
    return true;
  }

  /**
   * Check whether a command with the given id exists.
   */
  has(id: string): boolean {
    return this.commands.has(id);
  }

  /**
   * Return all registered command ids.
   */
  getAll(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Remove a command by id. Returns true if it existed.
   */
  unregister(id: string): boolean {
    return this.commands.delete(id);
  }
}
