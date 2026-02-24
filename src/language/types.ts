export interface LanguageDefinition {
  readonly id: string;
  readonly name: string;
  readonly extensions: readonly string[];
  readonly aliases?: readonly string[];
  readonly mimeTypes?: readonly string[];
}

export interface EditorToken {
  readonly kind: TokenKind;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

export type TokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'identifier'
  | 'type'
  | 'whitespace'
  | 'regexp'
  | 'template'
  | 'decorator'
  | 'plain';

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface EditorDiagnostic {
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  readonly code?: string | number;
  readonly source?: string;
}

export interface LanguageParser {
  readonly language: LanguageDefinition;
  tokenize(source: string): EditorToken[];
  parse(source: string): unknown;
  getDiagnostics(source: string): EditorDiagnostic[];
  getSemanticTokens?(source: string, ast: unknown): EditorToken[];
}
