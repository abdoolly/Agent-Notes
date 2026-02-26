# Quickstart: Editor Feedback Extension

## Prerequisites

- Node.js 20+
- VSCode 1.99+ (or compatible fork: Cursor, Windsurf)
- npm or pnpm

## Setup

```bash
# Clone and install
git clone <repo-url>
cd plan-feedback-v2
npm install

# Build
npm run compile

# Run in development (opens Extension Development Host)
npm run watch
# Then press F5 in VSCode to launch the extension dev host
```

## Project Layout

```
src/
├── extension.ts          # Entry point: activation, CommentController
├── comment-controller.ts # Thread creation, replies, edit/delete
├── comment-store.ts      # JSON persistence (.vscode/plan-feedback.json)
├── range-tracker.ts      # Document change tracking, fuzzy re-anchoring
├── feedback-panel.ts     # TreeView sidebar panel
├── gitignore-manager.ts  # Auto-gitignore storage file
└── mcp/
    └── server.ts         # MCP server (separate process, stdio transport)

test/
├── unit/                 # Fast isolated tests
└── integration/          # VSCode extension host tests
```

## Key Patterns

### Two-Process Architecture

The extension runs in two processes:
1. **Extension process** — manages Comments API, UI, persistence
2. **MCP server process** — spawned by VSCode, reads the same JSON file, exposes tools to AI agents

They share state through `.vscode/plan-feedback.json` (file-based).

### Comments API

```typescript
// Create controller (extension.ts)
const ctrl = vscode.comments.createCommentController('plan-feedback', 'Plan Feedback');
ctrl.commentingRangeProvider = {
  provideCommentingRanges: (doc) => [new vscode.Range(0, 0, doc.lineCount - 1, 0)]
};

// Create thread (comment-controller.ts)
const thread = ctrl.createCommentThread(uri, range, [initialComment]);
```

### MCP Tools

```typescript
// Define tool (mcp/server.ts)
server.tool('get_feedback', { filePath: z.string().optional() }, async ({ filePath }) => {
  const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const threads = filePath ? store.threads.filter(t => t.uri === filePath) : store.threads;
  return { content: [{ type: 'text', text: JSON.stringify(threads) }] };
});
```

### Range Tracking

```typescript
// Delta computation (range-tracker.ts)
vscode.workspace.onDidChangeTextDocument(event => {
  for (const change of [...event.contentChanges].reverse()) {
    const lineDelta = countNewlines(change.text) - (change.range.end.line - change.range.start.line);
    // Shift all tracked ranges at or below the change
  }
});
```

## Testing

```bash
# Unit tests
npm test

# Integration tests (requires VSCode)
npm run test:integration

# MCP server tests (stdio)
npm run test:mcp
```

## Build & Package

```bash
# Compile TypeScript
npm run compile

# Package as .vsix
npx @vscode/vsce package

# Install locally
code --install-extension plan-feedback-*.vsix
```

## Development Workflow

1. Make changes in `src/`
2. `npm run watch` recompiles on save
3. Press F5 to launch Extension Development Host
4. Test commenting: select text → right-click → "Add Feedback"
5. Test MCP: open AI agent mode → tools auto-discovered
6. Run `npm test` before committing
