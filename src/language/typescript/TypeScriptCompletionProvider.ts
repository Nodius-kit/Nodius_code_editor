import ts from 'typescript';
import type {
  CompletionItem,
  CompletionItemKind,
  CompletionContext,
  CompletionList,
  CompletionProvider,
} from '../../core/completion/types';
import libFiles from 'virtual:ts-lib-files';

const TS_KIND_MAP: Record<string, CompletionItemKind> = {
  [ts.ScriptElementKind.functionElement]: 'function',
  [ts.ScriptElementKind.memberFunctionElement]: 'method',
  [ts.ScriptElementKind.memberVariableElement]: 'property',
  [ts.ScriptElementKind.memberGetAccessorElement]: 'property',
  [ts.ScriptElementKind.memberSetAccessorElement]: 'property',
  [ts.ScriptElementKind.variableElement]: 'variable',
  [ts.ScriptElementKind.localVariableElement]: 'variable',
  [ts.ScriptElementKind.classElement]: 'class',
  [ts.ScriptElementKind.interfaceElement]: 'interface',
  [ts.ScriptElementKind.keyword]: 'keyword',
  [ts.ScriptElementKind.constElement]: 'constant',
  [ts.ScriptElementKind.enumElement]: 'enum',
  [ts.ScriptElementKind.enumMemberElement]: 'field',
  [ts.ScriptElementKind.moduleElement]: 'module',
  [ts.ScriptElementKind.typeElement]: 'type',
  [ts.ScriptElementKind.alias]: 'variable',
  [ts.ScriptElementKind.letElement]: 'variable',
  [ts.ScriptElementKind.parameterElement]: 'variable',
  [ts.ScriptElementKind.string]: 'text',
};

function mapKind(tsKind: string): CompletionItemKind {
  return TS_KIND_MAP[tsKind] ?? 'text';
}

/** Names of the lib files we provide to the language service. */
const LIB_FILE_NAMES = Object.keys(libFiles);

class SingleFileHost implements ts.LanguageServiceHost {
  private content = '';
  private version = 0;
  private fname: string;

  constructor(fileName: string) {
    this.fname = fileName;
  }

  updateFile(text: string): void {
    this.content = text;
    this.version++;
  }

  getFileName(): string {
    return this.fname;
  }

  setFileName(name: string): void {
    this.fname = name;
  }

  getScriptFileNames(): string[] {
    return [this.fname, ...LIB_FILE_NAMES];
  }

  getScriptVersion(fileName: string): string {
    if (fileName === this.fname) return String(this.version);
    // Lib files never change
    return '1';
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    if (fileName === this.fname) {
      return ts.ScriptSnapshot.fromString(this.content);
    }
    // Serve lib files
    const libContent = libFiles[fileName];
    if (libContent !== undefined) {
      return ts.ScriptSnapshot.fromString(libContent);
    }
    return undefined;
  }

  getCompilationSettings(): ts.CompilerOptions {
    return {
      target: ts.ScriptTarget.ES2015,
      allowJs: true,
      module: ts.ModuleKind.ESNext,
      // Don't specify lib — we provide lib files explicitly via getScriptFileNames
    };
  }

  getDefaultLibFileName(): string {
    return 'lib.es5.d.ts';
  }

  fileExists(f: string): boolean {
    return f === this.fname || f in libFiles;
  }

  readFile(f: string): string | undefined {
    if (f === this.fname) return this.content;
    return libFiles[f];
  }

  getCurrentDirectory(): string {
    return '/';
  }
}

export class TypeScriptCompletionProvider implements CompletionProvider {
  readonly triggerCharacters: readonly string[] = ['.'];

  private host: SingleFileHost;
  private service: ts.LanguageService;

  constructor() {
    this.host = new SingleFileHost('file.ts');
    this.service = ts.createLanguageService(this.host, ts.createDocumentRegistry());
  }

  provideCompletions(context: CompletionContext): CompletionList {
    // Update the file name and content
    this.host.setFileName(context.fileName || 'file.ts');
    this.host.updateFile(context.documentText);

    // Convert line/column to offset
    const offset = this.getOffset(context.documentText, context.position.line, context.position.column);

    try {
      const completions = this.service.getCompletionsAtPosition(
        this.host.getFileName(),
        offset,
        {
          includeCompletionsWithInsertText: true,
          includeCompletionsForModuleExports: false,
        },
      );

      if (!completions) {
        return { items: [] };
      }

      const items: CompletionItem[] = completions.entries.map((entry) => ({
        label: entry.name,
        kind: mapKind(entry.kind),
        sortText: entry.sortText,
        insertText: entry.insertText,
      }));

      return { items, isIncomplete: completions.isIncomplete };
    } catch (e) {
      console.warn('[NodiusEditor] TypeScript completion error:', e);
      return { items: [] };
    }
  }

  resolveItem(item: CompletionItem, context: CompletionContext): CompletionItem {
    this.host.setFileName(context.fileName || 'file.ts');
    this.host.updateFile(context.documentText);

    const offset = this.getOffset(context.documentText, context.position.line, context.position.column);

    try {
      const details = this.service.getCompletionEntryDetails(
        this.host.getFileName(),
        offset,
        item.label,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      if (!details) return item;

      const detail = ts.displayPartsToString(details.displayParts);
      const documentation = ts.displayPartsToString(details.documentation);

      return {
        ...item,
        detail: detail || item.detail,
        documentation: documentation || item.documentation,
      };
    } catch {
      return item;
    }
  }

  dispose(): void {
    this.service.dispose();
  }

  private getOffset(text: string, line: number, column: number): number {
    let offset = 0;
    const lines = text.split('\n');
    for (let i = 0; i < line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for \n
    }
    return offset + column;
  }
}
