# agent-notes-v2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-23

## Active Technologies
- TypeScript 5.x, Node.js 20+ + `@types/vscode` (^1.99.0), `@modelcontextprotocol/sdk` (^1.x), `diff-match-patch` (^1.x), `zod` (^3.x), `uuid` (^9.x) (001-editor-feedback-ext)
- Workspace-local JSON file (`.vscode/agent-notes.json`), gitignored by defaul (001-editor-feedback-ext)
- TypeScript 5.x, Node.js 20+ + `@types/vscode` (^1.99.0), `diff-match-patch` (^1.x), `uuid` (^9.x) (002-diagnostics-integration)
- Workspace-local JSON file (`.vscode/agent-notes.json`), unchanged (002-diagnostics-integration)

- TypeScript 5.x, Node.js 20+ + `@types/vscode` (^1.99.0), `@modelcontextprotocol/sdk` (^1.x), `diff-match-patch` (^1.x), `zod` (^3.x) (001-editor-feedback-ext)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x, Node.js 20+: Follow standard conventions

## Recent Changes
- 002-diagnostics-integration: Added TypeScript 5.x, Node.js 20+ + `@types/vscode` (^1.99.0), `diff-match-patch` (^1.x), `uuid` (^9.x)
- 001-editor-feedback-ext: Added TypeScript 5.x, Node.js 20+ + `@types/vscode` (^1.99.0), `@modelcontextprotocol/sdk` (^1.x), `diff-match-patch` (^1.x), `zod` (^3.x), `uuid` (^9.x)

- 001-editor-feedback-ext: Added TypeScript 5.x, Node.js 20+ + `@types/vscode` (^1.99.0), `@modelcontextprotocol/sdk` (^1.x), `diff-match-patch` (^1.x), `zod` (^3.x)

<!-- MANUAL ADDITIONS START -->

## Build

Always rebuild before packaging or publishing:

```sh
npm run compile
```

The `dist/` folder contains compiled JS. If you edit `src/` and forget to rebuild, the packaged extension will have stale code and commands will break.

## Publishing to VS Code Marketplace

Publisher: `AbdallahGamal`
Marketplace: https://marketplace.visualstudio.com/items?itemName=AbdallahGamal.agent-notes

### Steps

1. Rebuild: `npm run compile`
2. Login (one-time): `npx @vscode/vsce login AbdallahGamal` — enter your PAT when prompted
3. Publish with auto version bump:
   - Patch: `npx @vscode/vsce publish patch`
   - Minor: `npx @vscode/vsce publish minor`
   - Major: `npx @vscode/vsce publish major`

To package without publishing: `npm run package` (creates `.vsix` file)

### PAT (Personal Access Token)

The token is stored locally in `.env` (gitignored) as `VSCE_PAT`.

To use it: `npx @vscode/vsce login AbdallahGamal` then paste the value from `.env`.

To regenerate: https://dev.azure.com → Profile → Personal Access Tokens:
- Organization: **All accessible organizations**
- Scopes: Custom defined → **Marketplace** → **Manage**

Never commit or hardcode the PAT.

## Commit Convention

Use conventional commits — the CI workflow uses these to auto-publish:

- `fix: ...` → patch bump + publish
- `feat: ...` → minor bump + publish
- `feat!: ...` or `BREAKING CHANGE:` → major bump + publish
- `docs: ...`, `chore: ...`, `ci: ...` → no publish

Scopes are optional: `fix(store): ...`, `feat(panel): ...`

<!-- MANUAL ADDITIONS END -->
