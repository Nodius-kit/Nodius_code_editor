const extensionMap: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
};

/**
 * Detect the language id from a file name by examining its extension.
 */
export function detectByExtension(fileName: string): string | undefined {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return undefined;
  }
  const ext = fileName.slice(dotIndex).toLowerCase();
  return extensionMap[ext];
}

/**
 * Detect the language id from file content using heuristics.
 * Returns undefined if no language can be confidently determined.
 */
export function detectByContent(content: string): string | undefined {
  const trimmed = content.trimStart();

  // JSON detection: starts with { or [ and looks like valid JSON structure
  if (/^[\[{]/.test(trimmed)) {
    // Quick structural check: balanced-looking JSON
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      // Not valid JSON, continue checking other languages
    }
  }

  // HTML detection
  if (/<html[\s>]/i.test(content) || /<!DOCTYPE/i.test(content)) {
    return 'html';
  }

  // CSS detection: selectors followed by { with CSS-like properties
  if (
    /[.#@]?[\w-]+\s*\{[^}]*(?:color|margin|padding|display|font|background|border|width|height)\s*:/i.test(
      content,
    )
  ) {
    return 'css';
  }

  // TypeScript detection: type annotations, TS-specific keywords, generics, casts, access modifiers
  const hasTypeAnnotations = /:\s*(?:string|number|boolean|void|any|never|unknown|undefined)\b/.test(content);
  const hasTsKeywords = /\b(?:interface|type|enum|namespace|declare|abstract|implements|readonly)\b/.test(content);
  const hasGenerics = /<\s*[A-Z]\w*\s*(?:,\s*[A-Z]\w*\s*)*>/.test(content);
  const hasAsCast = /\bas\s+\w/.test(content);
  const hasAccessModifiers = /\b(?:public|private|protected)\s+\w/.test(content);

  if (hasTypeAnnotations || hasTsKeywords || hasGenerics || hasAsCast || hasAccessModifiers) {
    return 'typescript';
  }

  // JavaScript detection: JS keywords and patterns without TS features
  const hasJsFeatures =
    /\b(?:function|const|let|var)\b/.test(content) ||
    /=>/.test(content) ||
    /\brequire\s*\(/.test(content);

  if (hasJsFeatures) {
    return 'javascript';
  }

  return undefined;
}
