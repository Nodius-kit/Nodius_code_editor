import type { Position } from '../types';

export type CompletionItemKind =
  | 'function' | 'method' | 'property' | 'variable' | 'class'
  | 'interface' | 'keyword' | 'snippet' | 'constant' | 'enum'
  | 'module' | 'type' | 'field' | 'value' | 'text';

export interface CompletionItem {
  readonly label: string;
  readonly kind: CompletionItemKind;
  readonly insertText?: string;
  readonly detail?: string;
  readonly documentation?: string;
  readonly sortText?: string;
  readonly filterText?: string;
}

export interface CompletionContext {
  readonly documentText: string;
  readonly position: Position;
  readonly lineText: string;
  readonly wordPrefix: string;
  readonly triggerKind: 'invoke' | 'triggerCharacter' | 'automatic';
  readonly triggerCharacter?: string;
  readonly language: string;
  readonly fileName: string;
}

export interface CompletionList {
  readonly items: readonly CompletionItem[];
  readonly isIncomplete?: boolean;
}

export interface CompletionProvider {
  readonly triggerCharacters?: readonly string[];
  provideCompletions(context: CompletionContext): CompletionList | Promise<CompletionList>;
  resolveItem?(item: CompletionItem, context: CompletionContext): CompletionItem | Promise<CompletionItem>;
}

export interface CompletionResult {
  readonly items: CompletionItem[];
  readonly replaceStart: number;
  readonly replaceEnd: number;
  readonly isIncomplete: boolean;
}
