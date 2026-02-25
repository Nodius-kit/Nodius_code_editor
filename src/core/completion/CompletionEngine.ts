import type {
  CompletionItem,
  CompletionContext,
  CompletionList,
  CompletionProvider,
  CompletionResult,
} from './types';

export class CompletionEngine {
  private providers: CompletionProvider[] = [];

  registerProvider(provider: CompletionProvider): () => void {
    this.providers.push(provider);
    return () => {
      const idx = this.providers.indexOf(provider);
      if (idx >= 0) this.providers.splice(idx, 1);
    };
  }

  registerSimpleCompletions(items: CompletionItem[]): () => void {
    const provider: CompletionProvider = {
      provideCompletions(): CompletionList {
        return { items };
      },
    };
    return this.registerProvider(provider);
  }

  getTriggerCharacters(): Set<string> {
    const chars = new Set<string>();
    for (const p of this.providers) {
      if (p.triggerCharacters) {
        for (const c of p.triggerCharacters) chars.add(c);
      }
    }
    return chars;
  }

  async getCompletions(context: CompletionContext): Promise<CompletionResult> {
    const allItems: CompletionItem[] = [];
    let isIncomplete = false;

    const results = await Promise.all(
      this.providers.map(p => Promise.resolve(p.provideCompletions(context)))
    );

    for (const list of results) {
      if (list.isIncomplete) isIncomplete = true;
      for (const item of list.items) {
        allItems.push(item);
      }
    }

    const filtered = this.filterAndSort(allItems, context.wordPrefix);
    const replaceStart = context.position.column - context.wordPrefix.length;

    return {
      items: filtered,
      replaceStart,
      replaceEnd: context.position.column,
      isIncomplete,
    };
  }

  async resolveItem(provider: CompletionProvider, item: CompletionItem, context: CompletionContext): Promise<CompletionItem> {
    if (provider.resolveItem) {
      return Promise.resolve(provider.resolveItem(item, context));
    }
    return item;
  }

  getWordPrefix(lineText: string, column: number): string {
    const before = lineText.substring(0, column);
    const match = before.match(/[\w$]+$/);
    return match ? match[0] : '';
  }

  filterAndSort(items: CompletionItem[], prefix: string): CompletionItem[] {
    if (!prefix) return items.slice().sort(this.compareItems);

    const lowerPrefix = prefix.toLowerCase();
    const scored: Array<{ item: CompletionItem; score: number }> = [];

    for (const item of items) {
      const text = (item.filterText ?? item.label).toLowerCase();
      const score = this.fuzzyScore(text, lowerPrefix);
      if (score > 0) {
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return this.compareItems(a.item, b.item);
    });

    return scored.map(s => s.item);
  }

  private fuzzyScore(text: string, pattern: string): number {
    // Exact prefix match scores highest
    if (text.startsWith(pattern)) {
      return 100 + (pattern.length / text.length) * 50;
    }

    // Subsequence match
    let ti = 0;
    let pi = 0;
    let score = 0;
    let consecutive = 0;

    while (ti < text.length && pi < pattern.length) {
      if (text[ti] === pattern[pi]) {
        score += 10;
        consecutive++;
        score += consecutive * 2; // bonus for consecutive matches
        pi++;
      } else {
        consecutive = 0;
      }
      ti++;
    }

    // All pattern characters must match
    if (pi < pattern.length) return 0;

    return score;
  }

  private compareItems(a: CompletionItem, b: CompletionItem): number {
    const sa = a.sortText ?? a.label;
    const sb = b.sortText ?? b.label;
    return sa.localeCompare(sb);
  }
}
