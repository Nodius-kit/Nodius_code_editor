import { describe, it, expect } from 'vitest';
import { TypeScriptParser } from '../../src/language/typescript/TypeScriptParser';
import type { EditorToken } from '../../src/language/types';

function tokenKinds(tokens: EditorToken[]): string[] {
  return tokens.filter((t) => t.kind !== 'whitespace').map((t) => t.kind);
}

function tokenTexts(tokens: EditorToken[]): string[] {
  return tokens.filter((t) => t.kind !== 'whitespace').map((t) => t.text);
}

describe('TypeScriptParser.tokenize', () => {
  const parser = new TypeScriptParser();

  it('tokenizes simple variable declaration', () => {
    const tokens = parser.tokenize('const x = 5;');
    const texts = tokenTexts(tokens);
    const kinds = tokenKinds(tokens);

    expect(texts).toContain('const');
    expect(texts).toContain('x');
    expect(texts).toContain('=');
    expect(texts).toContain('5');
    expect(texts).toContain(';');

    expect(kinds).toContain('keyword');
    expect(kinds).toContain('identifier');
    expect(kinds).toContain('operator');
    expect(kinds).toContain('number');
  });

  it('tokenizes keywords correctly', () => {
    const tokens = parser.tokenize('if (true) { return false; }');
    const keywords = tokens.filter((t) => t.kind === 'keyword');
    const keywordTexts = keywords.map((t) => t.text);

    expect(keywordTexts).toContain('if');
    expect(keywordTexts).toContain('true');
    expect(keywordTexts).toContain('return');
    expect(keywordTexts).toContain('false');
  });

  it('tokenizes strings', () => {
    const tokens = parser.tokenize('const name = "hello";');
    const strings = tokens.filter((t) => t.kind === 'string');

    expect(strings).toHaveLength(1);
    expect(strings[0].text).toBe('"hello"');
  });

  it('tokenizes single-quoted strings', () => {
    const tokens = parser.tokenize("const name = 'world';");
    const strings = tokens.filter((t) => t.kind === 'string');

    expect(strings).toHaveLength(1);
    expect(strings[0].text).toBe("'world'");
  });

  it('tokenizes numbers', () => {
    const tokens = parser.tokenize('const a = 42; const b = 3.14;');
    const numbers = tokens.filter((t) => t.kind === 'number');

    expect(numbers).toHaveLength(2);
    expect(numbers[0].text).toBe('42');
    expect(numbers[1].text).toBe('3.14');
  });

  it('tokenizes single-line comments', () => {
    const tokens = parser.tokenize('// this is a comment\nconst x = 1;');
    const comments = tokens.filter((t) => t.kind === 'comment');

    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('// this is a comment');
  });

  it('tokenizes multi-line comments', () => {
    const tokens = parser.tokenize('/* multi\nline\ncomment */\nconst x = 1;');
    const comments = tokens.filter((t) => t.kind === 'comment');

    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe('/* multi\nline\ncomment */');
  });

  it('tokenizes operators', () => {
    const tokens = parser.tokenize('a + b - c * d / e');
    const operators = tokens.filter((t) => t.kind === 'operator');
    const opTexts = operators.map((t) => t.text);

    expect(opTexts).toContain('+');
    expect(opTexts).toContain('-');
    expect(opTexts).toContain('*');
    expect(opTexts).toContain('/');
  });

  it('tokenizes comparison operators', () => {
    const tokens = parser.tokenize('a === b && c !== d');
    const operators = tokens.filter((t) => t.kind === 'operator');
    const opTexts = operators.map((t) => t.text);

    expect(opTexts).toContain('===');
    expect(opTexts).toContain('&&');
    expect(opTexts).toContain('!==');
  });

  it('tokenizes function declaration', () => {
    const tokens = parser.tokenize('function greet(name) { return name; }');
    const texts = tokenTexts(tokens);
    const kinds = tokenKinds(tokens);

    expect(texts).toContain('function');
    expect(texts).toContain('greet');
    expect(texts).toContain('name');
    expect(texts).toContain('return');

    expect(kinds).toContain('keyword');
    expect(kinds).toContain('identifier');
    expect(kinds).toContain('punctuation');
  });

  it('tokenizes arrow function', () => {
    const tokens = parser.tokenize('const add = (a, b) => a + b;');
    const operators = tokens.filter((t) => t.kind === 'operator');
    const opTexts = operators.map((t) => t.text);

    expect(opTexts).toContain('=>');
    expect(opTexts).toContain('+');
    expect(opTexts).toContain('=');
  });

  it('each token has correct line and column for single line', () => {
    const tokens = parser.tokenize('const x = 5;');

    for (const token of tokens) {
      expect(token.line).toBe(0);
      expect(token.column).toBeGreaterThanOrEqual(0);
    }

    // Verify the first non-whitespace token starts at column 0
    const constToken = tokens.find((t) => t.text === 'const');
    expect(constToken).toBeDefined();
    expect(constToken!.line).toBe(0);
    expect(constToken!.column).toBe(0);
  });

  it('each token has correct line for multi-line code', () => {
    const source = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const tokens = parser.tokenize(source);

    // Find the 'const' tokens -- there should be one per line
    const constTokens = tokens.filter((t) => t.text === 'const');
    expect(constTokens).toHaveLength(3);
    expect(constTokens[0].line).toBe(0);
    expect(constTokens[1].line).toBe(1);
    expect(constTokens[2].line).toBe(2);
  });

  it('each token has correct column for multi-line code', () => {
    const source = 'const a = 1;\n  const b = 2;';
    const tokens = parser.tokenize(source);

    // 'const' on line 0 starts at column 0
    const firstConst = tokens.find((t) => t.text === 'const' && t.line === 0);
    expect(firstConst).toBeDefined();
    expect(firstConst!.column).toBe(0);

    // 'const' on line 1 starts at column 2 (after two spaces)
    const secondConst = tokens.find((t) => t.text === 'const' && t.line === 1);
    expect(secondConst).toBeDefined();
    expect(secondConst!.column).toBe(2);
  });

  it('token start and end are consistent with text length', () => {
    const tokens = parser.tokenize('const x = 42;');

    for (const token of tokens) {
      expect(token.end - token.start).toBe(token.text.length);
    }
  });

  it('tokenizes punctuation', () => {
    const tokens = parser.tokenize('{ ( [ ] ) }');
    const punctuation = tokens.filter((t) => t.kind === 'punctuation');
    const texts = punctuation.map((t) => t.text);

    expect(texts).toContain('{');
    expect(texts).toContain('(');
    expect(texts).toContain('[');
    expect(texts).toContain(']');
    expect(texts).toContain(')');
    expect(texts).toContain('}');
  });

  it('tokenizes TypeScript type annotations', () => {
    const tokens = parser.tokenize('const x: number = 5;');
    const keywords = tokens.filter((t) => t.kind === 'keyword');
    const keywordTexts = keywords.map((t) => t.text);

    expect(keywordTexts).toContain('const');
    expect(keywordTexts).toContain('number');
  });
});
