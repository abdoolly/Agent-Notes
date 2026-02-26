# Data Model: Diagnostics Integration

## Entities

### FeedbackDiagnostic (runtime only — not persisted)

A VSCode `Diagnostic` object representing a single feedback thread. Created from `FeedbackThread` data.

| Field | Type | Description |
|-|-|-|
| range | vscode.Range | Line range from `FeedbackThread.range` |
| message | string | Formatted text: comment body, author, replies, selected text |
| severity | DiagnosticSeverity.Information | Non-error severity for visibility without alarm |
| source | "Plan Feedback" | Source label for filtering and identification |
| code | string | Thread UUID for programmatic identification |

**Mapping**: One `FeedbackThread` → one `Diagnostic`. All diagnostics for a file are set atomically via `collection.set(uri, diagnostics[])`.

### DiagnosticCollection (singleton)

A single `vscode.DiagnosticCollection` owned by the extension.

| Property | Value |
|-|-|
| name | "plan-feedback" |
| lifecycle | Created at activation, auto-disposed via `context.subscriptions` |
| update triggers | Thread added, replied to, resolved, range shifted, store reloaded |

## Unchanged Entities

The following entities from `src/types.ts` are NOT modified:

- **FeedbackThread**: Source data for diagnostics. No schema changes.
- **FeedbackComment**: Individual comment within a thread. No schema changes.
- **FeedbackStore**: Persistence container. No schema changes.

## Removed Entities

- **MCP Server**: `src/mcp/server.ts` and all MCP tool definitions are removed.
- **MCP SDK types**: `McpServer`, `StdioServerTransport`, zod schemas — all removed.

## Relationships

```
FeedbackStore (persisted JSON)
  └── FeedbackThread[]
        └── maps to → Diagnostic (runtime)
              └── grouped by file URI → DiagnosticCollection.set(uri, diagnostics[])
```

## Message Format

Diagnostic messages follow this plain-text format:

```
[Feedback] {author} ({date}): {comment body}
On: "{selected text}"
```

For threads with replies:
```
[Feedback] {author} ({date}): {comment body}
On: "{selected text}"
---
[Reply] {author2} ({date2}): {reply body}
[Reply] {author3} ({date3}): {reply body}
```

For orphaned threads, prepend:
```
[ORPHANED] [Feedback] {author} ({date}): {comment body}
...
```
