import { describe, it, expect } from 'vitest';
import { detectByExtension, detectByContent } from '../../src/language/detection';

describe('detectByExtension', () => {
  it('detects .ts as typescript', () => {
    expect(detectByExtension('index.ts')).toBe('typescript');
  });

  it('detects .tsx as typescript', () => {
    expect(detectByExtension('App.tsx')).toBe('typescript');
  });

  it('detects .js as javascript', () => {
    expect(detectByExtension('main.js')).toBe('javascript');
  });

  it('detects .jsx as javascript', () => {
    expect(detectByExtension('Component.jsx')).toBe('javascript');
  });

  it('detects .json as json', () => {
    expect(detectByExtension('package.json')).toBe('json');
  });

  it('detects .html as html', () => {
    expect(detectByExtension('index.html')).toBe('html');
  });

  it('detects .htm as html', () => {
    expect(detectByExtension('page.htm')).toBe('html');
  });

  it('detects .css as css', () => {
    expect(detectByExtension('styles.css')).toBe('css');
  });

  it('detects .md as markdown', () => {
    expect(detectByExtension('README.md')).toBe('markdown');
  });

  it('detects .py as python', () => {
    expect(detectByExtension('script.py')).toBe('python');
  });

  it('returns undefined for unknown extension', () => {
    expect(detectByExtension('data.csv')).toBeUndefined();
  });

  it('returns undefined for file without extension', () => {
    expect(detectByExtension('Makefile')).toBeUndefined();
  });

  it('is case-insensitive for extensions', () => {
    expect(detectByExtension('file.TS')).toBe('typescript');
    expect(detectByExtension('file.JS')).toBe('javascript');
  });
});

describe('detectByContent', () => {
  it('detects TypeScript code with type annotations', () => {
    const content = 'const x: number = 5;\nfunction greet(name: string): void {}';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects TypeScript code with interface keyword', () => {
    const content = 'interface User { name: string; age: number; }';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects TypeScript code with type keyword', () => {
    const content = 'type Result = "success" | "failure";';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects TypeScript code with enum keyword', () => {
    const content = 'enum Color { Red, Green, Blue }';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects TypeScript code with generics', () => {
    const content = 'function identity<T>(arg: T): T { return arg; }';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects TypeScript code with as cast', () => {
    const content = 'const el = document.getElementById("app") as HTMLElement;';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects TypeScript code with access modifiers', () => {
    const content = 'class Foo { private bar = 1; public baz() {} }';
    expect(detectByContent(content)).toBe('typescript');
  });

  it('detects JavaScript code with const/let/var', () => {
    const content = 'const x = 5;\nlet y = 10;\nvar z = 15;';
    expect(detectByContent(content)).toBe('javascript');
  });

  it('detects JavaScript code with function keyword', () => {
    const content = 'function greet(name) { return "Hello " + name; }';
    expect(detectByContent(content)).toBe('javascript');
  });

  it('detects JavaScript code with arrow functions', () => {
    const content = 'const add = (a, b) => a + b;';
    expect(detectByContent(content)).toBe('javascript');
  });

  it('detects JavaScript code with require', () => {
    const content = 'const fs = require("fs");';
    expect(detectByContent(content)).toBe('javascript');
  });

  it('detects JSON content', () => {
    const content = '{"name": "test", "version": "1.0.0"}';
    expect(detectByContent(content)).toBe('json');
  });

  it('detects JSON array content', () => {
    const content = '[1, 2, 3]';
    expect(detectByContent(content)).toBe('json');
  });

  it('detects HTML content with html tag', () => {
    const content = '<html>\n<head><title>Test</title></head>\n<body></body>\n</html>';
    expect(detectByContent(content)).toBe('html');
  });

  it('detects HTML content with DOCTYPE', () => {
    const content = '<!DOCTYPE html>\n<html></html>';
    expect(detectByContent(content)).toBe('html');
  });

  it('detects CSS content', () => {
    const content = '.container { display: flex; margin: 0 auto; }';
    expect(detectByContent(content)).toBe('css');
  });

  it('returns undefined for unknown content', () => {
    const content = 'this is just plain text with no special patterns';
    expect(detectByContent(content)).toBeUndefined();
  });

  it('returns undefined for empty content', () => {
    expect(detectByContent('')).toBeUndefined();
  });
});
