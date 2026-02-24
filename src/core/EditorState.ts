import type {
  Document,
  MultiSelection,
  Transaction,
  EditorStateSnapshot,
} from './types';
import { applyOperations } from './operations/OperationEngine';
import { mapSelectionThroughOps, createSelection } from './selection/Selection';
import { createDocument } from './document/Document';

export class EditorState {
  private readonly _doc: Document;
  private readonly _selection: MultiSelection;
  private readonly _language: string;
  private readonly _fileName: string;

  constructor(snapshot?: EditorStateSnapshot) {
    if (snapshot) {
      this._doc = snapshot.doc;
      this._selection = snapshot.selection;
      this._language = snapshot.language;
      this._fileName = snapshot.fileName;
    } else {
      this._doc = createDocument('');
      this._selection = createSelection();
      this._language = 'plaintext';
      this._fileName = '';
    }
  }

  get doc(): Document {
    return this._doc;
  }

  get selection(): MultiSelection {
    return this._selection;
  }

  get language(): string {
    return this._language;
  }

  get fileName(): string {
    return this._fileName;
  }

  /**
   * Returns a plain snapshot of the current editor state.
   */
  get snapshot(): EditorStateSnapshot {
    return {
      doc: this._doc,
      selection: this._selection,
      language: this._language,
      fileName: this._fileName,
    };
  }

  /**
   * Apply a transaction and return a NEW EditorState instance.
   * The original state is not mutated (immutable pattern).
   */
  dispatch(transaction: Transaction): EditorState {
    const newDoc = applyOperations(this._doc, transaction.ops);

    // If the transaction provides an explicit selection, use it.
    // Otherwise, map the current selection through the operations.
    const newSelection = transaction.selection
      ? transaction.selection
      : mapSelectionThroughOps(this._selection, transaction.ops);

    return new EditorState({
      doc: newDoc,
      selection: newSelection,
      language: this._language,
      fileName: this._fileName,
    });
  }
}
