// ========== Document Types ==========

export interface Line {
  readonly id: string;
  readonly text: string;
}

export interface Document {
  readonly id: string;
  readonly version: number;
  readonly lines: readonly Line[];
}

// ========== Position & Selection Types ==========

export interface Position {
  readonly line: number;
  readonly column: number;
}

export interface Range {
  readonly anchor: Position;
  readonly focus: Position;
}

export interface MultiSelection {
  readonly ranges: readonly Range[];
  readonly primary: number;
}

// ========== Operation Types ==========

export type OperationOrigin = 'input' | 'remote' | 'history:undo' | 'history:redo' | 'command';

export interface InsertTextOp {
  readonly type: 'insertText';
  readonly line: number;
  readonly column: number;
  readonly text: string;
  readonly origin: OperationOrigin;
}

export interface DeleteTextOp {
  readonly type: 'deleteText';
  readonly line: number;
  readonly column: number;
  readonly length: number;
  readonly origin: OperationOrigin;
}

export interface InsertLineOp {
  readonly type: 'insertLine';
  readonly index: number;
  readonly text: string;
  readonly origin: OperationOrigin;
}

export interface DeleteLineOp {
  readonly type: 'deleteLine';
  readonly index: number;
  readonly origin: OperationOrigin;
}

export interface SplitLineOp {
  readonly type: 'splitLine';
  readonly line: number;
  readonly column: number;
  readonly origin: OperationOrigin;
}

export interface MergeLineOp {
  readonly type: 'mergeLine';
  readonly line: number;
  readonly origin: OperationOrigin;
}

export interface ReplaceLineOp {
  readonly type: 'replaceLine';
  readonly index: number;
  readonly text: string;
  readonly origin: OperationOrigin;
}

export type Operation =
  | InsertTextOp
  | DeleteTextOp
  | InsertLineOp
  | DeleteLineOp
  | SplitLineOp
  | MergeLineOp
  | ReplaceLineOp;

// ========== Transaction ==========

export interface Transaction {
  readonly ops: readonly Operation[];
  readonly selection?: MultiSelection;
  readonly origin: OperationOrigin;
}

// ========== Event Types ==========

export interface EditorEvents {
  'state:change': { state: EditorStateSnapshot };
  'selection:change': { selection: MultiSelection };
  'content:change': { document: Document; ops: readonly Operation[] };
  'mount': { container: HTMLElement };
  'destroy': {};
  'language:change': { languageId: string };
  'theme:change': { theme: string };
}

// ========== State Snapshot ==========

export interface EditorStateSnapshot {
  readonly doc: Document;
  readonly selection: MultiSelection;
  readonly language: string;
  readonly fileName: string;
}

// ========== History ==========

export interface HistoryEntry {
  readonly doc: Document;
  readonly selection: MultiSelection;
  readonly timestamp: number;
}

// ========== Command ==========

export type CommandHandler = (...args: unknown[]) => void;

// ========== Editor Options ==========

export interface EditorOptions {
  value?: string;
  language?: string;
  fileName?: string;
  theme?: 'dark' | 'light';
  readOnly?: boolean;
  fontSize?: number;
  tabSize?: number;
  minimap?: boolean;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  // UI component visibility options
  tabBar?: boolean;       // Show tab bar (default: true)
  sidebar?: boolean;      // Show sidebar (default: true)
  statusBar?: boolean;    // Show status bar (default: true)
  findReplace?: boolean;  // Enable find/replace (default: true)
  autocomplete?: boolean; // Enable autocomplete (default: true)
}

// ========== Collaboration Types ==========

export interface VersionVector {
  readonly [userId: string]: number;
}

export interface Delta {
  readonly userId: string;
  readonly version: number;
  readonly baseVersion: number; // Last remote version this user had seen when sending
  readonly ops: readonly Operation[];
  readonly timestamp: number;
}

export interface RemoteCursor {
  readonly userId: string;
  readonly position: Position;
  readonly color: string;
  readonly name?: string;
}
