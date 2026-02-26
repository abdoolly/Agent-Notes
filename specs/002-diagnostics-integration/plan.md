# Implementation Plan: Diagnostics Integration for Zero-Config AI Access

**Branch**: `002-diagnostics-integration` | **Date**: 2026-02-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-diagnostics-integration/spec.md`

## Summary

Replace the MCP server with VSCode's Diagnostics API to expose feedback comments to AI agents with zero configuration. Each feedback thread becomes a diagnostic entry (severity: Information) with source "Plan Feedback". AI agents already read diagnostics natively — no MCP setup required.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: `@types/vscode` (^1.99.0), `diff-match-patch` (^1.x), `uuid` (^9.x)
**Storage**: Workspace-local JSON file (`.vscode/plan-feedback.json`), unchanged
**Testing**: Mocha + ts-node for unit tests, `@vscode/test-electron` for integration
**Target Platform**: VSCode ^1.99.0 (desktop)
**Project Type**: VSCode extension
**Performance Goals**: Diagnostics update within 500ms of feedback changes, extension activation <200ms
**Constraints**: Extension bundle <500KB, no external processes
**Scale/Scope**: Hundreds of feedback threads per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-|-|-|
| I. Code Quality | PASS | No changes to strict TS, module responsibility rules |
| II. Testing Standards | PASS | New diagnostics module needs unit tests; MCP tests removed |
| III. User Experience First | PASS | Zero-config improves UX — aligns with "no friction" principle |
| IV. Simplicity | PASS | Removes an entire Node.js process + MCP SDK dependency. Net reduction in complexity |
| V. API Contract Stability | VIOLATION | Removing MCP tools (`get_feedback`, `resolve_feedback`, `get_feedback_summary`) is a breaking change. See Complexity Tracking below for justification |
| Compile gate | PASS | Will verify |
| Lint gate | PASS | Will verify |
| Test gate | PASS | MCP tests replaced with diagnostics tests |
| Size gate | PASS | Removing `@modelcontextprotocol/sdk` and `zod` reduces bundle size |
| Startup gate | PASS | No subprocess spawning improves startup |
| MCP contract gate | VIOLATION | Gate itself is obsolete — replaced by diagnostics coverage verification |

## Project Structure

### Documentation (this feature)

```text
specs/002-diagnostics-integration/
├── plan.md
├── research.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── comment-controller.ts  # Existing — no changes
├── comment-store.ts        # Existing — no changes
├── diagnostics.ts          # NEW — publishes feedback as diagnostics
├── extension.ts            # MODIFIED — wire diagnostics, remove MCP provider
├── feedback-panel.ts       # Existing — no changes
├── gitignore-manager.ts    # Existing — no changes
├── range-tracker.ts        # Existing — no changes
├── types.ts                # Existing — no changes
└── mcp/
    └── server.ts           # DELETED

test/
└── unit/
    ├── comment-store.test.ts       # Existing — no changes
    ├── comment-controller.test.ts  # Existing — no changes
    ├── diagnostics.test.ts         # NEW — diagnostics unit tests
    ├── mcp-server.test.ts          # DELETED
    └── range-tracker.test.ts       # Existing — no changes
```

**Structure Decision**: Single project layout. One new file (`src/diagnostics.ts`), one deleted file (`src/mcp/server.ts`). Net file count decreases.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-|-|-|
| Remove MCP tools (Principle V) | MCP requires user to configure server definition — violates "zero-config on install" (Principle IV, Constitution §IV). Diagnostics achieve the same goal with zero setup | Keeping MCP alongside diagnostics adds complexity without value — agents that read diagnostics don't need MCP |
| Remove MCP contract gate | Gate references tools that no longer exist. Replaced by: "All feedback threads MUST appear as diagnostics with correct file, range, and message" | Keeping the gate for non-existent tools is meaningless |
