import type { Document, Operation } from '../types';
import { createLine, cloneDocumentWithLines } from '../document/Document';

export function applyOperation(doc: Document, op: Operation): Document {
  switch (op.type) {
    case 'insertText': {
      const { line, column, text } = op;
      if (line < 0 || line >= doc.lines.length) return doc;
      const target = doc.lines[line];
      const newText = target.text.slice(0, column) + text + target.text.slice(column);
      const newLines = doc.lines.slice();
      newLines[line] = { id: target.id, text: newText };
      return cloneDocumentWithLines(doc, newLines);
    }

    case 'deleteText': {
      const { line, column, length } = op;
      if (line < 0 || line >= doc.lines.length) return doc;
      const target = doc.lines[line];
      const newText = target.text.slice(0, column) + target.text.slice(column + length);
      const newLines = doc.lines.slice();
      newLines[line] = { id: target.id, text: newText };
      return cloneDocumentWithLines(doc, newLines);
    }

    case 'insertLine': {
      const { index, text } = op;
      if (index < 0 || index > doc.lines.length) return doc;
      const newLines = doc.lines.slice();
      newLines.splice(index, 0, createLine(text));
      return cloneDocumentWithLines(doc, newLines);
    }

    case 'deleteLine': {
      const { index } = op;
      if (index < 0 || index >= doc.lines.length) return doc;
      const newLines = doc.lines.slice();
      newLines.splice(index, 1);
      return cloneDocumentWithLines(doc, newLines);
    }

    case 'splitLine': {
      const { line, column } = op;
      if (line < 0 || line >= doc.lines.length) return doc;
      const target = doc.lines[line];
      const before = target.text.slice(0, column);
      const after = target.text.slice(column);
      const newLines = doc.lines.slice();
      newLines[line] = { id: target.id, text: before };
      newLines.splice(line + 1, 0, createLine(after));
      return cloneDocumentWithLines(doc, newLines);
    }

    case 'mergeLine': {
      const { line } = op;
      if (line < 0 || line >= doc.lines.length - 1) return doc;
      const current = doc.lines[line];
      const next = doc.lines[line + 1];
      const mergedText = current.text + next.text;
      const newLines = doc.lines.slice();
      newLines[line] = { id: current.id, text: mergedText };
      newLines.splice(line + 1, 1);
      return cloneDocumentWithLines(doc, newLines);
    }

    case 'replaceLine': {
      const { index, text } = op;
      if (index < 0 || index >= doc.lines.length) return doc;
      const target = doc.lines[index];
      const newLines = doc.lines.slice();
      newLines[index] = { id: target.id, text };
      return cloneDocumentWithLines(doc, newLines);
    }

    default:
      return doc;
  }
}

export function applyOperations(doc: Document, ops: readonly Operation[]): Document {
  return ops.reduce<Document>((d, op) => applyOperation(d, op), doc);
}
