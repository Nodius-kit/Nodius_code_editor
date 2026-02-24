import type { EditorToken } from '../language/types';

export class LineRenderer {
  renderLine(tokens: EditorToken[] | null, text: string): string {
    // Empty lines need a <br> for the browser to give them height
    // and allow cursor placement inside contenteditable
    if (text === '') {
      return '<br>';
    }
    if (!tokens || tokens.length === 0) {
      return `<span class="nc-token-plain">${escapeHtml(text)}</span>`;
    }
    let html = '';
    for (const token of tokens) {
      if (token.kind === 'whitespace') {
        html += escapeHtml(token.text);
      } else {
        html += `<span class="nc-token-${token.kind}">${escapeHtml(token.text)}</span>`;
      }
    }
    return html;
  }

  createLineElement(lineId: string, content: string, lineNumber: number): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'nc-line';
    el.dataset.lineId = lineId;
    el.dataset.lineNumber = String(lineNumber);
    el.innerHTML = content;
    return el;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { escapeHtml };
