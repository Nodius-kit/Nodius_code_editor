import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type { Plugin } from 'vite';

/**
 * Vite plugin that makes TypeScript lib.d.ts files available as a virtual module.
 * Exports `virtual:ts-lib-files` which is a Record<string, string> mapping
 * lib file names to their content.
 *
 * This is needed because `typescript` is external in the library build —
 * the lib files (lib.es5.d.ts, lib.dom.d.ts, etc.) must be inlined separately
 * for the TypeScript Language Service to provide completions for built-in types.
 */
export function tsLibFilesPlugin(): Plugin {
  const virtualId = 'virtual:ts-lib-files';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'ts-lib-files',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;

      // Resolve the typescript package's lib directory
      // Use createRequire for ESM compatibility
      const req = createRequire(import.meta.url);
      const tsMain = req.resolve('typescript');
      const libDir = dirname(tsMain);

      const libFiles: Record<string, string> = {};
      const fileNames = [
        'lib.es5.d.ts',
        'lib.dom.d.ts',
        'lib.es2015.d.ts',
        'lib.es2015.core.d.ts',
        'lib.es2015.collection.d.ts',
        'lib.es2015.iterable.d.ts',
        'lib.es2015.promise.d.ts',
        'lib.es2015.symbol.d.ts',
        'lib.es2015.symbol.wellknown.d.ts',
        'lib.es2015.generator.d.ts',
        'lib.es2015.proxy.d.ts',
        'lib.es2015.reflect.d.ts',
      ];

      for (const name of fileNames) {
        try {
          libFiles[name] = readFileSync(join(libDir, name), 'utf-8');
        } catch {
          // Skip files that don't exist
        }
      }

      return `export default ${JSON.stringify(libFiles)};`;
    },
  };
}
