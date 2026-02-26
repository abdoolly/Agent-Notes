# Agent Notes

Leave inline feedback comments on any file in VS Code. Your AI coding agent sees them automatically as diagnostics and knows how to resolve them.

## Installation

Install from the VS Code Marketplace or from a `.vsix` file:

```sh
code --install-extension agent-notes-0.1.0.vsix
```

## Adding Feedback

1. Select text in any file
2. Right-click → **Add Feedback**, or press `Ctrl+Alt+F` (`Cmd+Alt+F` on Mac)
3. Type your comment and press Enter

The selected text gets highlighted and a comment thread appears in the gutter.

## Viewing Feedback

- **Inline** — comment threads appear directly in the editor
- **Feedback Panel** — Explorer sidebar → **Feedback**, grouped by file
- **Problems Panel** — each comment shows as an Information diagnostic with source "Agent Notes"

## Replying

Click the reply button in any comment thread to add a reply.

## Resolving

Click **Resolve Thread** on a comment to mark it as addressed. The comment, highlight, and diagnostic all disappear.

## Range Tracking

Feedback survives code edits. When lines are inserted or deleted above a comment, the range shifts automatically. If the anchored text is heavily modified, the comment is marked as **orphaned** (dimmed with ⚠).

## AI Agent Integration

Every feedback comment is published as a VS Code diagnostic. AI agents that read the Problems panel see your feedback automatically — including the comment body, author, selected text, all replies, and instructions on how to resolve it.

### What the AI Sees

```
[Feedback] reviewer (1/15/2026): Consider error handling here
On: "function validateToken()"
---
[Reply] developer (1/15/2026): Good point, will fix

[Resolve] After addressing this feedback, resolve it by removing the thread object
with "id": "a1b2c3d4-..." from the "threads" array in .vscode/agent-notes.json
```

The AI reads the feedback, addresses it in code, then edits the JSON file to resolve it. The extension detects the change and clears everything automatically.

### Connecting Your AI Agent

Add the following to your project's AI instruction file so the agent checks for feedback before completing tasks.

**Claude Code** — add to `CLAUDE.md`:

```markdown
## Agent Notes

This project uses the Agent Notes extension for code review comments.
Feedback appears as Information-severity diagnostics with source "Agent Notes" in the Problems panel.

Before considering any task complete:
1. Check diagnostics for any "Agent Notes" items related to your changes
2. Address the feedback described in each diagnostic message
3. Resolve addressed feedback by removing its thread object from .vscode/agent-notes.json
   (match by the "id" field shown in the diagnostic message)
```

**GitHub Copilot** — add to `.github/copilot-instructions.md`:

```markdown
## Agent Notes

This project uses inline feedback comments via the Agent Notes extension.
Check the Problems panel for diagnostics with source "Agent Notes" before completing tasks.
Each diagnostic contains the feedback context and resolve instructions in its message.
To resolve: remove the matching thread by "id" from .vscode/agent-notes.json.
```

**Cursor** — add to `.cursorrules`:

```
This project uses the Agent Notes extension for code review comments.
Check diagnostics with source "Agent Notes" in the Problems panel before completing tasks.
Each diagnostic message includes feedback context and resolve instructions.
To resolve feedback: remove the thread object by "id" from .vscode/agent-notes.json.
```

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|-|-|-|
| Add Feedback | `Ctrl+Alt+F` | `Cmd+Alt+F` |

## Storage

Feedback is stored in `.vscode/agent-notes.json`, gitignored automatically. The file stays local to your workspace.
