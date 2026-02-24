import { describe, it, expect } from 'vitest';
import { LanguageRegistry } from '../../src/language/LanguageRegistry';
import type { LanguageParser, LanguageDefinition, EditorToken, EditorDiagnostic } from '../../src/language/types';

function createMockParser(def: LanguageDefinition): LanguageParser {
  return {
    language: def,
    tokenize(_source: string): EditorToken[] {
      return [];
    },
    parse(_source: string): unknown {
      return null;
    },
    getDiagnostics(_source: string): EditorDiagnostic[] {
      return [];
    },
  };
}

const tsDefinition: LanguageDefinition = {
  id: 'typescript',
  name: 'TypeScript',
  extensions: ['.ts', '.tsx'],
  aliases: ['ts'],
};

const jsDefinition: LanguageDefinition = {
  id: 'javascript',
  name: 'JavaScript',
  extensions: ['.js', '.jsx'],
  aliases: ['js'],
};

describe('LanguageRegistry', () => {
  it('register adds parser', () => {
    const registry = new LanguageRegistry();
    const parser = createMockParser(tsDefinition);

    registry.register(parser);

    expect(registry.getParserById('typescript')).toBe(parser);
  });

  it('getParserById returns correct parser', () => {
    const registry = new LanguageRegistry();
    const tsParser = createMockParser(tsDefinition);
    const jsParser = createMockParser(jsDefinition);

    registry.register(tsParser);
    registry.register(jsParser);

    expect(registry.getParserById('typescript')).toBe(tsParser);
    expect(registry.getParserById('javascript')).toBe(jsParser);
  });

  it('getParserById returns undefined for unregistered id', () => {
    const registry = new LanguageRegistry();
    expect(registry.getParserById('python')).toBeUndefined();
  });

  it('getParserForFile matches .ts extension', () => {
    const registry = new LanguageRegistry();
    const tsParser = createMockParser(tsDefinition);
    registry.register(tsParser);

    expect(registry.getParserForFile('index.ts')).toBe(tsParser);
  });

  it('getParserForFile matches .tsx extension', () => {
    const registry = new LanguageRegistry();
    const tsParser = createMockParser(tsDefinition);
    registry.register(tsParser);

    expect(registry.getParserForFile('App.tsx')).toBe(tsParser);
  });

  it('getParserForFile matches .js extension', () => {
    const registry = new LanguageRegistry();
    const jsParser = createMockParser(jsDefinition);
    registry.register(jsParser);

    expect(registry.getParserForFile('main.js')).toBe(jsParser);
  });

  it('getParserForFile matches .jsx extension', () => {
    const registry = new LanguageRegistry();
    const jsParser = createMockParser(jsDefinition);
    registry.register(jsParser);

    expect(registry.getParserForFile('Component.jsx')).toBe(jsParser);
  });

  it('getParserForFile returns undefined for unknown extension', () => {
    const registry = new LanguageRegistry();
    const tsParser = createMockParser(tsDefinition);
    registry.register(tsParser);

    expect(registry.getParserForFile('data.csv')).toBeUndefined();
  });

  it('getParserForFile returns undefined for file with no extension', () => {
    const registry = new LanguageRegistry();
    const tsParser = createMockParser(tsDefinition);
    registry.register(tsParser);

    expect(registry.getParserForFile('Makefile')).toBeUndefined();
  });

  it('getAvailableLanguages returns all registered languages', () => {
    const registry = new LanguageRegistry();
    const tsParser = createMockParser(tsDefinition);
    const jsParser = createMockParser(jsDefinition);

    registry.register(tsParser);
    registry.register(jsParser);

    const languages = registry.getAvailableLanguages();
    expect(languages).toHaveLength(2);
    expect(languages).toContainEqual(tsDefinition);
    expect(languages).toContainEqual(jsDefinition);
  });

  it('getAvailableLanguages returns empty array when no parsers registered', () => {
    const registry = new LanguageRegistry();
    expect(registry.getAvailableLanguages()).toEqual([]);
  });

  it('detectLanguage detects by filename', () => {
    const registry = new LanguageRegistry();

    expect(registry.detectLanguage('', 'index.ts')).toBe('typescript');
    expect(registry.detectLanguage('', 'main.js')).toBe('javascript');
    expect(registry.detectLanguage('', 'data.json')).toBe('json');
    expect(registry.detectLanguage('', 'page.html')).toBe('html');
  });

  it('detectLanguage detects by content when no filename provided', () => {
    const registry = new LanguageRegistry();

    const tsContent = 'const x: number = 5;';
    expect(registry.detectLanguage(tsContent)).toBe('typescript');

    const jsContent = 'const x = 5;';
    expect(registry.detectLanguage(jsContent)).toBe('javascript');
  });

  it('detectLanguage prefers filename over content', () => {
    const registry = new LanguageRegistry();

    // Content looks like TypeScript but filename says JavaScript
    const tsContent = 'const x: number = 5;';
    expect(registry.detectLanguage(tsContent, 'main.js')).toBe('javascript');
  });
});
