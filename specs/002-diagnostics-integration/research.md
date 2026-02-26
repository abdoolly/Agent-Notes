# Research: Diagnostics Integration

## Decision 1: Diagnostic Severity Level

**Decision**: Use `DiagnosticSeverity.Information` (not Hint)
**Rationale**: Hint diagnostics do NOT appear in the Problems panel, making them invisible to AI agents that query diagnostics. Information severity appears in the Problems panel with lower priority than warnings/errors, providing visibility without alarm.
**Alternatives considered**:
- Hint: Invisible in Problems panel — defeats the purpose
- Warning: Too alarming — users would think there are real issues
- Error: Completely wrong — feedback is not an error

## Decision 2: Diagnostic Source Label

**Decision**: Use `"Plan Feedback"` as the diagnostic source
**Rationale**: The source property appears in the Problems panel next to each diagnostic. A clear, descriptive name lets users and AI agents distinguish feedback from real code issues. Matches the extension display name.
**Alternatives considered**:
- `"feedback"`: Too generic, could conflict with other extensions
- `"plan-feedback"`: Kebab-case looks like a technical identifier, not user-friendly

## Decision 3: Diagnostic Message Format

**Decision**: Multi-line plain text format with structured sections:
```
[Feedback] author (timestamp): comment body
Re: selected text
---
[Reply] author2 (timestamp): reply body
```
**Rationale**: Diagnostic messages are plain text only (no markdown/HTML). Structured format lets AI agents parse the comment, author, selected text, and replies. The `[Feedback]` prefix helps AI agents identify the type.
**Alternatives considered**:
- JSON in message: Machine-readable but unreadable to humans in Problems panel
- Single-line: Truncates in the Problems panel, loses thread context

## Decision 4: Diagnostic Collection Lifecycle

**Decision**: Single `DiagnosticCollection` created at extension activation, registered in `context.subscriptions` for auto-disposal
**Rationale**: One collection manages all feedback diagnostics. Using `collection.set(uri, diagnostics[])` replaces all diagnostics for a file atomically. Registered in subscriptions for clean disposal.
**Alternatives considered**:
- Per-file collections: Unnecessary overhead, harder to manage

## Decision 5: Dependencies to Remove

**Decision**: Remove `@modelcontextprotocol/sdk` and `zod` from dependencies
**Rationale**: These were only used by the MCP server. Removing them reduces bundle size and dependency surface. `zod` has no other consumers in the codebase.
**Alternatives considered**:
- Keep zod for validation: Current validation uses hand-written validators in `comment-store.ts`, not zod. No benefit to keeping it.

## Decision 6: Diagnostics Persistence

**Decision**: Diagnostics persist when files are closed — no special handling needed
**Rationale**: VSCode's DiagnosticCollection keeps diagnostics in memory for the collection's lifetime (until extension deactivates or collection is disposed). Files don't need to be open for their diagnostics to appear in the Problems panel.
