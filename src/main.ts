import { NodiusEditor } from './NodiusEditor';
import { CollaborationServer } from './collaboration/CollaborationServer';
import { CollaborationClient } from './collaboration/CollaborationClient';
import type { Operation } from './core/types';

// ========================================================================
//  Sample code snippets
// ========================================================================

const sampleTS = `// Welcome to Nodius Code Editor!
import { createServer } from 'http';

interface Config {
  port: number;
  host: string;
  debug: boolean;
}

const config: Config = {
  port: 3000,
  host: 'localhost',
  debug: true,
};

function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

class Server {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  start(): void {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(greet('World'));
    });

    server.listen(this.config.port, this.config.host, () => {
      if (this.config.debug) {
        console.log(\`Server running at http://\${this.config.host}:\${this.config.port}/\`);
      }
    });
  }
}

// Start the server
const app = new Server(config);
app.start();

export { Server, Config, greet };
`;

const collabInitialCode = `// Collaborative Editing Demo
// Both editors share the same document.
// Type in either editor to see changes sync!

interface User {
  id: string;
  name: string;
  color: string;
}

function getUsers(): User[] {
  return [
    { id: '1', name: 'Alice', color: '#4fc1ff' },
    { id: '2', name: 'Bob', color: '#f5a623' },
  ];
}

export { User, getUsers };
`;

// ========================================================================
//  Tab switching
// ========================================================================

const tabs = document.querySelectorAll<HTMLElement>('.pg-tab');
const panels = document.querySelectorAll<HTMLElement>('.pg-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab!;
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    panels.forEach((p) => p.classList.toggle('active', p.id === `panel-${target}`));
  });
});

// ========================================================================
//  1. EDITOR PANEL
// ========================================================================

const editorContainer = document.getElementById('editor-main')!;
const editor = new NodiusEditor(editorContainer, {
  value: sampleTS,
  language: 'typescript',
  fileName: 'demo.ts',
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  minimap: true,
  lineNumbers: true,
});

(window as any).editor = editor;

// ---- Options sidebar ----

const $theme = document.getElementById('opt-theme') as HTMLSelectElement;
const $fontsize = document.getElementById('opt-fontsize') as HTMLInputElement;
const $tabsize = document.getElementById('opt-tabsize') as HTMLInputElement;
const $language = document.getElementById('opt-language') as HTMLSelectElement;
const $linenumbers = document.getElementById('opt-linenumbers') as HTMLElement;
const $minimap = document.getElementById('opt-minimap') as HTMLElement;
const $readonly = document.getElementById('opt-readonly') as HTMLElement;

// Theme
$theme.addEventListener('change', () => {
  editor.setTheme($theme.value as 'dark' | 'light');
});
document.getElementById('btn-toggle-global-theme')!.addEventListener('click', (e) => {
  e.preventDefault();
  const t = editor.toggleTheme();
  $theme.value = t;
});

// Font size
$fontsize.addEventListener('change', () => {
  const size = parseInt($fontsize.value, 10);
  if (size >= 8 && size <= 32) {
    const root = editorContainer.querySelector('.nc-editor') as HTMLElement;
    if (root) {
      root.style.fontSize = `${size}px`;
      root.style.lineHeight = `${Math.round(size * 1.5)}px`;
    }
  }
});

// Tab size - no runtime setter, just informational
$tabsize.addEventListener('change', () => {
  // tabSize is used for indent command
});

// Language
$language.addEventListener('change', () => {
  editor.setLanguage($language.value);
});

// Toggles
function bindToggle(el: HTMLElement, onChange: (on: boolean) => void) {
  el.addEventListener('click', () => {
    el.classList.toggle('on');
    onChange(el.classList.contains('on'));
  });
}

bindToggle($linenumbers, (on) => {
  const gutter = editorContainer.querySelector('.nc-gutter') as HTMLElement;
  if (gutter) gutter.style.display = on ? '' : 'none';
});

bindToggle($minimap, (on) => {
  const minimap = editorContainer.querySelector('.nc-minimap') as HTMLElement;
  if (minimap) minimap.style.display = on ? 'block' : 'none';
});

bindToggle($readonly, (on) => {
  editor.setReadOnly(on);
});

// Actions
document.getElementById('btn-get-value')!.addEventListener('click', () => {
  console.log('--- Editor Value ---');
  console.log(editor.getValue());
  logEvent('action', 'getValue() -> see console');
});

document.getElementById('btn-set-value')!.addEventListener('click', () => {
  editor.setValue(sampleTS);
  logEvent('action', 'setValue(sampleTS)');
});

document.getElementById('btn-select-all')!.addEventListener('click', () => {
  editor.getCommandRegistry().execute('selectAll');
  editor.focus();
  logEvent('action', 'selectAll');
});

document.getElementById('btn-undo')!.addEventListener('click', () => {
  editor.getCommandRegistry().execute('undo');
  editor.focus();
  logEvent('action', 'undo');
});

document.getElementById('btn-redo')!.addEventListener('click', () => {
  editor.getCommandRegistry().execute('redo');
  editor.focus();
  logEvent('action', 'redo');
});

document.getElementById('btn-clear')!.addEventListener('click', () => {
  editor.setValue('');
  editor.focus();
  logEvent('action', 'clear');
});

// ---- Event log ----

const eventLogEl = document.getElementById('event-log')!;
let eventCount = 0;

function logEvent(type: string, detail: string) {
  eventCount++;
  const entry = document.createElement('div');
  entry.className = 'pg-event-log-entry';
  const time = new Date().toLocaleTimeString('en', { hour12: false });
  entry.innerHTML = `<span class="ev-time">${time}</span> <span class="ev-name">${type}</span> ${detail}`;
  eventLogEl.appendChild(entry);
  eventLogEl.scrollTop = eventLogEl.scrollHeight;
  // Keep only last 100 entries
  while (eventLogEl.children.length > 100) {
    eventLogEl.removeChild(eventLogEl.firstChild!);
  }
}

editor.on('content:change', () => {
  logEvent('content:change', `lines=${editor.getDocument().lines.length}`);
});
editor.on('selection:change', ({ selection }) => {
  const p = selection.ranges[selection.primary];
  if (p) logEvent('selection:change', `Ln ${p.focus.line + 1}, Col ${p.focus.column + 1}`);
});
editor.on('theme:change', ({ theme }) => logEvent('theme:change', theme));
editor.on('language:change', ({ languageId }) => logEvent('language:change', languageId));

// ========================================================================
//  2. COLLABORATION PANEL
// ========================================================================

/**
 * LocalCollabSetup wraps a CollaborationServer to create a local
 * in-memory collaboration environment with simulated network latency.
 */
class LocalCollabSetup {
  readonly server: CollaborationServer;
  private latency: number;

  constructor(latency: number = 50) {
    this.server = new CollaborationServer();
    this.latency = latency;
  }

  createClient(userId: string, color: string, name: string): CollaborationClient {
    const client = new CollaborationClient({
      userId,
      color,
      name,
      send: (msg) => {
        // Simulate network latency (client -> server)
        setTimeout(() => {
          this.server.receiveFromClient(userId, msg);
        }, this.latency);
      },
    });

    // Register client with server
    this.server.addClient(userId, (msg) => {
      // Simulate network latency (server -> client)
      setTimeout(() => {
        client.handleMessage(msg);
      }, this.latency);
    });

    return client;
  }
}

let collabAlice: NodiusEditor | null = null;
let collabBob: NodiusEditor | null = null;
let clientAlice: CollaborationClient | null = null;
let clientBob: CollaborationClient | null = null;
let collabSetup: LocalCollabSetup | null = null;
let collabActive = false;

const collabOpLog = document.getElementById('collab-op-log')!;
const collabStatusDot = document.getElementById('collab-status-dot')!;
const collabStatusText = document.getElementById('collab-status-text')!;
const btnStart = document.getElementById('btn-collab-start') as HTMLButtonElement;
const btnStop = document.getElementById('btn-collab-stop') as HTMLButtonElement;

function logCollabOp(user: string, color: string, ops: readonly Operation[]) {
  for (const op of ops) {
    const entry = document.createElement('div');
    entry.className = 'pg-collab-op-entry';
    let detail = '';
    switch (op.type) {
      case 'insertText':
        detail = `insertText("${op.text.replace(/\n/g, '\\n')}") at Ln ${op.line + 1}, Col ${op.column + 1}`;
        break;
      case 'deleteText':
        detail = `deleteText(${op.length}) at Ln ${op.line + 1}, Col ${op.column + 1}`;
        break;
      case 'splitLine':
        detail = `splitLine at Ln ${op.line + 1}, Col ${op.column + 1}`;
        break;
      case 'mergeLine':
        detail = `mergeLine at Ln ${op.line + 1}`;
        break;
      case 'insertLine':
        detail = `insertLine("${op.text.substring(0, 30)}${op.text.length > 30 ? '...' : ''}") at ${op.index + 1}`;
        break;
      case 'deleteLine':
        detail = `deleteLine at ${op.index + 1}`;
        break;
      case 'replaceLine':
        detail = `replaceLine at ${op.index + 1}`;
        break;
    }
    const time = new Date().toLocaleTimeString('en', { hour12: false });
    entry.innerHTML = `<span class="ev-time">${time}</span> <span class="op-user" style="color:${color}">${user}</span> <span class="op-type">${op.type}</span> <span class="op-detail">${detail}</span>`;
    collabOpLog.appendChild(entry);
    collabOpLog.scrollTop = collabOpLog.scrollHeight;
  }
  while (collabOpLog.children.length > 200) {
    collabOpLog.removeChild(collabOpLog.firstChild!);
  }
}

function startCollab() {
  if (collabActive) return;
  collabActive = true;

  // Clean previous
  const aliceEl = document.getElementById('collab-editor-alice')!;
  const bobEl = document.getElementById('collab-editor-bob')!;
  aliceEl.innerHTML = '';
  bobEl.innerHTML = '';
  collabOpLog.innerHTML = '';

  // Create the local collaboration setup with server
  collabSetup = new LocalCollabSetup(80);

  // Create editors
  collabAlice = new NodiusEditor(aliceEl, {
    value: collabInitialCode,
    language: 'typescript',
    fileName: 'collab.ts',
    theme: 'dark',
    fontSize: 13,
    minimap: false,
    lineNumbers: true,
    tabBar: false,      // No tab bar in collab editors
    sidebar: false,     // No sidebar in collab editors
    statusBar: false,   // No status bar in collab editors
  });

  collabBob = new NodiusEditor(bobEl, {
    value: collabInitialCode,
    language: 'typescript',
    fileName: 'collab.ts',
    theme: 'dark',
    fontSize: 13,
    minimap: false,
    lineNumbers: true,
    tabBar: false,      // No tab bar in collab editors
    sidebar: false,     // No sidebar in collab editors
    statusBar: false,   // No status bar in collab editors
  });

  // Create collaboration clients (connected through the server)
  clientAlice = collabSetup.createClient('alice', '#4fc1ff', 'Alice');
  clientBob = collabSetup.createClient('bob', '#f5a623', 'Bob');

  // Wire Alice's editor: local ops -> send to server via client
  collabAlice.on('content:change', ({ ops }) => {
    if (ops.length > 0 && ops[0].origin !== 'remote') {
      clientAlice!.applyLocal(ops as Operation[]);
      logCollabOp('Alice', '#4fc1ff', ops);
    }
  });

  // Wire Bob's editor: local ops -> send to server via client
  collabBob.on('content:change', ({ ops }) => {
    if (ops.length > 0 && ops[0].origin !== 'remote') {
      clientBob!.applyLocal(ops as Operation[]);
      logCollabOp('Bob', '#f5a623', ops);
    }
  });

  // Wire Alice: receive remote ops from server (originating from Bob)
  clientAlice.onRemoteOperations((ops) => {
    const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
    collabAlice!.dispatch({ ops: remoteOps, origin: 'remote' });
    logCollabOp('Bob->Alice', '#f5a623', ops);
  });

  // Wire Bob: receive remote ops from server (originating from Alice)
  clientBob.onRemoteOperations((ops) => {
    const remoteOps = ops.map((op) => ({ ...op, origin: 'remote' as const }));
    collabBob!.dispatch({ ops: remoteOps, origin: 'remote' });
    logCollabOp('Alice->Bob', '#4fc1ff', ops);
  });

  // Update UI
  collabStatusDot.className = 'pg-collab-dot connected';
  collabStatusText.textContent = 'Connected (2 users)';
  btnStart.disabled = true;
  btnStop.disabled = false;

  const initEntry = document.createElement('div');
  initEntry.style.color = 'var(--pg-success)';
  initEntry.textContent = `[${new Date().toLocaleTimeString('en', { hour12: false })}] Session started. Type in either editor!`;
  collabOpLog.appendChild(initEntry);
}

function stopCollab() {
  if (!collabActive) return;
  collabActive = false;

  clientAlice?.destroy();
  clientBob?.destroy();
  collabAlice?.destroy();
  collabBob?.destroy();

  clientAlice = null;
  clientBob = null;
  collabAlice = null;
  collabBob = null;
  collabSetup = null;

  // Update UI
  collabStatusDot.className = 'pg-collab-dot disconnected';
  collabStatusText.textContent = 'Disconnected';
  btnStart.disabled = false;
  btnStop.disabled = true;

  const entry = document.createElement('div');
  entry.style.color = 'var(--pg-danger)';
  entry.textContent = `[${new Date().toLocaleTimeString('en', { hour12: false })}] Session stopped.`;
  collabOpLog.appendChild(entry);
}

btnStart.addEventListener('click', startCollab);
btnStop.addEventListener('click', stopCollab);

// ========================================================================
//  Console info
// ========================================================================
console.log(
  '%cNodius Code Editor %cPlayground',
  'font-weight:bold;font-size:14px;color:#007acc',
  'font-size:14px;color:#888',
);
console.log('Access the editor via window.editor');
console.log('Toggle theme: editor.toggleTheme()');
