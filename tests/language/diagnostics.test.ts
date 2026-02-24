import { describe, it, expect } from 'vitest';
import { TypeScriptParser } from '../../src/language/typescript/TypeScriptParser';

describe('TypeScriptParser.getDiagnostics', () => {
  const parser = new TypeScriptParser();

  it('returns no diagnostics for valid code', () => {
    const source = 'const x = 5;\nfunction greet(name: string) { return name; }';
    const diagnostics = parser.getDiagnostics(source);
    expect(diagnostics).toHaveLength(0);
  });

  it('returns no diagnostics for valid TypeScript with types', () => {
    const source = `
interface User {
  name: string;
  age: number;
}

const user: User = { name: "Alice", age: 30 };
`;
    const diagnostics = parser.getDiagnostics(source);
    expect(diagnostics).toHaveLength(0);
  });

  it('returns no diagnostics for empty source', () => {
    const diagnostics = parser.getDiagnostics('');
    expect(diagnostics).toHaveLength(0);
  });

  it('returns diagnostics for missing closing brace', () => {
    const source = 'function foo() {\n  const x = 5;\n';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);
    // Should report an error about the missing closing brace
    const hasError = diagnostics.some((d) => d.severity === 'error');
    expect(hasError).toBe(true);
  });

  it('returns diagnostics for missing closing parenthesis', () => {
    const source = 'if (true {\n  console.log("hello");\n}';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);
    const hasError = diagnostics.some((d) => d.severity === 'error');
    expect(hasError).toBe(true);
  });

  it('returns diagnostics for unexpected token', () => {
    const source = 'const = 5;';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('diagnostics have correct range', () => {
    const source = 'function foo() {\n  const x = 5;\n';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);

    for (const diag of diagnostics) {
      expect(diag.range).toBeDefined();
      expect(diag.range.start).toBeDefined();
      expect(diag.range.end).toBeDefined();
      expect(typeof diag.range.start.line).toBe('number');
      expect(typeof diag.range.start.column).toBe('number');
      expect(typeof diag.range.end.line).toBe('number');
      expect(typeof diag.range.end.column).toBe('number');
      expect(diag.range.start.line).toBeGreaterThanOrEqual(0);
      expect(diag.range.start.column).toBeGreaterThanOrEqual(0);
    }
  });

  it('diagnostics have message and severity', () => {
    const source = 'function foo() {';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);

    for (const diag of diagnostics) {
      expect(typeof diag.message).toBe('string');
      expect(diag.message.length).toBeGreaterThan(0);
      expect(['error', 'warning', 'info', 'hint']).toContain(diag.severity);
    }
  });

  it('diagnostics have source set to typescript', () => {
    const source = 'const = ;';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);

    for (const diag of diagnostics) {
      expect(diag.source).toBe('typescript');
    }
  });

  it('diagnostics have numeric code', () => {
    const source = 'function foo() {';
    const diagnostics = parser.getDiagnostics(source);

    expect(diagnostics.length).toBeGreaterThan(0);

    for (const diag of diagnostics) {
      expect(typeof diag.code).toBe('number');
    }
  });
});
