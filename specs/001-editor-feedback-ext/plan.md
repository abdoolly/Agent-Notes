# Implementation Plan: Editor Feedback Extension

**Branch**: `001-editor-feedback-ext` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-editor-feedback-ext/spec.md`

## Summary

A VSCode extension that enables inline feedback comments on any file (code or markdown) using the native Comments API, with an embedded MCP server that exposes feedback to AI agents. The architecture is a two-process design: the extension process manages the UI and persistence, while a separate MCP server process reads the same JSON store and provides `get_feedback`, `resolve_feedback`, and `get_feedback_summary` tools over stdio transport. Comments are persisted to `.vscode/plan-feedback.json` (gitignored by default) and survive editor restarts. Range tracking uses delta computation with fuzzy re-anchoring via diff-match-patch.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: `@types/vscode` (^1.99.0), `@modelcontextprotocol/sdk` (^1.x), `diff-match-patch` (^1.x), `zod` (^3.x), `uuid` (^9.x)
**Storage**: Workspace-local JSON file (`.vscode/plan-feedback.json`), gitignored by default
**Testing**: VSCode Extension Testing (`@vscode/test-electron`), Mocha for unit tests
**Target Platform**: VSCode 1.99+ and compatible forks (Cursor, Windsurf)
**Project Type**: VSCode extension (packaged as `.vsix`)
**Performance Goals**: <200ms startup with 500 comments, <1s MCP response, <3s comment creation flow
**Constraints**: No network calls, no telemetry, workspace-scoped, last-write-wins concurrency
**Scale/Scope**: Single-developer workflow, up to 500 feedback comments per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Evidence |
|-|-|-|
| I. Code Quality | PASS | TypeScript `strict: true`, no `any`, single-responsibility modules (8 files, each <300 lines), functions <40 lines |
| II. Testing Standards | PASS | Unit tests for comment-store, range-tracker, mcp-server; integration tests for extension activation and comment lifecycle; acceptance tests for each user story (US1-US5) |
| III. User Experience First | PASS | 3-interaction comment flow (select → add → confirm), keyboard shortcut `Ctrl+Alt+F`/`Cmd+Alt+F`, context menu, immediate visual feedback (gutter + highlight), silent operation |
| IV. Simplicity | PASS | No abstraction layers, no base classes, no plugin system. JSON file persistence. 8 source modules total. Each dependency justified |
| V. API Contract Stability | PASS | 3 MCP tools with zod schemas, versioned storage format, additive-only output changes |

## Project Structure

### Documentation (this feature)

```text
specs/001-editor-feedback-ext/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── mcp-tools.md     # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── types.ts              # TypeScript interfaces (FeedbackComment, FeedbackThread, Range, FeedbackStore)
├── extension.ts          # Entry point: activation, CommentController setup, command registration
├── comment-controller.ts # Thread creation, replies, edit/delete, resolve, decorations
├── comment-store.ts      # JSON persistence (.vscode/plan-feedback.json) with atomic write + backup
├── range-tracker.ts      # Document change tracking, delta computation, fuzzy re-anchoring
├── feedback-panel.ts     # TreeView sidebar panel (grouped by file, click-to-navigate)
├── gitignore-manager.ts  # Auto-add storage file to .gitignore
└── mcp/
    └── server.ts         # MCP server (separate Node.js process, stdio transport)

test/
├── unit/
│   ├── comment-store.test.ts
│   ├── comment-controller.test.ts
│   ├── mcp-server.test.ts
│   └── range-tracker.test.ts
└── integration/
    └── extension.test.ts
```

**Structure Decision**: Single project (Option 1). The MCP server (`src/mcp/server.ts`) is a separate entry point compiled to `dist/mcp/server.js` but lives in the same project. 8 source modules total, each with a single responsibility per Constitution Principle I.

## Complexity Tracking

No constitution violations requiring justification. All gates pass within the defined constraints.
