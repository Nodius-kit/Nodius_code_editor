# Nodius Code Editor

A lightweight, embeddable VS Code-like code editor built from scratch in TypeScript. Zero framework dependencies. Supports syntax highlighting, real-time collaboration, themes, and Web Components.

[![npm version](https://img.shields.io/npm/v/nodius-code-editor.svg)](https://www.npmjs.com/package/nodius-code-editor)
[![license](https://img.shields.io/npm/l/nodius-code-editor.svg)](https://github.com/nicmusic/nodius-code-editor/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/nodius-code-editor)](https://bundlephobia.com/package/nodius-code-editor)

---

## Features

- **Zero dependencies** -- no frameworks, no runtime libraries
- **TypeScript-first** -- written entirely in TypeScript with full type exports
- **Syntax highlighting** -- built-in TypeScript/JavaScript tokenizer with extensible language support
- **Real-time collaboration** -- operational transformation (OT) engine with server and client components
- **Dark and light themes** -- VS Code-inspired themes with full CSS variable customization
- **Web Component** -- drop-in `<nodius-editor>` custom element
- **VS Code keybindings** -- undo, redo, copy, cut, paste, find/replace, indent, comment toggle, and more
- **Minimap** -- code overview panel with viewport highlighting
- **Find and Replace** -- regex, case-sensitive, and whole-word search with replace/replace-all
- **Autocomplete** -- intelligent code completion with documentation panel (TypeScript/JavaScript built-in)
- **Auto-closing brackets** -- automatic pairing for `{}`, `()`, `[]`, quotes, and backticks
- **Auto-indentation** -- smart indent on Enter after opening brackets
- **Line numbers** -- togglable gutter with line numbers
- **Tab bar, sidebar, and status bar** -- all individually togglable
- **Multi-line paste** -- correct handling of pasted multi-line content
- **Read-only mode** -- lock the editor content while keeping navigation
- **Modular architecture** -- import only what you need from the public API

---

## Installation

### Package manager

```bash
# npm
npm install nodius-code-editor

# yarn
yarn add nodius-code-editor

# pnpm
pnpm add nodius-code-editor
```

### CDN

```html
<!-- ES module -->
<script type="module">
  import { NodiusEditor } from 'https://unpkg.com/nodius-code-editor/dist/nodius-code-editor.js';
</script>

<!-- UMD (global: NodiusEditor) -->
<script src="https://unpkg.com/nodius-code-editor/dist/nodius-code-editor.umd.cjs"></script>

<!-- Stylesheet -->
<link rel="stylesheet" href="https://unpkg.com/nodius-code-editor/dist/nodius-code-editor.css" />
```

You can substitute `unpkg.com` with `cdn.jsdelivr.net/npm` if preferred.

---

## Quick Start

```typescript
import { NodiusEditor } from 'nodius-code-editor';
import 'nodius-code-editor/style.css';

const editor = new NodiusEditor(document.getElementById('editor')!, {
  value: 'console.log("Hello world!");',
  language: 'typescript',
  theme: 'dark',
});
```

### Minimal editor (no chrome)

```typescript
const editor = new NodiusEditor(container, {
  value: code,
  tabBar: false,
  sidebar: false,
  statusBar: false,
  minimap: false,
});
```

### Dynamic editors

Create editors programmatically from CSS selectors or DOM references, and destroy them when no longer needed:

```typescript
import { NodiusEditor } from 'nodius-code-editor';
import 'nodius-code-editor/style.css';

// Create from a CSS selector
const editor1 = NodiusEditor.create('#editor-1', {
  value: 'const x = 1;',
  language: 'typescript',
});

// Create from a DOM element
const div = document.createElement('div');
document.body.appendChild(div);
const editor2 = NodiusEditor.create(div, {
  value: 'console.log("hello");',
  theme: 'light',
});

// Destroy when done
editor1.destroy();
editor2.destroy();
div.remove();
```

#### Multiple editors on the same page

```typescript
const containers = document.querySelectorAll('.code-editor');
const editors: NodiusEditor[] = [];

containers.forEach((el) => {
  editors.push(NodiusEditor.create(el as HTMLElement, { theme: 'dark' }));
});

// Clean up all editors
editors.forEach((e) => e.destroy());
```

### Reading and writing content

```typescript
// Get the current text
const text = editor.getValue();

// Replace all content
editor.setValue('const x = 42;');

// Listen for changes
editor.on('content:change', ({ document, ops }) => {
  console.log('New content:', document);
});
```

---

## Configuration

All options are optional. Pass them as the second argument to `new NodiusEditor(container, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | `''` | Initial editor content |
| `language` | `string` | `'auto'` | Language ID for syntax highlighting. Use `'auto'` for detection by file name/content, or `'typescript'`, `'javascript'`, `'plaintext'` |
| `fileName` | `string` | `'untitled.ts'` | File name shown in the tab bar and used for language auto-detection |
| `theme` | `'dark' \| 'light'` | `'dark'` | Color theme |
| `readOnly` | `boolean` | `false` | Disable editing while allowing selection and scrolling |
| `fontSize` | `number` | `14` | Font size in pixels |
| `tabSize` | `number` | `2` | Number of spaces per indentation level |
| `minimap` | `boolean` | `true` | Show the code minimap |
| `lineNumbers` | `boolean` | `true` | Show line numbers in the gutter |
| `wordWrap` | `boolean` | `false` | Wrap long lines |
| `tabBar` | `boolean` | `true` | Show the tab bar |
| `sidebar` | `boolean` | `true` | Show the sidebar |
| `statusBar` | `boolean` | `true` | Show the status bar |
| `findReplace` | `boolean` | `true` | Enable the find/replace panel |
| `autocomplete` | `boolean` | `true` | Enable intelligent autocompletion |

```typescript
const editor = new NodiusEditor(container, {
  value: sourceCode,
  language: 'typescript',
  fileName: 'app.ts',
  theme: 'dark',
  readOnly: false,
  fontSize: 14,
  tabSize: 2,
  minimap: true,
  lineNumbers: true,
  wordWrap: false,
  tabBar: true,
  sidebar: true,
  statusBar: true,
  findReplace: true,
  autocomplete: true,
});
```

---

## API Reference

### `NodiusEditor`

#### Constructor

```typescript
new NodiusEditor(container: HTMLElement, options?: EditorOptions)
```

Creates a new editor instance and mounts it into the given DOM element.

#### Content

| Method | Signature | Description |
|---|---|---|
| `getValue()` | `(): string` | Returns the full text content of the editor |
| `setValue(value)` | `(value: string): void` | Replaces the entire editor content |
| `getDocument()` | `(): Document` | Returns the internal document model |

#### Selection

| Method | Signature | Description |
|---|---|---|
| `getSelection()` | `(): MultiSelection` | Returns the current selection state |
| `setSelection(selection)` | `(selection: MultiSelection): void` | Sets the selection programmatically |

#### Language

| Method | Signature | Description |
|---|---|---|
| `getLanguage()` | `(): string` | Returns the current language ID |
| `setLanguage(languageId)` | `(languageId: string): void` | Changes the syntax highlighting language |

#### Theme

| Method | Signature | Description |
|---|---|---|
| `getTheme()` | `(): 'dark' \| 'light'` | Returns the current theme |
| `setTheme(theme)` | `(theme: 'dark' \| 'light'): void` | Sets the theme |
| `toggleTheme()` | `(): 'dark' \| 'light'` | Toggles between dark and light, returns the new theme |

#### Editor state

| Method | Signature | Description |
|---|---|---|
| `focus()` | `(): void` | Focuses the editor |
| `setReadOnly(readOnly)` | `(readOnly: boolean): void` | Enables or disables read-only mode |

#### Events

| Method | Signature | Description |
|---|---|---|
| `on(event, handler)` | `<K>(event: K, handler: (data: EditorEvents[K]) => void): () => void` | Subscribes to an event. Returns an unsubscribe function |

Available events:

| Event | Payload | Description |
|---|---|---|
| `'state:change'` | `{ state: EditorStateSnapshot }` | Fired on any state change |
| `'selection:change'` | `{ selection: MultiSelection }` | Fired when the selection changes |
| `'content:change'` | `{ document: Document; ops: readonly Operation[] }` | Fired when the document content changes |
| `'mount'` | `{ container: HTMLElement }` | Fired once after the editor mounts |
| `'destroy'` | `{}` | Fired when the editor is destroyed |
| `'language:change'` | `{ languageId: string }` | Fired when the language changes |
| `'theme:change'` | `{ theme: string }` | Fired when the theme changes |

#### Transactions

| Method | Signature | Description |
|---|---|---|
| `dispatch(transaction)` | `(transaction: Transaction): void` | Applies a transaction (array of operations) to the editor |

A `Transaction` contains:

```typescript
interface Transaction {
  readonly ops: readonly Operation[];
  readonly selection?: MultiSelection;
  readonly origin: OperationOrigin;  // 'input' | 'remote' | 'history:undo' | 'history:redo' | 'command'
}
```

#### Registries

| Method | Signature | Description |
|---|---|---|
| `getCommandRegistry()` | `(): CommandRegistry` | Returns the command registry for registering custom commands |
| `getKeymapRegistry()` | `(): KeymapRegistry` | Returns the keymap registry for custom key bindings |
| `getLanguageRegistry()` | `(): LanguageRegistry` | Returns the language registry for adding language parsers |

#### Lifecycle

| Method | Signature | Description |
|---|---|---|
| `destroy()` | `(): void` | Unmounts the editor and cleans up all resources |

---

## Web Component

Nodius registers a `<nodius-editor>` custom element automatically when imported.

```html
<script type="module">
  import 'nodius-code-editor';
  import 'nodius-code-editor/style.css';
</script>

<nodius-editor theme="dark" language="typescript">
  const x: number = 42;
</nodius-editor>
```

### Attributes

| Attribute | Description |
|---|---|
| `theme` | `"dark"` or `"light"` |
| `language` | Language ID (e.g., `"typescript"`, `"javascript"`, `"auto"`) |
| `file-name` | File name for tab display and language detection |
| `readonly` | Present to enable read-only mode |
| `font-size` | Font size in pixels (default: `14`) |
| `tab-size` | Spaces per tab (default: `2`) |
| `no-minimap` | Present to hide the minimap |
| `no-line-numbers` | Present to hide line numbers |

### Accessing the editor instance

```typescript
const el = document.querySelector('nodius-editor') as NodiusEditorElement;
const editor = el.getEditor();
editor?.setValue('new content');
```

### Reactive attribute changes

Changing `theme`, `language`, or `readonly` attributes at runtime automatically updates the editor.

```typescript
el.setAttribute('theme', 'light');
el.setAttribute('language', 'javascript');
el.toggleAttribute('readonly', true);
```

---

## Themes

### Built-in themes

Nodius ships with two themes: `dark` and `light`, inspired by VS Code's default color schemes.

```typescript
editor.setTheme('light');
editor.setTheme('dark');

// Toggle with a keyboard shortcut or button
editor.toggleTheme();
```

### Custom themes via CSS variables

All colors are controlled by CSS custom properties prefixed with `--nc-`. Override them on the editor wrapper to create a custom theme.

```css
.nc-editor-wrapper {
  /* Backgrounds */
  --nc-bg: #1a1b26;
  --nc-fg: #c0caf5;
  --nc-bg-sidebar: #1a1b26;
  --nc-bg-statusbar: #7aa2f7;
  --nc-fg-statusbar: #1a1b26;
  --nc-bg-tab-active: #1a1b26;
  --nc-bg-tab-inactive: #24283b;
  --nc-bg-gutter: #1a1b26;
  --nc-fg-gutter: #565f89;
  --nc-bg-line-highlight: #292e42;
  --nc-bg-selection: #364a82;
  --nc-border: #3b4261;

  /* Scrollbar */
  --nc-scrollbar: #414868;
  --nc-scrollbar-hover: #565f89;

  /* Cursor */
  --nc-cursor: #c0caf5;

  /* Syntax tokens */
  --nc-keyword: #9d7cd8;
  --nc-string: #9ece6a;
  --nc-number: #ff9e64;
  --nc-comment: #565f89;
  --nc-operator: #89ddff;
  --nc-punctuation: #c0caf5;
  --nc-identifier: #7dcfff;
  --nc-type: #2ac3de;
  --nc-decorator: #e0af68;
  --nc-regexp: #f7768e;
  --nc-template: #9ece6a;
  --nc-plain: #c0caf5;

  /* Minimap */
  --nc-minimap-bg: #1a1b26;
  --nc-minimap-visible: rgba(255, 255, 255, 0.1);

  /* Diagnostics */
  --nc-error: #f7768e;
  --nc-warning: #e0af68;
  --nc-info: #7aa2f7;
}
```

### Using theme objects programmatically

```typescript
import { darkTheme, lightTheme, ThemeManager } from 'nodius-code-editor';

// Inspect available CSS variables
console.log(Object.keys(darkTheme));
// ['--nc-bg', '--nc-fg', '--nc-bg-sidebar', ...]
```

---

## Language Support

### Built-in languages

Nodius includes a built-in TypeScript/JavaScript tokenizer that handles keywords, strings, template literals, numbers, comments, decorators, regular expressions, types, and more.

```typescript
// Explicit language setting
const editor = new NodiusEditor(container, {
  value: code,
  language: 'typescript',
});

// Auto-detection from file name
const editor = new NodiusEditor(container, {
  value: code,
  language: 'auto',
  fileName: 'utils.js', // detects JavaScript
});
```

### Changing the language at runtime

```typescript
editor.setLanguage('javascript');
editor.setLanguage('plaintext'); // disables highlighting
```

### Adding a custom language parser

Implement the `LanguageParser` interface and register it:

```typescript
import type { LanguageParser, LanguageDefinition, EditorToken } from 'nodius-code-editor';
import { LanguageRegistry } from 'nodius-code-editor';

class MyLanguageParser implements LanguageParser {
  getDefinition(): LanguageDefinition {
    return {
      id: 'my-lang',
      name: 'My Language',
      extensions: ['.ml'],
      mimeTypes: ['text/x-my-lang'],
    };
  }

  tokenize(text: string): EditorToken[] {
    // Return an array of tokens with { offset, length, kind }
    // where kind is a TokenKind like 'keyword', 'string', 'comment', etc.
    return [{ offset: 0, length: text.length, kind: 'plain' }];
  }
}

const registry = editor.getLanguageRegistry();
registry.register(new MyLanguageParser());
editor.setLanguage('my-lang');
```

### Language detection utilities

```typescript
import { detectByExtension, detectByContent } from 'nodius-code-editor';

detectByExtension('app.tsx');  // 'typescript'
detectByContent('#!/usr/bin/env node'); // 'javascript'
```

---

## Autocomplete

Nodius provides intelligent autocompletion powered by the TypeScript Language Service. Completions appear automatically as you type and include a documentation panel showing type signatures and descriptions.

### Behavior

- **Always-on**: completions appear automatically when typing identifier characters or after trigger characters (`.`)
- **Navigation**: use Arrow Up/Down to navigate, Enter or Tab to accept, Escape to dismiss
- **Documentation panel**: shows the type signature and description of the selected completion item
- **Smart dismiss**: the popup dismisses when clicking elsewhere, pressing Escape, or typing whitespace/punctuation

### Disabling autocomplete

```typescript
const editor = new NodiusEditor(container, {
  autocomplete: false,
});
```

### Custom completions

Register static completion items:

```typescript
const unregister = editor.registerCompletions([
  { label: 'myFunction', kind: 'function', detail: '(): void', documentation: 'Does something useful' },
  { label: 'myVariable', kind: 'variable', detail: 'string', documentation: 'A custom variable' },
]);

// Later, to remove them:
unregister();
```

### Custom completion provider

For dynamic completions, register a provider:

```typescript
const unregister = editor.registerCompletionProvider({
  triggerCharacters: ['/'],
  provideCompletions(context) {
    if (context.triggerCharacter === '/') {
      return {
        items: [
          { label: 'api/users', kind: 'value', detail: 'GET endpoint' },
          { label: 'api/posts', kind: 'value', detail: 'GET endpoint' },
        ],
      };
    }
    return { items: [] };
  },
});
```

---

## Collaboration

Nodius includes a complete real-time collaboration system based on Operational Transformation (OT) using the Jupiter/Wave protocol. The system consists of two components:

- **`CollaborationServer`** -- serializes operations from all clients and broadcasts transformed results
- **`CollaborationClient`** -- a 3-state machine that handles local edits, remote ops, and ACK-gated message sending

### Basic setup

```typescript
import {
  NodiusEditor,
  CollaborationServer,
  CollaborationClient,
} from 'nodius-code-editor';

// --- Server side (e.g., in a Node.js WebSocket server) ---

const server = new CollaborationServer();

wss.on('connection', (ws, req) => {
  const userId = req.headers['x-user-id'] as string;

  // Register the client with the server
  server.addClient(userId, (msg) => {
    ws.send(JSON.stringify(msg));
  });

  // Route incoming messages to the server
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    server.receiveFromClient(userId, message);
  });

  ws.on('close', () => {
    server.removeClient(userId);
  });
});

// --- Client side ---

const ws = new WebSocket('ws://localhost:8080');

const client = new CollaborationClient({
  userId: 'user1',
  color: '#4fc1ff',
  send: (msg) => ws.send(JSON.stringify(msg)),
});

// Route server messages to the client
ws.addEventListener('message', (event) => {
  client.handleMessage(JSON.parse(event.data));
});

// Send local edits to the collaboration client
editor.on('content:change', ({ ops }) => {
  const localOps = ops.filter((op) => op.origin !== 'remote');
  if (localOps.length > 0) {
    client.applyLocal(localOps);
  }
});

// Apply remote operations to the editor
client.onRemoteOperations((ops) => {
  editor.dispatch({
    ops: ops.map((op) => ({ ...op, origin: 'remote' as const })),
    origin: 'remote',
  });
});

// Sync cursor positions
editor.on('selection:change', ({ selection }) => {
  const primary = selection.ranges[selection.primary];
  if (primary) {
    client.updateLocalCursor(primary.focus);
  }
});

client.onRemoteCursorUpdate((cursors) => {
  console.log('Remote cursors:', cursors);
});
```

### CollaborationServer API

| Method | Signature | Description |
|---|---|---|
| `addClient(clientId, send)` | `(clientId: string, send: (msg: ServerMessage) => void): void` | Register a new client |
| `removeClient(clientId)` | `(clientId: string): void` | Remove a client |
| `getRevision()` | `(): number` | Get the current server revision |
| `receiveFromClient(clientId, message)` | `(clientId: string, message: ClientMessage): void` | Process a message from a client |

### CollaborationClient API

| Method | Signature | Description |
|---|---|---|
| `applyLocal(ops)` | `(ops: Operation[]): void` | Submit local operations |
| `handleMessage(msg)` | `(msg: ServerMessage): void` | Process a message from the server |
| `onRemoteOperations(handler)` | `(handler: (ops: Operation[]) => void): void` | Register callback for remote ops |
| `onRemoteCursorUpdate(handler)` | `(handler: (cursors: RemoteCursor[]) => void): void` | Register callback for cursor updates |
| `updateLocalCursor(position)` | `(position: Position): void` | Send cursor position to the server |
| `getRemoteCursors()` | `(): RemoteCursor[]` | Get all tracked remote cursors |
| `getState()` | `(): 'synchronized' \| 'awaitingConfirm' \| 'awaitingWithBuffer'` | Get the current OT state (useful for debugging) |
| `getRevision()` | `(): number` | Get the known server revision |
| `destroy()` | `(): void` | Clean up resources |

### CollaborationClientOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `userId` | `string` | required | Unique identifier for this user |
| `color` | `string` | required | Cursor color (e.g., `'#4fc1ff'`) |
| `name` | `string` | `undefined` | Display name for remote cursor labels |
| `send` | `(msg: ClientMessage) => void` | required | Function to send messages to the server |
| `debounceDelay` | `number` | `0` | Milliseconds to debounce before sending in synchronized state |

---

## Advanced

### Custom commands

Register custom commands and execute them programmatically or via key bindings.

```typescript
const commands = editor.getCommandRegistry();

// Register a custom command
commands.register('myCustomFormat', () => {
  const value = editor.getValue();
  editor.setValue(value.trim());
});

// Execute it
commands.execute('myCustomFormat');

// Check if a command exists
commands.has('myCustomFormat'); // true

// List all registered commands
commands.getAll(); // ['undo', 'redo', 'selectAll', 'indent', ...]

// Remove a command
commands.unregister('myCustomFormat');
```

### Built-in commands

| Command ID | Default Keybinding | Description |
|---|---|---|
| `undo` | Ctrl+Z | Undo the last edit |
| `redo` | Ctrl+Shift+Z / Ctrl+Y | Redo the last undone edit |
| `copy` | Ctrl+C | Copy selected text |
| `cut` | Ctrl+X | Cut selected text |
| `paste` | Ctrl+V | Paste from clipboard |
| `selectAll` | Ctrl+A | Select all text |
| `indent` | Tab | Indent selected lines or insert spaces |
| `outdent` | Shift+Tab | Outdent selected lines |
| `duplicateLine` | Ctrl+D | Duplicate the current line |
| `toggleComment` | Ctrl+/ | Toggle line comment |
| `find` | Ctrl+F | Open the find panel |
| `replace` | Ctrl+H | Open the find and replace panel |
| `save` | Ctrl+S | Save (no-op by default, override to implement) |
| `toggleTheme` | -- | Toggle between dark and light themes |
| `toggleSidebar` | -- | Toggle sidebar visibility |

### Custom key bindings

```typescript
const keymap = editor.getKeymapRegistry();

// Add a custom key binding
keymap.register({
  key: 'b',
  ctrl: true,
  commandId: 'toggleSidebar',
});

// Override an existing binding
keymap.unregister('save'); // remove default
keymap.register({
  key: 's',
  ctrl: true,
  commandId: 'myCustomSave',
});

// Query bindings for a command
keymap.getBindingsForCommand('undo');
// [{ key: 'z', ctrl: true, commandId: 'undo' }]
```

### Dispatching transactions directly

For low-level control, dispatch transactions with explicit operations:

```typescript
import { createPosition, createCollapsedRange, createSelection } from 'nodius-code-editor';

// Insert text at a specific position
editor.dispatch({
  ops: [
    {
      type: 'insertText',
      line: 0,
      column: 0,
      text: '// Header comment\n',
      origin: 'command',
    },
  ],
  origin: 'command',
});

// Set cursor to line 5, column 10
editor.setSelection(
  createSelection([createCollapsedRange(createPosition(5, 10))])
);
```

### Operation types

| Type | Fields | Description |
|---|---|---|
| `insertText` | `line, column, text, origin` | Insert text at a position |
| `deleteText` | `line, column, length, origin` | Delete a range of characters |
| `insertLine` | `index, text, origin` | Insert a new line at an index |
| `deleteLine` | `index, origin` | Delete a line at an index |
| `splitLine` | `line, column, origin` | Split a line at a position (like pressing Enter) |
| `mergeLine` | `line, origin` | Merge a line with the next line |
| `replaceLine` | `index, text, origin` | Replace an entire line's content |

---

## Development

### Prerequisites

- Node.js >= 18
- npm, yarn, or pnpm

### Setup

```bash
git clone https://github.com/nicmusic/nodius-code-editor.git
cd nodius-code-editor
npm install
```

### Scripts

```bash
# Start the dev server with hot reload
npm run dev

# Type-check without emitting
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production (outputs to dist/)
npm run build

# Preview the production build
npm run preview
```

### Build output

After running `npm run build`, the `dist/` folder contains:

| File | Format | Description |
|---|---|---|
| `nodius-code-editor.js` | ES module | Tree-shakable ESM build |
| `nodius-code-editor.umd.cjs` | UMD | Universal module for `<script>` tags and CommonJS |
| `nodius-code-editor.css` | CSS | All editor styles |
| `index.d.ts` | TypeScript | Type declarations |

---

## Architecture

The codebase is organized into clearly separated modules:

```
src/
  index.ts              Public API exports
  NodiusEditor.ts       Main editor class (orchestrates all subsystems)

  core/
    types.ts            Shared type definitions
    EditorState.ts      Immutable editor state container
    document/           Document model (lines, text operations)
    operations/         Operation engine (apply ops to documents)
    selection/          Position, range, and multi-selection logic
    history/            Undo/redo history manager
    commands/           Command registry
    keymap/             Key binding registry
    events/             Typed event bus
    completion/         CompletionEngine, types

  language/
    types.ts            LanguageParser, token types
    LanguageRegistry.ts Parser registry and language detection
    detection.ts        Auto-detection by extension and content
    typescript/         Built-in TypeScript/JavaScript tokenizer
      TypeScriptCompletionProvider  TS Language Service completions

  collaboration/
    types.ts            Protocol message types
    OTEngine.ts         Operational transformation (transform pairs of ops)
    CollaborationServer.ts  Server-side OT coordinator
    CollaborationClient.ts  Client-side 3-state OT machine
    CursorSync.ts       Remote cursor tracking
    BatchedTransport.ts Legacy batched transport adapter

  themes/
    ThemeManager.ts     Theme switching via CSS variables
    dark.ts             Dark theme color map
    light.ts            Light theme color map

  view/
    EditorView.ts       Main view (content area, scrolling, rendering)
    LineRenderer.ts     Renders individual lines with syntax tokens
    Reconciler.ts       Efficient DOM diffing for line updates
    Gutter.ts           Line numbers
    Minimap.ts          Code overview minimap
    StatusBar.ts        Bottom status bar
    TabBar.ts           File tab bar
    Sidebar.ts          Left sidebar panel
    ScrollManager.ts    Scroll synchronization
    InputHandler.ts     Keyboard and input event handling
    SelectionDOM.ts     DOM selection management
    FindReplace.ts      Find and replace panel
    AutocompleteWidget.ts Autocomplete popup and doc panel

  styles/
    editor.css          Base editor styles
```

### Design principles

- **Immutable state** -- `EditorState` is replaced on every change, never mutated
- **Operation-based editing** -- all edits are expressed as typed operations, enabling OT collaboration and undo/redo
- **Separation of concerns** -- the core model has no DOM dependency; the view layer renders from state
- **Event-driven** -- subsystems communicate through a typed event bus
- **Extensible** -- commands, key bindings, and language parsers are all registered through public registries

---

## License

[MIT](./LICENSE)
