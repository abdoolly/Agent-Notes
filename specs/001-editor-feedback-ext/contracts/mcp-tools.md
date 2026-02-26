# MCP Tool Contracts: Editor Feedback Extension

**Date**: 2026-02-23
**Server Name**: `plan-feedback`
**Transport**: stdio (JSON-RPC over stdin/stdout)
**SDK**: `@modelcontextprotocol/sdk`

## Tool: `get_feedback`

Query feedback comments for the workspace or a specific file.

### Input Schema

| Parameter | Type | Required | Description |
|-|-|-|-|
| filePath | string | No | Workspace-relative file path to filter by. If omitted, returns all feedback. |

### Output

Returns JSON array of feedback threads.

```json
{
  "content": [{
    "type": "text",
    "text": "[{\"id\":\"a1b2...\",\"file\":\"src/auth.ts\",\"range\":{\"startLine\":14,\"endLine\":21},\"selectedText\":\"function validateToken...\",\"comments\":[{\"body\":\"Handle expired tokens\",\"author\":\"developer\",\"createdAt\":\"2026-02-23T10:00:00Z\"}]}]"
  }]
}
```

### Response Shape (parsed)

```typescript
interface FeedbackResult {
  id: string;             // Thread ID
  file: string;           // Workspace-relative path
  range: {
    startLine: number;
    endLine: number;
    startCharacter: number;
    endCharacter: number;
  };
  selectedText: string;   // Original anchored text
  orphaned: boolean;      // True if anchor text was deleted
  comments: {
    id: string;
    body: string;         // Plain text
    author: string;
    createdAt: string;    // ISO 8601
  }[];
}
```

### Behavior

- No `filePath`: Returns all threads across workspace, ordered by file path then line number
- With `filePath`: Returns only threads for that file, ordered by line number
- Empty result: Returns empty array `[]`
- Orphaned threads: Included with `orphaned: true` flag

---

## Tool: `resolve_feedback`

Delete a feedback thread (marks it as addressed). Removes all visual indicators from the editor.

### Input Schema

| Parameter | Type | Required | Description |
|-|-|-|-|
| threadId | string | Yes | UUID of the thread to resolve |

### Output

```json
{
  "content": [{
    "type": "text",
    "text": "{\"resolved\":true,\"threadId\":\"a1b2...\"}"
  }]
}
```

### Behavior

- Valid `threadId`: Deletes the thread from storage, removes all visual indicators from editor
- Invalid `threadId`: Returns `{"resolved": false, "error": "Thread not found"}`
- Already resolved: Same as invalid (thread no longer exists)

---

## Tool: `get_feedback_summary`

Get a workspace-wide overview of feedback status.

### Input Schema

No parameters.

### Output

```json
{
  "content": [{
    "type": "text",
    "text": "{\"totalThreads\":12,\"totalComments\":18,\"fileCount\":5,\"files\":[{\"path\":\"src/auth.ts\",\"threadCount\":3},{\"path\":\"docs/plan.md\",\"threadCount\":2}],\"orphanedCount\":1}"
  }]
}
```

### Response Shape (parsed)

```typescript
interface FeedbackSummary {
  totalThreads: number;
  totalComments: number;
  fileCount: number;
  files: {
    path: string;
    threadCount: number;
  }[];
  orphanedCount: number;
}
```

### Behavior

- Returns aggregate counts even if no feedback exists (all zeros)
- Files sorted by thread count descending
- Orphaned threads counted separately

---

## Error Handling

All tools return errors in the standard MCP format:

```json
{
  "content": [{
    "type": "text",
    "text": "{\"error\":\"Description of what went wrong\"}"
  }],
  "isError": true
}
```

Common errors:
- Storage file not found or unreadable: `"Feedback store not initialized"`
- Malformed storage file: `"Feedback store corrupted, attempting recovery from backup"`
- Invalid thread ID format: `"Invalid thread ID format"`

## Discovery

AI agents discover these tools automatically when the extension is installed and VSCode is running in agent mode. No user configuration required. The extension registers as an MCP server provider via:

```json
{
  "contributes": {
    "mcpServerDefinitionProviders": [{
      "id": "plan-feedback-mcp",
      "label": "Plan Feedback"
    }]
  }
}
```
