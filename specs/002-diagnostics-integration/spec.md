# Feature Specification: Diagnostics Integration for Zero-Config AI Access

**Feature Branch**: `002-diagnostics-integration`
**Created**: 2026-02-23
**Status**: Draft
**Input**: User description: "Replace MCP server with VSCode Diagnostics API so feedback comments are automatically visible to AI agents (Claude, Codex, Copilot) without any additional setup. Install the extension and it just works."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Feedback Visible to AI Agents via Diagnostics (Priority: P1)

A user installs the Plan Feedback extension and adds feedback comments on code or plan files. When an AI agent (Claude Code, Codex, GitHub Copilot) queries the workspace for diagnostics, the feedback comments appear automatically — no MCP server setup, no configuration files, no additional steps.

**Why this priority**: This is the core value proposition. The current MCP-based approach requires users to configure an MCP server definition, which adds friction and prevents immediate use. Diagnostics are already read by all major AI agents out of the box.

**Independent Test**: Can be fully tested by adding a feedback comment to any file and verifying it appears in the Problems panel and is returned when an AI agent requests diagnostic information.

**Acceptance Scenarios**:

1. **Given** a user has installed the extension and added a feedback comment on line 10 of a file, **When** an AI agent queries diagnostics for the workspace, **Then** the feedback comment text, file path, and line number are included in the diagnostic results.
2. **Given** a user has multiple feedback threads across different files, **When** an AI agent queries diagnostics, **Then** all feedback comments across all files are returned with correct file and line information.
3. **Given** a user has no feedback comments, **When** an AI agent queries diagnostics, **Then** no feedback-related diagnostics are returned (no noise).

---

### User Story 2 - Diagnostics Distinguish Feedback from Real Errors (Priority: P1)

Feedback comments must be visually and semantically distinct from actual code errors, warnings, and lint issues. Users must be able to tell at a glance which diagnostics are feedback and which are real problems.

**Why this priority**: If feedback comments look like errors, users will be confused or alarmed. Clear distinction is essential for usability.

**Independent Test**: Can be tested by adding a feedback comment alongside a real syntax error and verifying they are visually distinct in the Problems panel and in editor gutter indicators.

**Acceptance Scenarios**:

1. **Given** a file has both a real syntax error and a feedback comment, **When** the user views the Problems panel, **Then** the feedback comment is clearly labeled as feedback (not an error or warning) and uses a distinct severity level.
2. **Given** a file has feedback comments, **When** the user views the editor, **Then** the feedback indicators are visually different from error/warning squiggles.

---

### User Story 3 - AI Agent Can Identify Feedback Context (Priority: P2)

When an AI agent reads the diagnostic information, the message content must include enough context for the agent to understand what the feedback is about — including the original selected text, the comment body, and the author.

**Why this priority**: Without structured context, the AI agent cannot meaningfully act on feedback. This enhances the quality of AI responses but the basic visibility (US1) works without it.

**Independent Test**: Can be tested by adding a feedback comment and inspecting the diagnostic message content to verify it contains the comment body, author, and selected text reference.

**Acceptance Scenarios**:

1. **Given** a feedback thread with the comment "This function needs error handling" on selected text `function processData()`, **When** the AI agent reads the diagnostic, **Then** the diagnostic message contains both the comment text and a reference to the selected code.
2. **Given** a feedback thread with multiple replies, **When** the AI agent reads the diagnostic, **Then** all replies in the thread are included in the diagnostic message.

---

### User Story 4 - Remove MCP Server Dependency (Priority: P2)

The extension no longer requires or registers an MCP server. All MCP-related code, configuration, and setup instructions are removed. The extension works entirely through native VSCode APIs.

**Why this priority**: Removing the MCP dependency simplifies the extension, reduces maintenance surface, and eliminates user confusion about setup. However, this is a cleanup task — the diagnostics integration (US1) provides the actual value.

**Independent Test**: Can be tested by verifying the extension activates successfully without any MCP server process, and no MCP-related entries appear in the extension's configuration or output.

**Acceptance Scenarios**:

1. **Given** a fresh installation of the extension, **When** the extension activates, **Then** no MCP server process is started and no MCP-related configuration is required.
2. **Given** a user previously used the MCP-based version, **When** they update to this version, **Then** the extension works without any migration steps.

---

### Edge Cases

- What happens when a feedback thread is orphaned (code was edited and the anchor text moved)? Orphaned feedback should still appear as a diagnostic but be marked as orphaned in the message.
- What happens when a feedback thread is resolved? The corresponding diagnostic must be removed immediately.
- What happens when the diagnostics collection conflicts with another extension's diagnostics for the same file? Feedback diagnostics use a unique source identifier to prevent collisions.
- What happens when a file with feedback comments is closed? Diagnostics should persist for the file regardless of whether it is open.
- What happens when feedback is added or removed? Diagnostics should update in real time without requiring a file save or reload.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST publish each feedback thread as a diagnostic entry associated with the correct file and line range.
- **FR-002**: System MUST use a non-error severity level (Information or Hint) so feedback does not appear as a code error.
- **FR-003**: System MUST include a distinct source label (e.g., "Plan Feedback") in each diagnostic so users and agents can identify feedback items.
- **FR-004**: Each diagnostic message MUST contain the comment body, author, and timestamp.
- **FR-005**: For threads with multiple replies, the diagnostic message MUST include all replies in chronological order.
- **FR-006**: System MUST include the original selected/anchor text in the diagnostic message for AI agent context.
- **FR-007**: System MUST update diagnostics in real time when feedback threads are added, replied to, resolved, or when ranges shift due to code edits.
- **FR-008**: System MUST remove all MCP server code, MCP provider registration, and MCP-related package.json contributions.
- **FR-009**: Orphaned feedback threads MUST still appear as diagnostics but include an orphaned indicator in the message.
- **FR-010**: System MUST clear diagnostics for a thread immediately when it is resolved/deleted.

### Key Entities

- **Feedback Diagnostic**: A diagnostic entry representing a feedback thread, containing the comment text, author, line range, and source label. One diagnostic per thread per file.
- **Diagnostic Collection**: A single shared diagnostic collection owned by the extension, identified by source label "Plan Feedback".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can install the extension and have feedback comments visible to AI agents within 1 minute, with zero configuration steps.
- **SC-002**: 100% of feedback threads appear as diagnostics in the Problems panel with correct file and line information.
- **SC-003**: AI agents can distinguish feedback diagnostics from real code errors by source label in 100% of cases.
- **SC-004**: Diagnostics update within 500ms of a feedback thread being added, replied to, or resolved.
- **SC-005**: No MCP server process runs after extension activation.

## Assumptions

- AI agents (Claude Code, Codex, GitHub Copilot) read VSCode diagnostics as part of their standard workspace context. This is confirmed behavior for Claude Code (`get_diagnostics`) and GitHub Copilot.
- The Hint or Information severity level is appropriate for feedback — it provides visibility without triggering error-level alerts.
- The existing feedback storage format (JSON file) remains unchanged; only the exposure mechanism changes.
- The extension's existing Comments API integration (inline comments, reply, edit, delete) remains unchanged.

## Scope

### In Scope

- Publishing feedback threads as VSCode diagnostics
- Removing MCP server code and configuration
- Real-time diagnostic updates on feedback changes

### Out of Scope

- Changing the feedback storage format
- Modifying the Comments API UI (inline comments, reply, edit, resolve)
- Adding new feedback features beyond diagnostics exposure
- Backward compatibility with the MCP server approach
