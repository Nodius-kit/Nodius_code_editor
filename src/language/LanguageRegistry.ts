import type { LanguageDefinition, LanguageParser } from './types.js';
import { detectByExtension, detectByContent } from './detection.js';

export class LanguageRegistry {
  private parsers: Map<string, LanguageParser> = new Map();

  /**
   * Register a language parser. If a parser with the same language id
   * is already registered, it will be replaced.
   */
  register(parser: LanguageParser): void {
    this.parsers.set(parser.language.id, parser);
    // Also register under aliases so detection results like 'javascript' map to the parser
    if (parser.language.aliases) {
      for (const alias of parser.language.aliases) {
        if (!this.parsers.has(alias)) {
          this.parsers.set(alias, parser);
        }
      }
    }
  }

  /**
   * Get a parser by its language id.
   */
  getParserById(id: string): LanguageParser | undefined {
    return this.parsers.get(id);
  }

  /**
   * Get a parser that supports the given file name by matching its extension.
   */
  getParserForFile(fileName: string): LanguageParser | undefined {
    const ext = this.extractExtension(fileName);
    if (!ext) {
      return undefined;
    }

    for (const parser of this.parsers.values()) {
      if (parser.language.extensions.includes(ext)) {
        return parser;
      }
    }
    return undefined;
  }

  /**
   * Return definitions for all registered languages (deduplicated).
   */
  getAvailableLanguages(): LanguageDefinition[] {
    const seen = new Set<LanguageParser>();
    const result: LanguageDefinition[] = [];
    for (const parser of this.parsers.values()) {
      if (!seen.has(parser)) {
        seen.add(parser);
        result.push(parser.language);
      }
    }
    return result;
  }

  /**
   * Detect the language id for the given content and optional file name.
   * Tries file extension first, then falls back to content heuristics.
   */
  detectLanguage(content: string, fileName?: string): string | undefined {
    if (fileName) {
      const byExt = detectByExtension(fileName);
      if (byExt !== undefined) {
        return byExt;
      }
    }
    return detectByContent(content);
  }

  private extractExtension(fileName: string): string | undefined {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) {
      return undefined;
    }
    return fileName.slice(dotIndex).toLowerCase();
  }
}
