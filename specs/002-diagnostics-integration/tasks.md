# Tasks: Diagnostics Integration for Zero-Config AI Access

**Input**: Design documents from `/specs/002-diagnostics-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Included — the project already has unit tests and the constitution requires test coverage for all core logic.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 and tightly coupled (diagnostics must be Information severity by design), so they share a phase. US3 and US4 are P2 tasks in separate phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Dependency cleanup — remove MCP-related packages no longer needed

- [X] T001 Remove `@modelcontextprotocol/sdk` and `zod` from dependencies in package.json
- [X] T002 Remove `@types/diff-match-patch` check — confirm still needed (it is, for range-tracker)
- [X] T003 Run `npm install` to update node_modules and package-lock.json

**Checkpoint**: Dependencies cleaned. No MCP SDK or zod in node_modules.

---

## Phase 2: Foundational

**Purpose**: Create the diagnostics module that all user stories depend on

**⚠️ CRITICAL**: US1-US4 all depend on this module existing

- [X] T004 Create `src/diagnostics.ts` with `createDiagnosticCollection()` function that returns a `vscode.DiagnosticCollection` named "plan-feedback"
- [X] T005 Implement `refreshDiagnostics(collection, store, workspaceRoot)` function in `src/diagnostics.ts` that converts all FeedbackThreads to Diagnostic entries grouped by file URI
- [X] T006 Implement diagnostic message formatter in `src/diagnostics.ts` — format: `[Feedback] author (date): body\nOn: "selectedText"` with `---` separator between replies, `[ORPHANED]` prefix for orphaned threads
- [X] T007 Create `test/unit/diagnostics.test.ts` with tests for message formatting, diagnostic creation, severity (Information), source label ("Plan Feedback"), and orphaned thread handling

**Checkpoint**: Diagnostics module exists with tests. Not yet wired into extension.

---

## Phase 3: User Story 1 & 2 — Feedback Visible as Diagnostics, Distinct from Errors (Priority: P1) 🎯 MVP

**Goal**: Feedback threads appear in the Problems panel as Information-severity diagnostics with source "Plan Feedback". Users and AI agents can distinguish them from real errors.

**Independent Test**: Add a feedback comment → open Problems panel → verify feedback appears with "Plan Feedback" source and Information severity, visually distinct from any TypeScript/ESLint errors in the same file.

### Implementation

- [X] T008 [US1] Wire diagnostics into `src/extension.ts` — create DiagnosticCollection at activation, register in context.subscriptions, call refreshDiagnostics after store load
- [X] T009 [US1] Call refreshDiagnostics in `onStoreChange` callback in `src/extension.ts` so diagnostics update when threads are added/replied/resolved
- [X] T010 [US1] Call refreshDiagnostics in file watcher `onDidChange` handler in `src/extension.ts` so diagnostics update when store is reloaded from disk
- [X] T011 [US2] Call refreshDiagnostics from range-tracker callback in `src/extension.ts` so diagnostics update when ranges shift
- [X] T012 [US1] Verify diagnostics use DiagnosticSeverity.Information (not Warning/Error) in `src/diagnostics.ts`
- [X] T013 [US1] Add test in `test/unit/diagnostics.test.ts` verifying diagnostics have correct severity, source, range, and message for a simple single-comment thread
- [X] T014 [P] [US2] Add test in `test/unit/diagnostics.test.ts` verifying diagnostics are visually distinct — severity is Information, source is "Plan Feedback", not conflicting with error/warning sources

**Checkpoint**: Feedback appears in Problems panel. AI agents see feedback via get_diagnostics. Visually distinct from errors.

---

## Phase 4: User Story 3 — Rich Context for AI Agents (Priority: P2)

**Goal**: Diagnostic messages include enough context (selected text, author, all replies) for AI agents to act on feedback meaningfully.

**Independent Test**: Add a multi-reply feedback thread → inspect the diagnostic message → verify it contains comment body, author, selected text, and all replies in order.

### Implementation

- [X] T015 [US3] Ensure diagnostic message includes selected/anchor text with `On: "..."` line in `src/diagnostics.ts`
- [X] T016 [US3] Ensure diagnostic message includes all replies with `[Reply] author (date): body` format in `src/diagnostics.ts`
- [X] T017 [US3] Set diagnostic `code` property to thread UUID for programmatic identification in `src/diagnostics.ts`
- [X] T018 [P] [US3] Add test in `test/unit/diagnostics.test.ts` for multi-reply thread message format
- [X] T019 [P] [US3] Add test in `test/unit/diagnostics.test.ts` for orphaned thread message format with `[ORPHANED]` prefix

**Checkpoint**: AI agents receive rich, structured feedback context in diagnostic messages.

---

## Phase 5: User Story 4 — Remove MCP Server (Priority: P2)

**Goal**: All MCP-related code, configuration, and tests are removed. Extension activates without starting any external process.

**Independent Test**: Extension activates cleanly. No MCP server process. No MCP entries in package.json contributes.

### Implementation

- [X] T020 [US4] Delete `src/mcp/server.ts`
- [X] T021 [US4] Delete `test/unit/mcp-server.test.ts`
- [X] T022 [US4] Remove MCP provider registration block from `src/extension.ts` (the `lm.registerMcpServerDefinitionProvider` section)
- [X] T023 [US4] Remove `mcpServerDefinitionProviders` contribution from package.json
- [X] T024 [US4] Remove MCP-related imports from `src/extension.ts` (path to server.js)
- [X] T025 [US4] Remove `test:mcp` script from package.json scripts
- [X] T026 [US4] Delete `src/mcp/` directory if empty after server.ts removal

**Checkpoint**: No MCP code remains. Extension is self-contained.

---

## Phase 6: Polish & Validation

**Purpose**: Final verification, type checking, test execution, cleanup

- [X] T027 Run `npx tsc --noEmit` and fix any TypeScript errors
- [X] T028 Run `npm run lint` and fix any ESLint errors
- [X] T029 Run `npm run test:unit` and verify all tests pass (expect fewer tests — MCP tests removed, diagnostics tests added)
- [X] T030 Verify extension activates in Extension Development Host (F5) without errors
- [X] T031 Manual test: add feedback comment → verify it appears in Problems panel with "Plan Feedback" source
- [X] T032 Manual test: resolve feedback thread → verify diagnostic disappears from Problems panel
- [X] T033 Update README.md to remove MCP server references and document diagnostics-based approach

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — creates the diagnostics module
- **US1 & US2 (Phase 3)**: Depends on Phase 2 — wires diagnostics into extension
- **US3 (Phase 4)**: Depends on Phase 2 — enhances message format (can run parallel with Phase 3)
- **US4 (Phase 5)**: Independent — can run parallel with Phases 3-4 (different files)
- **Polish (Phase 6)**: Depends on all phases complete

### User Story Dependencies

- **US1 & US2 (P1)**: Depend on foundational diagnostics module. Tightly coupled — same severity/source config.
- **US3 (P2)**: Depends on foundational diagnostics module. Enhances message format — can run parallel with US1/US2.
- **US4 (P2)**: Fully independent — deletes files that other phases don't touch. Can run parallel with any phase.

### Parallel Opportunities

- T020-T026 (US4 MCP removal) can run parallel with T008-T014 (US1/US2 wiring)
- T015-T019 (US3 rich context) can run parallel with T008-T014 (US1/US2 wiring)
- T018 and T019 (US3 tests) can run parallel with each other
- T013 and T014 (US1/US2 tests) can run parallel with each other

---

## Parallel Example: Phase 3 + Phase 5

```bash
# These can run in parallel since they touch different files:

# Phase 3 (US1/US2): Wire diagnostics into extension
Task: "Wire diagnostics into src/extension.ts"

# Phase 5 (US4): Remove MCP server
Task: "Delete src/mcp/server.ts"
Task: "Delete test/unit/mcp-server.test.ts"
Task: "Remove MCP entries from package.json"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Phase 1: Remove unused dependencies
2. Phase 2: Create diagnostics module with tests
3. Phase 3: Wire into extension — feedback appears in Problems panel
4. **STOP and VALIDATE**: Add a comment, check Problems panel, verify AI agent sees it
5. If working: proceed to US3 (richer messages) and US4 (MCP cleanup)

### Full Delivery

1. Setup → Foundational → US1/US2 (MVP) → US3 (rich context) → US4 (MCP removal) → Polish
2. Each phase is a clean commit point
3. Total: 33 tasks, estimated net code reduction (MCP server + deps removed > diagnostics module added)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 share Phase 3 because they are both P1 and inseparable (severity + source are the same config)
- US4 (MCP removal) is independent and can be done at any time
- Commit after each phase or logical group
