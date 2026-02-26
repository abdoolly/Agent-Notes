# Research: Editor Feedback Extension

**Date**: 2026-02-23
**Branch**: `001-editor-feedback-ext`

## R1: VSCode Comments API

**Decision**: Use `vscode.comments.createCommentController()` with `commentingRangeProvider` returning full document range to enable commenting on any line.

**Rationale**: This is the only official API for in-editor comment threads. It provides native Google Docs-style UX — gutter icons, thread creation, reply chains, edit/delete — with minimal code. No alternative exists. The controller automatically renders diamond gutter glyphs; custom range highlighting requires a separate `TextEditorDecorationType`.

**Alternatives considered**:
- CodeLens API: Line-level only, no range selection, no threaded replies
- Webview panels: Heavy, breaks native editor flow
- Diagnostics API: Designed for errors, would pollute Problems panel

## R2: Comment Persistence

**Decision**: Store feedback in `.vscode/plan-feedback.json` using `vscode.workspace.fs`. Restore threads on activation by calling `createCommentThread` for each saved entry.

**Rationale**: The Comments API has zero built-in persistence (confirmed by VSCode team). On activation, the extension must recreate every thread from stored data. JSON file is human-readable, diffable, and serves double duty as the MCP server's data source.

**Alternatives considered**:
- `ExtensionContext.workspaceState`: Opaque, not readable by MCP server process
- `ExtensionContext.globalState`: Wrong scope (cross-workspace)
- SQLite: Overkill for this use case

## R3: MCP Server Architecture

**Decision**: Two-process architecture — extension process registers `McpServerDefinitionProvider`, separate Node.js process runs the MCP server via `StdioServerTransport`.

**Rationale**: This is the official VSCode MCP pattern (1.99+). The extension registers via `contributes.mcpServerDefinitionProviders` in package.json and `vscode.lm.registerMcpServerDefinitionProvider()` at runtime. VSCode spawns the MCP server as a child process communicating over stdio JSON-RPC. AI agents discover tools automatically in agent mode.

**Alternatives considered**:
- HTTP transport (`McpHttpServerDefinition`): Requires port management
- SSE transport: More complex, no benefit for local extension
- In-process: Not supported by VSCode MCP API

## R4: Extension ↔ MCP Server Communication

**Decision**: The MCP server reads the same `.vscode/plan-feedback.json` file that the extension writes. File-based shared state with the MCP server reading on each tool invocation.

**Rationale**: The MCP server runs as a separate process with no direct access to the extension's in-memory state. File-based sharing is the simplest bridge — the extension writes on every change, the MCP server reads on every tool call. The mcp-diagnostics-extension validates this pattern.

**Alternatives considered**:
- IPC/message passing: Complex, requires custom protocol
- Environment variables: Too limited for structured data
- Shared memory: Not available in Node.js without native modules

## R5: MCP Tool Schema

**Decision**: Define three tools: `get_feedback` (query all or by file), `resolve_feedback` (delete a comment by ID), `get_feedback_summary` (workspace-wide overview).

**Rationale**: Matches the spec's FR-004 through FR-007. Tools use `@modelcontextprotocol/sdk` with zod schemas. Minimal surface area — AI agents can read all feedback, filter by file, and resolve individual items.

**Alternatives considered**:
- Single `feedback` tool with sub-commands: Less discoverable for AI agents
- Resource-based (MCP resources instead of tools): Tools are better for actions like resolve

## R6: Document Range Tracking

**Decision**: Three-layer approach: (1) `DecorationRangeBehavior.ClosedClosed` for visual auto-tracking, (2) `onDidChangeTextDocument` delta computation for persistent model sync, (3) fuzzy text matching for recovery after large edits.

**Rationale**: Layer 1 handles visual updates automatically via VSCode's decoration engine. Layer 2 computes `lineDelta = (newlines in change.text) - (change.range.end.line - change.range.start.line)` and shifts all tracked ranges. Layer 3 stores the anchored text snippet + 3 lines of context for fuzzy re-anchoring using the Bitap algorithm (via `diff-match-patch` library).

**Alternatives considered**:
- Operational Transform: Designed for collaborative editing, overkill
- Full diff recomputation per edit: Expensive for large files
- AST-based anchoring: Language-specific, not universal

## R7: Orphan Detection

**Decision**: Mark comments as orphaned when the anchored range is fully deleted AND fuzzy re-anchoring scores below 0.5 similarity threshold.

**Rationale**: Pipeline: (1) delta shift detects range overlap with deletion, (2) attempt fuzzy re-anchor with stored snippet, (3) if best match score < 0.5, mark orphaned. Orphaned comments remain visible in the overview panel with original text preserved. Follows the GitHub PR extension's "outdated" comment pattern.

**Alternatives considered**:
- Immediate deletion: Data loss risk
- Keep all orphans indefinitely: UI clutter
- Require manual re-anchoring: Poor UX

## R8: Context Menu & Keyboard Shortcuts

**Decision**: Register `editor/context` menu item with `when: editorTextFocus` clause, plus `Ctrl+Shift+M` / `Cmd+Shift+M` keybinding.

**Rationale**: Standard VSCode contribution point pattern. The `comments/commentThread/context` menu point handles thread-specific actions (reply, delete, resolve). Command palette provides alternative access.

**Alternatives considered**:
- Command palette only: Less discoverable
- Custom status bar button: Not contextual to selection
