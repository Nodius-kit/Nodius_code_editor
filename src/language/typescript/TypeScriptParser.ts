import ts from 'typescript';
import type {
  LanguageDefinition,
  LanguageParser,
  EditorToken,
  EditorDiagnostic,
  DiagnosticSeverity,
} from '../types.js';
import { classifySyntaxKind } from './tokenClassifier.js';

export class TypeScriptParser implements LanguageParser {
  readonly language: LanguageDefinition = {
    id: 'typescript',
    name: 'TypeScript',
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    aliases: ['ts', 'js', 'javascript'],
    mimeTypes: ['text/typescript', 'text/javascript'],
  };

  tokenize(source: string): EditorToken[] {
    const tokens: EditorToken[] = [];
    // skipTrivia = false so we receive whitespace and comment tokens
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      /* skipTrivia */ false,
      ts.LanguageVariant.Standard,
      source,
    );

    // Pre-compute a line-start offset table for efficient line/column lookup
    const lineStarts = this.computeLineStarts(source);

    // Template expression depth tracking: each entry is a brace depth counter
    // for a nested template expression level.
    const templateDepthStack: number[] = [];

    let syntaxKind = scanner.scan();

    while (syntaxKind !== ts.SyntaxKind.EndOfFileToken) {
      // When inside a template expression and we see a CloseBraceToken,
      // check whether it closes the template expression (depth === 0)
      // or just a nested brace (depth > 0).
      if (syntaxKind === ts.SyntaxKind.CloseBraceToken && templateDepthStack.length > 0) {
        if (templateDepthStack[templateDepthStack.length - 1] === 0) {
          // This } closes the template expression — re-scan to get the
          // template continuation token (TemplateMiddle or TemplateTail).
          syntaxKind = scanner.reScanTemplateToken(/* isTaggedTemplate */ false);
          // Let the next iteration of the loop process this re-scanned token.
          continue;
        } else {
          // Nested brace inside a template expression — just decrement.
          templateDepthStack[templateDepthStack.length - 1]--;
        }
      }

      // Track open braces inside template expressions
      if (syntaxKind === ts.SyntaxKind.OpenBraceToken && templateDepthStack.length > 0) {
        templateDepthStack[templateDepthStack.length - 1]++;
      }

      const start = scanner.getTokenStart();
      const end = scanner.getTokenEnd();
      const text = scanner.getTokenText();
      const kind = classifySyntaxKind(syntaxKind);
      const { line, column } = this.getLineAndColumn(lineStarts, start);

      tokens.push({ kind, text, start, end, line, column });

      // Track template expression nesting:
      // TemplateHead starts a template and opens the first expression.
      if (syntaxKind === ts.SyntaxKind.TemplateHead) {
        templateDepthStack.push(0);
      }
      // TemplateMiddle closes one expression and opens the next.
      else if (syntaxKind === ts.SyntaxKind.TemplateMiddle) {
        if (templateDepthStack.length > 0) {
          templateDepthStack.pop();
        }
        templateDepthStack.push(0);
      }
      // TemplateTail closes the last expression.
      else if (syntaxKind === ts.SyntaxKind.TemplateTail) {
        if (templateDepthStack.length > 0) {
          templateDepthStack.pop();
        }
      }

      syntaxKind = scanner.scan();
    }

    return this.postProcessTokens(tokens);
  }

  parse(source: string): ts.SourceFile {
    return ts.createSourceFile('file.ts', source, ts.ScriptTarget.Latest, /* setParentNodes */ true);
  }

  getDiagnostics(source: string): EditorDiagnostic[] {
    const sourceFile = ts.createSourceFile(
      'file.ts',
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
    );

    // parseDiagnostics is not on the public API surface but is always present
    const parseDiagnostics: ts.DiagnosticWithLocation[] =
      (sourceFile as unknown as { parseDiagnostics: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];

    return parseDiagnostics.map((diag) => this.mapDiagnostic(diag, sourceFile));
  }

  // ----------------------------------------------------------------
  //  Private helpers
  // ----------------------------------------------------------------

  /**
   * Second pass: reclassify identifiers based on surrounding context.
   *
   * Rules applied:
   * - Identifier after `class`, `interface`, `enum`, `type` keyword -> 'type'
   * - Identifier after `extends` or `implements` keyword -> 'type'
   * - `@` followed by identifier -> both become 'decorator'
   * - Identifier after `:` that starts with uppercase letter -> 'type' (type annotation heuristic)
   * - Identifier after `new` keyword -> 'type'
   */
  private postProcessTokens(tokens: EditorToken[]): EditorToken[] {
    const result: EditorToken[] = [...tokens];

    // Helper to find the previous non-whitespace token index
    const findPrevNonWhitespace = (index: number): number => {
      for (let i = index - 1; i >= 0; i--) {
        if (result[i].kind !== 'whitespace') {
          return i;
        }
      }
      return -1;
    };

    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      if (token.kind === 'identifier') {
        const prevIdx = findPrevNonWhitespace(i);
        if (prevIdx >= 0) {
          const prev = result[prevIdx];

          // Identifier after class/interface/enum/type keyword -> 'type'
          if (
            prev.kind === 'keyword' &&
            (prev.text === 'class' ||
              prev.text === 'interface' ||
              prev.text === 'enum' ||
              prev.text === 'type')
          ) {
            result[i] = { ...token, kind: 'type' };
            continue;
          }

          // Identifier after extends/implements keyword -> 'type'
          if (
            prev.kind === 'keyword' &&
            (prev.text === 'extends' || prev.text === 'implements')
          ) {
            result[i] = { ...token, kind: 'type' };
            continue;
          }

          // @ followed by identifier -> both become 'decorator'
          if (prev.kind === 'punctuation' && prev.text === '@') {
            result[prevIdx] = { ...prev, kind: 'decorator' };
            result[i] = { ...token, kind: 'decorator' };
            continue;
          }

          // Identifier after : that starts with uppercase letter -> 'type' (type annotation heuristic)
          if (
            prev.kind === 'operator' &&
            prev.text === ':' &&
            token.text.length > 0 &&
            token.text[0] >= 'A' &&
            token.text[0] <= 'Z'
          ) {
            result[i] = { ...token, kind: 'type' };
            continue;
          }

          // Identifier after new keyword -> 'type'
          if (prev.kind === 'keyword' && prev.text === 'new') {
            result[i] = { ...token, kind: 'type' };
            continue;
          }
        }
      }
    }

    return result;
  }

  /**
   * Build an array where index i holds the character offset of line i.
   */
  private computeLineStarts(source: string): number[] {
    const starts: number[] = [0];
    for (let i = 0; i < source.length; i++) {
      if (source.charCodeAt(i) === 10 /* \n */) {
        starts.push(i + 1);
      } else if (source.charCodeAt(i) === 13 /* \r */) {
        if (i + 1 < source.length && source.charCodeAt(i + 1) === 10) {
          i++; // skip \n after \r
        }
        starts.push(i + 1);
      }
    }
    return starts;
  }

  /**
   * Binary-search the line starts table to compute 0-based line and column.
   */
  private getLineAndColumn(
    lineStarts: number[],
    offset: number,
  ): { line: number; column: number } {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (lineStarts[mid] <= offset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const line = high;
    const column = offset - lineStarts[line];
    return { line, column };
  }

  /**
   * Convert a TypeScript diagnostic to our EditorDiagnostic shape.
   */
  private mapDiagnostic(
    diag: ts.DiagnosticWithLocation,
    sourceFile: ts.SourceFile,
  ): EditorDiagnostic {
    const start = ts.getLineAndCharacterOfPosition(sourceFile, diag.start);
    const end = ts.getLineAndCharacterOfPosition(sourceFile, diag.start + diag.length);

    const severity = this.mapDiagnosticCategory(diag.category);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');

    return {
      message,
      severity,
      range: {
        start: { line: start.line, column: start.character },
        end: { line: end.line, column: end.character },
      },
      code: diag.code,
      source: 'typescript',
    };
  }

  private mapDiagnosticCategory(category: ts.DiagnosticCategory): DiagnosticSeverity {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      case ts.DiagnosticCategory.Suggestion:
        return 'hint';
      case ts.DiagnosticCategory.Message:
        return 'info';
      default:
        return 'info';
    }
  }
}
