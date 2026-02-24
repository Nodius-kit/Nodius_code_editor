import type { Line, Document } from '../types';

let lineCounter = 0;
let docCounter = 0;

function generateLineId(): string {
  return `l${lineCounter++}`;
}

function generateDocId(): string {
  return `d${docCounter++}`;
}

export function createLine(text: string): Line {
  return { id: generateLineId(), text };
}

export function createDocument(text?: string): Document {
  const content = text ?? '';
  const lines = content.split('\n').map((t) => createLine(t));
  return {
    id: generateDocId(),
    version: 0,
    lines,
  };
}

export function getText(doc: Document): string {
  return doc.lines.map((line) => line.text).join('\n');
}

export function getLineCount(doc: Document): number {
  return doc.lines.length;
}

export function getLine(doc: Document, index: number): Line | undefined {
  return doc.lines[index];
}

export function cloneDocumentWithLines(doc: Document, newLines: Line[]): Document {
  return {
    id: doc.id,
    version: doc.version + 1,
    lines: newLines,
  };
}
