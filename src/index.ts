// ========== Nodius Code Editor - Public API ==========

// Main editor
export { NodiusEditor, NodiusEditorElement } from './NodiusEditor';

// Core types
export type {
  Line,
  Document,
  Position,
  Range,
  MultiSelection,
  Operation,
  OperationOrigin,
  Transaction,
  EditorOptions,
  EditorEvents,
  EditorStateSnapshot,
  HistoryEntry,
  CommandHandler,
  InsertTextOp,
  DeleteTextOp,
  InsertLineOp,
  DeleteLineOp,
  SplitLineOp,
  MergeLineOp,
  ReplaceLineOp,
  VersionVector,
  Delta,
  RemoteCursor,
} from './core/types';

// Document
export { createDocument, createLine, getText, getLineCount, getLine } from './core/document/Document';

// Operations
export { applyOperation, applyOperations } from './core/operations/OperationEngine';
export { createOp } from './core/operations/Operation';

// Selection
export {
  createPosition,
  createRange,
  createCollapsedRange,
  createSelection,
  isCollapsed,
  isSelectionCollapsed,
  rangeContains,
  mapPositionThrough,
  mapRangeThrough,
  mapSelectionThrough,
  mapSelectionThroughOps,
} from './core/selection/Selection';

// State
export { EditorState } from './core/EditorState';

// EventBus
export { EventBus } from './core/events/EventBus';

// History
export { HistoryManager } from './core/history/HistoryManager';

// Commands
export { CommandRegistry } from './core/commands/CommandRegistry';

// Keymap
export { KeymapRegistry } from './core/keymap/KeymapRegistry';
export type { KeyBinding } from './core/keymap/KeymapRegistry';

// Language system
export type {
  LanguageDefinition,
  EditorToken,
  TokenKind,
  DiagnosticSeverity,
  EditorDiagnostic,
  LanguageParser,
} from './language/types';
export { LanguageRegistry } from './language/LanguageRegistry';
export { TypeScriptParser } from './language/typescript/TypeScriptParser';
export { detectByExtension, detectByContent } from './language/detection';

// Collaboration
export type {
  TransportAdapter,
  CollaborationOptions,
  ClientMessage,
  ServerMessage,
  CollaborationClientOptions,
} from './collaboration/types';
export { transform, transformOps } from './collaboration/OTEngine';
export { CursorSync } from './collaboration/CursorSync';
export { CollaborationServer } from './collaboration/CollaborationServer';
export { CollaborationClient } from './collaboration/CollaborationClient';
/** @deprecated Use CollaborationClient instead. */
export { CollaborationClient as CollaborationManager } from './collaboration/CollaborationClient';
/** @deprecated No longer needed. Batching is handled by CollaborationClient's state machine. */
export { BatchedTransport } from './collaboration/BatchedTransport';

// Themes
export { ThemeManager } from './themes/ThemeManager';
export { darkTheme } from './themes/dark';
export { lightTheme } from './themes/light';

// View components (for advanced customization)
export { EditorView } from './view/EditorView';
export { LineRenderer } from './view/LineRenderer';
export { Reconciler } from './view/Reconciler';
export { Gutter } from './view/Gutter';
export { Minimap } from './view/Minimap';
export { StatusBar } from './view/StatusBar';
export { TabBar } from './view/TabBar';
export { Sidebar } from './view/Sidebar';
export { ScrollManager } from './view/ScrollManager';
export { InputHandler } from './view/InputHandler';
export { SelectionDOM } from './view/SelectionDOM';
export { FindReplace } from './view/FindReplace';
export type { SearchOptions, FindReplaceHandlers } from './view/FindReplace';
