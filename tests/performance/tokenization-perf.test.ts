/**
 * Performance benchmarks: OLD (full reconcile on every keystroke)
 * vs NEW (incremental render — only touch affected lines).
 *
 * Run:  npx vitest run tests/performance/tokenization-perf.test.ts
 */
import { describe, it, expect } from 'vitest';
import { TypeScriptParser } from '../../src/language/typescript/TypeScriptParser';
import { LineRenderer } from '../../src/view/LineRenderer';
import { TokenCache } from '../../src/view/TokenCache';
import type { EditorToken } from '../../src/language/types';
import type { Line } from '../../src/core/types';

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

let lineIdCounter = 0;
function makeLine(text: string): Line {
  return { id: `perf-${lineIdCounter++}`, text };
}

function generateCode(numLines: number): string {
  const blocks: string[] = [];
  blocks.push(`import { createServer } from 'http';`);
  blocks.push(`import type { IncomingMessage, ServerResponse } from 'http';`);
  blocks.push('');
  let lineCount = 3;
  let classIdx = 0;

  while (lineCount < numLines) {
    classIdx++;
    const cn = `Service${classIdx}`;
    blocks.push(`interface ${cn}Config {`, `  port: number;`, `  host: string;`, `  debug: boolean;`, `  timeout: number;`, `}`, '');
    lineCount += 7;
    blocks.push(
      `class ${cn} {`, `  private config: ${cn}Config;`, `  private running: boolean = false;`, '',
      `  constructor(config: ${cn}Config) {`, `    this.config = config;`, `  }`, '',
      `  async start(): Promise<void> {`,
      `    const server = createServer((req: IncomingMessage, res: ServerResponse) => {`,
      `      const url = req.url ?? '/';`, `      const method = req.method ?? 'GET';`,
      '      // Template literal with expressions',
      `      const message = \`Received \${method} request for \${url}\`;`,
      `      console.log(message);`,
      `      res.writeHead(200, { 'Content-Type': 'application/json' });`,
      `      res.end(JSON.stringify({ status: 'ok', path: url }));`,
      `    });`, '',
      `    await new Promise<void>((resolve) => {`,
      `      server.listen(this.config.port, this.config.host, () => {`,
      `        if (this.config.debug) {`,
      `          console.log(\`\${this.constructor.name} running at http://\${this.config.host}:\${this.config.port}/\`);`,
      `        }`, `        this.running = true;`, `        resolve();`,
      `      });`, `    });`, `  }`, '',
      `  stop(): void {`, `    this.running = false;`, `  }`, '',
      `  isRunning(): boolean {`, `    return this.running;`, `  }`, `}`, '',
    );
    lineCount += 34;
  }
  return blocks.slice(0, numLines).join('\n');
}

function makeLines(source: string): Line[] {
  return source.split('\n').map(text => makeLine(text));
}

function bench(fn: () => void, iterations: number = 20): { avg: number; min: number; max: number } {
  for (let i = 0; i < 3; i++) fn(); // warm up
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const trimmed = times.slice(Math.floor(iterations * 0.1), Math.ceil(iterations * 0.9));
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return { avg, min: times[0], max: times[times.length - 1] };
}

// ---------------------------------------------------------------------------
//  OLD pipeline: tokenize entire doc + build ALL HTML + reconcile ALL lines
// ---------------------------------------------------------------------------

function oldPipeline(lines: Line[], parser: TypeScriptParser, lr: LineRenderer): void {
  const fullText = lines.map(l => l.text).join('\n');
  const allTokens = parser.tokenize(fullText);
  const byLine: Map<number, EditorToken[]> = new Map();
  for (const t of allTokens) {
    let a = byLine.get(t.line); if (!a) { a = []; byLine.set(t.line, a); } a.push(t);
  }
  for (let i = 0; i < lines.length; i++) {
    lr.renderLine(byLine.get(i) ?? null, lines[i].text);
  }
}

// ---------------------------------------------------------------------------
//  NEW pipeline: incremental — only 1 line rendered per keystroke
// ---------------------------------------------------------------------------

function newPipelineKeystroke(
  editLineIdx: number,
  lines: Line[],
  lr: LineRenderer,
  tokenCache: TokenCache,
): void {
  // This is the ONLY work done synchronously on each keystroke:
  // 1. Look up cached tokens for the edited line (O(1) Map.get)
  // 2. Render HTML for that one line
  const line = lines[editLineIdx];
  const tokens = tokenCache.getLineTokens(line.id);
  lr.renderLine(tokens, line.text);
  // That's it. Everything else is async.
}

// ---------------------------------------------------------------------------
//  Benchmarks
// ---------------------------------------------------------------------------

describe('Tokenization Performance', () => {
  const parser = new TypeScriptParser();
  const lr = new LineRenderer();

  for (const numLines of [100, 500, 1000, 2000]) {
    describe(`${numLines} lines`, () => {
      const source = generateCode(numLines);
      const lines = makeLines(source);

      it(`OLD: sync tokenize + all HTML (${numLines} lines)`, () => {
        const r = bench(() => oldPipeline([...lines], parser, lr));
        console.log(`  OLD(${numLines}): avg=${r.avg.toFixed(2)}ms  min=${r.min.toFixed(2)}ms  max=${r.max.toFixed(2)}ms`);
        expect(r.avg).toBeGreaterThan(0);
      });

      it(`NEW: incremental keystroke cost (${numLines} lines)`, () => {
        // Prime the token cache (simulates initial render)
        const tc = new TokenCache();
        tc.setParser(parser);
        tc.tokenizeSync(lines);

        const editIdx = Math.floor(numLines / 2);
        const r = bench(() => newPipelineKeystroke(editIdx, lines, lr, tc));
        console.log(`  NEW keystroke(${numLines}): avg=${r.avg.toFixed(4)}ms  ← WHAT USER FEELS`);
        expect(r.avg).toBeLessThan(1); // must be sub-millisecond
      });

      it(`NEW: async tokenize (${numLines} lines, off critical path)`, () => {
        const tc = new TokenCache();
        tc.setParser(parser);
        tc.tokenizeSync(lines);

        // Simulate: edit one line, then run the async tokenization
        const editIdx = Math.floor(numLines / 2);
        const original = lines[editIdx];

        const r = bench(() => {
          lines[editIdx] = { id: original.id, text: original.text + 'x' };
          // This is what runs in setTimeout(80ms), NOT blocking keystroke
          tc.tokenizeSync(lines);
          lines[editIdx] = original;
          tc.tokenizeSync(lines); // reset
        }, 10);
        console.log(`  NEW async(${numLines}): avg=${r.avg.toFixed(2)}ms  (debounced, non-blocking)`);
        expect(r.avg).toBeDefined();
      });
    });
  }
});
