# Tasks: Editor Feedback Extension

**Input**: Design documents from `/specs/001-editor-feedback-ext/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/mcp-tools.md

**Tests**: Included per Constitution v1.0.0 Principle II (Testing Standards — non-negotiable).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Project initialization, dependencies, tooling configuration

- [X] T001 Initialize TypeScript project with `package.json`, `tsconfig.json` (strict: true), and VSCode extension manifest `package.json` targeting engine `^1.99.0`
- [X] T002 [P] Install dependencies: `@types/vscode`, `@modelcontextprotocol/sdk`, `diff-match-patch`, `@types/diff-match-patch`, `zod`, `uuid`, `@types/uuid`
- [X] T003 [P] Install dev dependencies: `@vscode/test-electron`, `@vscode/vsce`, `mocha`, `@types/mocha`, `typescript`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
- [X] T004 [P] Configure ESLint with TypeScript-recommended rules in `.eslintrc.json`
- [X] T005 [P] Create project directory structure: `src/`, `src/mcp/`, `test/unit/`, `test/integration/`, `resources/`
- [X] T006 Configure `package.json` scripts: `compile`, `watch`, `lint`, `test`, `test:integration`, `test:mcp`, `package`
- [X] T007 Configure `.vscodeignore` to exclude test files, source maps, and dev configs from packaged extension

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data types and persistence layer that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Define TypeScript interfaces for FeedbackComment, FeedbackThread, Range, and FeedbackStore in `src/types.ts` per data-model.md
- [X] T009 Implement FeedbackStore read/write/backup logic in `src/comment-store.ts` — JSON persistence to `.vscode/plan-feedback.json` with atomic write (write to temp, rename)
- [X] T010 [P] Implement validation functions in `src/comment-store.ts` for all data-model.md rules (UUID format, non-empty body, valid range, comments array non-empty)
- [X] T011 [P] Implement gitignore auto-management in `src/gitignore-manager.ts` — check if `.vscode/plan-feedback.json` is in `.gitignore`, add it if missing (FR-016)
- [X] T012 [P] Write unit tests for comment-store in `test/unit/comment-store.test.ts` — cover: create store, add thread, delete thread, read/write JSON, backup creation, validation errors, empty store

**Checkpoint**: Data model types defined, persistence layer working with tests passing

---

## Phase 3: User Story 1 — Add Inline Feedback on Selected Text (P1) MVP

**Goal**: Users can select text, add a feedback comment, and see it persisted with visual indicators across editor restarts

**Independent Test**: Open any file → select text → right-click "Add Feedback" → type comment → confirm → gutter icon and highlight appear → close and reopen file → comment restored

### Tests for User Story 1

- [X] T013 [P] [US1] Write unit test for CommentController thread creation in `test/unit/comment-controller.test.ts` — verify thread created with correct range, comment body stored, gutter decoration applied
- [ ] T014 [P] [US1] Write integration test for extension activation and comment lifecycle in `test/integration/extension.test.ts` — activate extension, create comment, verify persistence, reload and verify restoration

### Implementation for User Story 1

- [X] T015 [US1] Implement CommentController setup in `src/comment-controller.ts` — create controller with `commentingRangeProvider` returning full document range, register disposables
- [X] T016 [US1] Implement "Add Feedback" command handler in `src/comment-controller.ts` — create thread at selected range, capture selectedText + contextBefore/contextAfter + contentHash, save to store
- [X] T017 [US1] Implement comment edit and delete handlers in `src/comment-controller.ts` — update comment body in store on edit, remove thread from store on delete (FR-013)
- [X] T018 [US1] Implement text range highlighting via TextEditorDecorationType in `src/comment-controller.ts` — yellow background highlight on commented ranges, refresh on document open (FR-003)
- [X] T019 [US1] Implement comment restoration on file open in `src/comment-controller.ts` — listen to `onDidOpenTextDocument`, recreate CommentThreads from store for that file
- [X] T020 [US1] Wire extension entry point in `src/extension.ts` — activate CommentController, register commands (`plan-feedback.addFeedback`, `plan-feedback.deleteThread`, `plan-feedback.editComment`), push to subscriptions
- [X] T021 [US1] Register context menu and keybinding contributions in `package.json` — "Add Feedback" in `editor/context` menu with `when: editorTextFocus`, keyboard shortcut `Ctrl+Alt+F` / `Cmd+Alt+F` (FR-014)
- [X] T022 [US1] Implement resolve command in `src/comment-controller.ts` — delete thread from store, dispose CommentThread, remove decorations. No visual trace remains (FR-015)

**Checkpoint**: User Story 1 fully functional — select text, add comment, persist, restore, edit, delete, resolve. Tests pass.

---

## Phase 4: User Story 2 — AI Agent Reads User Feedback (P1)

**Goal**: AI agents discover feedback tools via MCP and can query/resolve comments programmatically

**Independent Test**: Add comments via US1 → start AI agent session → agent invokes `get_feedback` tool → receives structured JSON with file paths, ranges, comment bodies → agent invokes `resolve_feedback` → comment removed from editor

### Tests for User Story 2

- [X] T023 [P] [US2] Write unit tests for MCP server tools in `test/unit/mcp-server.test.ts` — cover: `get_feedback` (all, by file, empty), `resolve_feedback` (valid ID, invalid ID), `get_feedback_summary` (counts, file grouping)
- [X] T024 [P] [US2] Write MCP integration test in `test/unit/mcp-server.test.ts` — spawn server process via stdio, send JSON-RPC requests, verify response shapes match contracts/mcp-tools.md

### Implementation for User Story 2

- [X] T025 [US2] Implement MCP server entry point in `src/mcp/server.ts` — initialize McpServer with StdioServerTransport, register tool handlers, read `.vscode/plan-feedback.json` from workspace root
- [X] T026 [US2] Implement `get_feedback` tool in `src/mcp/server.ts` — optional `filePath` parameter, return FeedbackResult[] per contract, order by file path then line number (FR-004, FR-005, FR-006)
- [X] T027 [US2] Implement `resolve_feedback` tool in `src/mcp/server.ts` — accept `threadId`, delete thread from store JSON, return success/failure per contract (FR-007)
- [X] T028 [US2] Implement `get_feedback_summary` tool in `src/mcp/server.ts` — aggregate counts, group by file, count orphaned threads per contract
- [X] T029 [US2] Implement MCP error handling in `src/mcp/server.ts` — store not found, corrupted file with backup recovery, invalid thread ID format per contract error spec
- [X] T030 [US2] Register MCP server definition provider in `src/extension.ts` — `vscode.lm.registerMcpServerDefinitionProvider` returning McpStdioServerDefinition pointing to `dist/mcp/server.js`
- [X] T031 [US2] Add `mcpServerDefinitionProviders` contribution point to `package.json` — id: `plan-feedback-mcp`, label: `Plan Feedback`
- [X] T032 [US2] Implement file watcher in `src/extension.ts` — watch `.vscode/plan-feedback.json` for external changes (MCP server writes resolve), reload in-memory store and refresh CommentThreads/decorations

**Checkpoint**: Full feedback cycle works — add comment (US1) → AI reads via MCP → AI resolves → comment disappears from editor. Tests pass.

---

## Phase 5: User Story 3 — Reply and Threaded Conversations (P2)

**Goal**: Users can add replies to existing feedback comments, creating threaded conversations visible to AI agents

**Independent Test**: Add a comment → click gutter icon → add reply → verify reply appears in thread → query via MCP → verify thread includes all replies ordered chronologically

### Tests for User Story 3

- [ ] T033 [P] [US3] Write acceptance test for reply flow in `test/integration/extension.test.ts` — create comment, add reply, verify reply appears in thread chronologically, query via MCP and verify thread includes all replies (covered in mcp-server.test.ts)

### Implementation for User Story 3

- [X] T034 [US3] Implement reply command handler in `src/comment-controller.ts` — register `plan-feedback.reply` command, append FeedbackComment to thread's comments array in store, update CommentThread UI
- [X] T035 [US3] Register reply command in `package.json` `comments/commentThread/context` menu — inline group, when `commentController == plan-feedback`
- [X] T036 [US3] Verify MCP `get_feedback` tool returns full thread with replies — no code changes expected (comments array already serialized), add test case to `test/unit/mcp-server.test.ts` confirming multi-comment threads

**Checkpoint**: Threaded replies work end-to-end. MCP returns complete threads. Tests pass.

---

## Phase 6: User Story 4 — Feedback Overview Panel (P2)

**Goal**: Sidebar TreeView shows all feedback grouped by file with click-to-navigate

**Independent Test**: Add comments to 3 different files → open Feedback Panel → see all comments grouped → click item → editor opens file at exact range

### Tests for User Story 4

- [ ] T037 [P] [US4] Write acceptance test for feedback panel in `test/integration/extension.test.ts` — add comments to 3 files, open panel, verify items grouped by file, click item and verify editor navigates to correct range (requires extension host)

### Implementation for User Story 4

- [X] T038 [US4] Implement TreeDataProvider in `src/feedback-panel.ts` — two-level tree: file nodes (with comment count badge) → thread nodes (preview of first comment body, line number)
- [X] T039 [US4] Implement click-to-navigate in `src/feedback-panel.ts` — on tree item click, call `vscode.window.showTextDocument(uri)` then `editor.revealRange(range, RevealType.InCenter)` (FR-009, FR-010)
- [X] T040 [US4] Register TreeView in `src/extension.ts` — `vscode.window.createTreeView('planFeedbackPanel', { treeDataProvider })`, add `viewsContainers` and `views` contributions to `package.json`
- [X] T041 [US4] Implement panel refresh on store changes in `src/feedback-panel.ts` — listen to store change events, call `treeDataProvider.refresh()` to update counts and items
- [X] T042 [US4] Add panel icon resource in `resources/feedback-icon.svg` and reference in `package.json` viewsContainers contribution

**Checkpoint**: Overview panel shows all feedback, grouped by file, click navigates to source. Refreshes on comment add/delete. Tests pass.

---

## Phase 7: User Story 5 — Feedback Survives Code Edits (P3)

**Goal**: Comment ranges update correctly when surrounding code changes; orphaned comments are detected when anchored text is deleted

**Independent Test**: Add comment on lines 15-22 → insert 5 lines above → comment moves to lines 20-27 → delete anchored text → comment marked orphaned

### Tests for User Story 5

- [X] T043 [P] [US5] Write unit tests for range-tracker in `test/unit/range-tracker.test.ts` — cover: line insertion above (range shifts down), line deletion above (range shifts up), edit within range (no shift), overlapping edit (flag for re-anchor), complete deletion (orphan detection), fuzzy re-anchoring with text snippet
- [ ] T044 [P] [US5] Write acceptance test for range survival in `test/integration/extension.test.ts` — add comment on lines 15-22, insert 5 lines above, verify comment moved to 20-27, delete anchored text, verify orphaned state (requires extension host)

### Implementation for User Story 5

- [X] T045 [US5] Implement delta computation in `src/range-tracker.ts` — listen to `onDidChangeTextDocument`, compute `lineDelta` from contentChanges (process in reverse document order), shift all tracked thread ranges
- [X] T046 [US5] Implement fuzzy re-anchoring in `src/range-tracker.ts` — when range overlaps with edit, use `diff-match-patch` Bitap algorithm on stored `selectedText` + `contextBefore`/`contextAfter` to relocate, threshold 0.5
- [X] T047 [US5] Implement orphan detection in `src/range-tracker.ts` — when anchored range fully deleted AND fuzzy score < 0.5, mark thread as orphaned in store, preserve original selectedText for reference
- [X] T048 [US5] Implement orphan visual indicator in `src/comment-controller.ts` — dimmed decoration style for orphaned threads, show original text in comment body as reference
- [X] T049 [US5] Wire range-tracker into extension lifecycle in `src/extension.ts` — initialize on activation, pass store reference, register document change listener
- [X] T050 [US5] Persist range updates to store on document save in `src/range-tracker.ts` — batch range shifts and write to store once per save event (not per keystroke) for performance

**Checkpoint**: Comments survive code edits. Orphaned comments detected and displayed. Fuzzy re-anchoring works for moderate refactors. Tests pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, bundle optimization, documentation

- [X] T051 [P] Run all quality gates: `npm run compile` (zero warnings), `npm run lint` (zero errors), `npm test` (all pass)
- [X] T052 [P] Verify extension bundle size under 500KB via `npx @vscode/vsce ls` — dist/ is 240KB total (tests excluded by .vscodeignore), well under limit
- [X] T053 [P] Write README.md with: installation instructions, usage guide (screenshots of comment flow), MCP tool documentation for AI agents, keyboard shortcuts
- [ ] T054 Verify full feedback cycle end-to-end: add comment → AI reads via MCP → AI resolves → comment removed → no visual trace (requires running VSCode extension host)
- [ ] T055 Run quickstart.md validation — follow all steps in `specs/001-editor-feedback-ext/quickstart.md` and verify they work (requires running VSCode extension host)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — core MVP
- **US2 (Phase 4)**: Depends on US1 (needs stored feedback to query via MCP)
- **US3 (Phase 5)**: Depends on US1 (needs existing comment threads for replies)
- **US4 (Phase 6)**: Depends on US1 (needs stored feedback for panel display)
- **US5 (Phase 7)**: Depends on US1 (needs comment ranges to track)
- **Polish (Phase 8)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Blocked by Foundational only — MVP milestone
- **US2 (P1)**: Blocked by US1 — completes core value proposition
- **US3 (P2)**: Blocked by US1 — can run parallel with US2, US4
- **US4 (P2)**: Blocked by US1 — can run parallel with US2, US3
- **US5 (P3)**: Blocked by US1 — can run parallel with US2, US3, US4

### Within Each User Story

- Tests written before implementation (Constitution Principle II)
- Types/models before services
- Services before UI/commands
- Core implementation before integration wiring

### Parallel Opportunities

- T002, T003, T004, T005 can all run in parallel (Setup phase)
- T010, T011, T012 can all run in parallel (Foundational phase)
- T013, T014 can run in parallel (US1 tests)
- T023, T024 can run in parallel (US2 tests)
- After US1 completes: US3, US4, US5 can all start in parallel

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 — Add Inline Feedback
4. **STOP and VALIDATE**: Test US1 independently — select text, add comment, persist, restore
5. Deploy/demo as personal annotation tool

### Core Value (US1 + US2)

1. Complete MVP (above)
2. Complete Phase 4: US2 — AI Agent Reads Feedback
3. **STOP and VALIDATE**: Full feedback cycle — add comment → AI reads → AI resolves
4. This is the primary differentiator from plain annotation tools

### Full Feature Set

1. Complete Core Value (above)
2. Complete Phase 5, 6, 7 in parallel: US3 (replies), US4 (panel), US5 (range tracking)
3. Complete Phase 8: Polish
4. Package and publish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- MCP server (`src/mcp/server.ts`) is a separate entry point — built as a standalone Node process
- Store file (`.vscode/plan-feedback.json`) is the bridge between extension and MCP server processes
- Resolve = delete (no resolved state, per clarification session)
- Constitution Principle IV (Simplicity): no abstractions beyond what each task requires
