# Feature Specification: Editor Feedback Extension

**Feature Branch**: `001-editor-feedback-ext`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "VSCode extension for inline editor feedback and comments readable by AI agents via MCP, similar to Antigravity's commentable artifacts experience"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Inline Feedback on Selected Text (Priority: P1)

A developer is reviewing a plan markdown file or code file in the editor. They select a section of text they want to provide feedback on, right-click (or use a keyboard shortcut), and choose "Add Feedback." A comment widget appears inline — similar to Google Docs or GitHub PR review — where they type their feedback. The comment is saved automatically and displayed as a visual indicator (gutter icon + highlight) on the relevant lines.

**Why this priority**: This is the core interaction. Without the ability to easily add comments on selected text, the extension has no value. This delivers the fundamental Antigravity-style experience of commenting directly on artifacts.

**Independent Test**: Can be fully tested by opening any file, selecting text, adding a comment, and verifying it appears with a visual indicator. Delivers immediate value as a personal annotation tool.

**Acceptance Scenarios**:

1. **Given** any file is open in the editor, **When** the user selects a range of text and invokes the "Add Feedback" command, **Then** an inline comment widget appears anchored to that selection.
2. **Given** the comment widget is open, **When** the user types feedback and confirms, **Then** the comment is saved, a gutter icon appears on those lines, and the selected text is visually highlighted.
3. **Given** a file has existing feedback comments, **When** the user reopens the file, **Then** all previously saved comments are restored and displayed in their original positions.
4. **Given** the user clicks a gutter icon, **When** the comment thread is displayed, **Then** the user can read, reply to, edit, or delete the comment.

---

### User Story 2 - AI Agent Reads User Feedback (Priority: P1)

A developer has added several feedback comments across their codebase — marking areas that need refactoring, noting bugs, or providing direction on a plan file. They then start an AI coding session (using Claude in agent mode, Copilot, or Codex). The AI agent automatically discovers the feedback through an exposed tool and incorporates it into its work — addressing the user's specific concerns without the user having to re-explain anything in chat.

**Why this priority**: This is the second half of the core value proposition. The feedback loop between human comments and AI consumption is what makes this extension fundamentally different from a simple annotation tool. Without AI readability, this is just another comment extension.

**Independent Test**: Can be tested by adding comments to a file, then invoking the feedback tool from an AI agent and verifying structured comment data is returned with correct file paths, ranges, and comment text.

**Acceptance Scenarios**:

1. **Given** the user has added feedback comments to files in the workspace, **When** an AI agent queries available feedback, **Then** it receives a structured list of all open comments with file paths, line ranges, selected text snippets, and comment body.
2. **Given** an AI agent queries feedback for a specific file, **When** feedback exists on that file, **Then** only comments for that file are returned, ordered by position.
3. **Given** the AI agent has addressed a feedback comment, **When** it marks the comment as resolved, **Then** the comment and all its visual indicators (gutter icon, highlight) are completely removed from the editor.

---

### User Story 3 - Reply and Threaded Conversations (Priority: P2)

A developer adds feedback on a code section. Later, they (or a collaborator) want to add follow-up context or a response to the original comment. They click the comment's gutter icon, see the existing comment, and add a reply. This creates a threaded conversation anchored to the same code range, similar to GitHub PR review threads.

**Why this priority**: Threaded replies enable richer feedback that gives AI agents more context. However, the core value (single comments readable by AI) works without threading.

**Independent Test**: Can be tested by adding a comment, then adding a reply, and verifying both appear in the thread and are accessible via the AI feedback tool.

**Acceptance Scenarios**:

1. **Given** a comment exists on a code range, **When** the user opens the comment thread and adds a reply, **Then** the reply appears below the original comment in chronological order.
2. **Given** a thread has multiple replies, **When** an AI agent queries feedback, **Then** the thread is returned as a single feedback item with all replies included.

---

### User Story 4 - Feedback Overview Panel (Priority: P2)

A developer has scattered feedback across many files. They want a quick overview of all pending feedback in the workspace. They open a sidebar panel that shows all open feedback comments grouped by file, with the ability to click any item to navigate directly to the commented code.

**Why this priority**: Important for managing feedback at scale, but the core commenting and AI-reading flows work without a centralized view.

**Independent Test**: Can be tested by adding comments to multiple files, opening the panel, and verifying all comments appear grouped by file with working navigation.

**Acceptance Scenarios**:

1. **Given** feedback comments exist across multiple files, **When** the user opens the Feedback Panel, **Then** all open comments are listed grouped by file with preview text.
2. **Given** the user clicks a feedback item in the panel, **When** the navigation occurs, **Then** the editor opens the file and scrolls to the exact range of the comment.

---

### User Story 5 - Feedback Survives Code Edits (Priority: P3)

A developer adds feedback on lines 15-22 of a file. They then edit the file — adding lines above, modifying the commented section, or reformatting. When they save, the feedback comment should remain anchored to the correct (updated) location, or gracefully indicate if the original text has changed beyond recognition.

**Why this priority**: Critical for long-lived feedback, but for short feedback cycles (add comment → AI addresses it → resolve) the impact of code drift is minimal.

**Independent Test**: Can be tested by adding a comment, editing lines above the comment, and verifying the comment moves to the correct new position.

**Acceptance Scenarios**:

1. **Given** a comment is anchored to lines 15-22, **When** the user adds 5 new lines above line 15, **Then** the comment automatically moves to lines 20-27.
2. **Given** a comment's anchored text is completely deleted, **When** the file is saved, **Then** the comment is marked as "orphaned" with a visual indicator and the original text is preserved for reference.

---

### Edge Cases

- What happens when feedback is added to a file that is then deleted? The feedback is preserved in storage and shown as "file deleted" in the overview panel.
- How does the system handle feedback on unsaved/untitled files? Feedback is only supported on saved files with a file path.
- What happens when two comments overlap on the same text range? Both comments are shown as separate threads, each with their own gutter icon.
- How does the system handle very large files with hundreds of feedback comments? Comments are loaded lazily and the overview panel uses pagination.
- What happens if the workspace feedback storage file becomes corrupted? The extension creates automatic backups before each write and can recover from the most recent valid backup.
- What happens when multiple VSCode windows edit feedback on the same workspace? Last-write-wins — no locking or conflict resolution. The most recent save overwrites previous state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST allow users to select any text range in the editor and create a feedback comment anchored to that range.
- **FR-002**: The extension MUST persist all feedback comments to workspace-local storage so they survive editor restarts.
- **FR-003**: The extension MUST display visual indicators (gutter icons and text highlights) for all active feedback comments.
- **FR-004**: The extension MUST expose all feedback comments exclusively through MCP server tools that AI agents discover and invoke in agent mode. No diagnostics mirroring or file-based alternative channels.
- **FR-005**: The tool interface MUST return structured data including: file path, line range, selected text snippet, comment body, author, orphaned flag, and timestamp.
- **FR-006**: The extension MUST support querying feedback for the entire workspace or filtered by specific file.
- **FR-007**: The extension MUST allow AI agents to mark feedback as resolved through the tool interface.
- **FR-008**: The extension MUST support reply threads on existing feedback comments.
- **FR-009**: The extension MUST provide a sidebar panel listing all feedback comments grouped by file.
- **FR-010**: The extension MUST navigate to the exact code range when a user clicks a feedback item in the overview panel.
- **FR-011**: The extension MUST track code edits and update comment ranges accordingly to prevent drift.
- **FR-012**: The extension MUST support both code files and markdown plan files equally.
- **FR-013**: The extension MUST allow users to edit and delete their own feedback comments.
- **FR-014**: The extension MUST provide keyboard shortcuts for adding feedback (in addition to context menu and command palette access).
- **FR-015**: The extension MUST support resolving feedback comments, which completely removes them from the editor UI (no visual trace remains). Resolved comments are deleted from storage.
- **FR-016**: The extension MUST add the feedback storage file to `.gitignore` by default on first use, keeping feedback private and local.

### Key Entities

- **Feedback Comment**: A user-authored annotation anchored to a specific text range in a file. Key attributes: unique identifier, file path, text range (start/end line and character), selected text snippet, comment body (plain text, no categories — AI infers intent), author, creation timestamp. Resolving a comment deletes it entirely — there is no resolved state, only existence or removal.
- **Feedback Thread**: A collection of related comments (original + replies) anchored to the same text range. Key attributes: thread identifier, parent comment, ordered list of replies.
- **Feedback Store**: The workspace-level collection of all feedback comments. Key attributes: version number for format migration, list of all feedback threads, last backup timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a feedback comment on selected text within 3 seconds (select → comment → confirm).
- **SC-002**: AI agents can retrieve all workspace feedback within 1 second of invoking the tool.
- **SC-003**: 95% of feedback comments survive code edits (insertions/deletions above the comment) without losing their anchor position.
- **SC-004**: Users can navigate from the overview panel to any feedback comment's source location in under 1 second.
- **SC-005**: The extension adds less than 200ms to editor startup time for workspaces with up to 500 feedback comments.
- **SC-006**: Users can complete the full feedback cycle (add comment → AI reads it → AI resolves it) without leaving the editor or switching to a chat interface.
- **SC-007**: 90% of first-time users can successfully add their first feedback comment without reading documentation (intuitive UX).

## Clarifications

### Session 2026-02-23

- Q: Should feedback comments support predefined categories (bug, suggestion, question, direction) or be plain text? → A: No categories — comments are plain text only. AI agents infer intent from the comment content.
- Q: Should the feedback storage file be committed to git or gitignored? → A: Gitignored by default — feedback is private and local. Users can opt-in to sharing by removing from .gitignore.
- Q: What happens to resolved comments? → A: Resolved comments become completely invisible — removed from the UI without a trace. No toggle, no history. Simplicity over completeness.
- Q: Should AI agents access feedback via MCP only, or also via diagnostics/file-based channels? → A: MCP tools only. No diagnostics mirroring, no file-based summaries. Clean single-channel architecture.
- Q: How should concurrent access from multiple VSCode windows be handled? → A: Last-write-wins — no locking. Most recent save overwrites. Simple approach for a rare edge case.

## Assumptions

- The extension targets VSCode and VSCode-compatible editors (Cursor, Windsurf, etc.) that support the Extensions API.
- AI agent consumption is enabled through the MCP (Model Context Protocol) server capability built into modern VSCode agent modes.
- Feedback is workspace-scoped (not shared across teams or synced to a remote server) — this is a local developer workflow tool. The storage file is gitignored by default to keep feedback private.
- The primary use case is short-lived feedback cycles: developer adds comments → AI addresses them → developer resolves. Long-lived annotation is a secondary use case.
- The extension uses VSCode's native Comments API for the user interface, providing a familiar Google Docs-like experience without custom UI.
