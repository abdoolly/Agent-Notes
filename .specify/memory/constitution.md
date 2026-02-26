<!--
  Sync Impact Report
  Version change: 0.0.0 (template) → 1.0.0
  Modified principles: None (initial creation)
  Added sections: Core Principles (5), Quality Gates, Development Workflow, Governance
  Removed sections: All template placeholders replaced
  Templates requiring updates:
    - .specify/templates/plan-template.md: ✅ Compatible (Constitution Check section exists)
    - .specify/templates/spec-template.md: ✅ Compatible (User Stories require independent testability)
    - .specify/templates/tasks-template.md: ✅ Compatible (test-first ordering supported)
  Follow-up TODOs: None
-->

# Plan Feedback Extension Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

Every source file MUST pass strict TypeScript compilation with zero errors and zero warnings.

- TypeScript `strict: true` MUST be enabled with no escape hatches (`// @ts-ignore`, `as any`)
- Every module MUST have a single, clearly stated responsibility — if a module description requires "and", it MUST be split
- Functions MUST be under 40 lines; files MUST be under 300 lines. Violations require explicit justification in the PR description
- No `any` type usage. Use `unknown` with type guards when the type is genuinely dynamic
- All public functions MUST have JSDoc describing purpose and parameters. Internal helpers do not require JSDoc
- Dead code MUST be deleted, never commented out

### II. Testing Standards

Tests MUST exist for all core logic and all public interfaces. Test absence blocks merge.

- Unit tests MUST cover: `comment-store.ts` (persistence logic), `range-tracker.ts` (delta computation, fuzzy matching), `mcp/server.ts` (tool input/output contracts)
- Integration tests MUST cover: extension activation, comment creation through CommentController, MCP tool invocation via stdio
- Tests MUST be deterministic — no timing dependencies, no real filesystem writes (use in-memory fixtures)
- Test names MUST follow the pattern: `"[unit under test] [condition] [expected result]"` (e.g., `"rangeTracker shifts range down when lines inserted above"`)
- Each user story MUST have at least one end-to-end acceptance test validating the Given/When/Then scenario from the spec
- Test failures MUST block all merges. No skipping, no `xit`, no `test.skip` in committed code

### III. User Experience First

Every feature decision MUST be evaluated from the user's perspective before the developer's convenience.

- The feedback creation flow (select text → add comment → confirm) MUST complete in 3 interactions or fewer
- All commands MUST be accessible through at least two entry points: keyboard shortcut and context menu
- Visual feedback MUST be immediate — the user MUST see the result of their action within 200ms
- Error states MUST show actionable messages ("Feedback file could not be read — try reloading the window") not technical details ("ENOENT: no such file")
- Features that add friction to the core feedback loop (select → comment → AI reads → resolve) MUST be rejected regardless of technical elegance
- The extension MUST work silently — no notifications, toasts, or popups unless the user explicitly triggers an action or an error requires attention

### IV. Simplicity

Prefer the simplest solution that satisfies the spec. Every abstraction MUST justify its existence.

- No abstraction layers beyond what the current feature requires — no base classes, generic factories, or plugin systems
- Data flows MUST be traceable in a single read: file → function → output, with no hidden side effects
- Configuration MUST have sensible defaults that work without user setup. Zero-config on install is the target
- When choosing between a 10-line concrete solution and a 30-line extensible one, choose the 10-line version
- Dependencies MUST be audited: each npm package MUST be justified by a comment in `package.json` or removed
- File count MUST stay minimal — do not create utility files, helper modules, or shared constants unless three or more consumers exist

### V. API Contract Stability

MCP tools are the public interface consumed by AI agents. Changes MUST be backward-compatible.

- MCP tool names (`get_feedback`, `resolve_feedback`, `get_feedback_summary`) MUST NOT be renamed without a major version bump
- Tool input schemas MUST only add optional parameters; required parameters MUST NOT be added to existing tools
- Tool output shapes MUST be additive — new fields can be added, existing fields MUST NOT be removed or have their types changed
- The storage file schema (`version` field in `.vscode/plan-feedback.json`) MUST include migration logic when the format changes
- Breaking changes to tool behavior MUST be documented in CHANGELOG.md with migration instructions

## Quality Gates

Gates that MUST pass before code is merged or released.

- **Compile gate**: `npm run compile` exits 0 with zero warnings
- **Lint gate**: ESLint with TypeScript-recommended rules exits 0
- **Test gate**: `npm test` passes all unit and integration tests with exit 0
- **Size gate**: Extension bundle MUST be under 500KB (excluding node_modules). Measured via `vsce ls`
- **Startup gate**: Extension activation MUST complete in under 200ms with 500 stored comments (measured in integration test)
- **MCP contract gate**: All three MCP tools MUST return valid JSON matching the contract schemas defined in `contracts/mcp-tools.md`

## Development Workflow

Standard workflow for all changes to this project.

- Every change MUST be on a feature branch — direct commits to `main` are prohibited
- Commits MUST be atomic: one logical change per commit, tests included in the same commit as the code they test
- PR descriptions MUST reference which spec requirements (FR-xxx) or user stories (US-x) the change addresses
- Code review MUST verify constitution compliance before approving
- The `main` branch MUST always be in a releasable state — green CI, passing all quality gates

## Governance

This constitution supersedes all other development practices for this project.

- All PRs and code reviews MUST verify compliance with these principles
- Complexity beyond what the constitution allows MUST be justified in writing (PR description or Complexity Tracking table in plan.md)
- Amendments require: (1) documented rationale, (2) version bump per semver rules below, (3) propagation to dependent templates
- Version policy: MAJOR = principle removal or redefinition; MINOR = new principle or section; PATCH = clarification or wording fix
- Constitution violations discovered post-merge MUST be filed as high-priority issues and resolved before new feature work

**Version**: 1.0.0 | **Ratified**: 2026-02-23 | **Last Amended**: 2026-02-23
