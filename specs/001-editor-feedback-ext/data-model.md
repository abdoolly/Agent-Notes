# Data Model: Editor Feedback Extension

**Date**: 2026-02-23
**Source**: [spec.md](./spec.md) Key Entities + [research.md](./research.md) R2, R6, R7

## Entities

### FeedbackComment

A single user-authored annotation anchored to a text range.

| Field | Type | Description |
|-|-|-|
| id | string (UUID v4) | Unique identifier |
| body | string | Plain text comment content |
| author | string | Display name of comment author |
| createdAt | string (ISO 8601) | Creation timestamp |

No `status` field — resolving a comment deletes it from storage entirely.

### FeedbackThread

A collection of comments anchored to a specific text range in a file.

| Field | Type | Description |
|-|-|-|
| id | string (UUID v4) | Thread identifier |
| uri | string | File path (workspace-relative) |
| range | Range | Anchored text range |
| selectedText | string | Original selected text snippet for fuzzy re-anchoring |
| contextBefore | string | 3 lines above selection (for fuzzy recovery) |
| contextAfter | string | 3 lines below selection (for fuzzy recovery) |
| contentHash | string (CRC32) | Hash of anchored text for quick exact-match check |
| comments | FeedbackComment[] | Ordered list: first = original, rest = replies |

### Range

Position information for a text anchor.

| Field | Type | Description |
|-|-|-|
| startLine | number | 0-indexed start line |
| startCharacter | number | 0-indexed start character |
| endLine | number | 0-indexed end line |
| endCharacter | number | 0-indexed end character |

### FeedbackStore

Top-level workspace storage container.

| Field | Type | Description |
|-|-|-|
| version | number | Schema version for migrations (starts at 1) |
| threads | FeedbackThread[] | All active feedback threads |
| lastBackup | string (ISO 8601) | Timestamp of last backup write |

## Relationships

```
FeedbackStore 1──* FeedbackThread 1──* FeedbackComment
                   │
                   └── anchored to file (uri) + Range
```

- A store contains zero or more threads
- A thread contains one or more comments (first is original, rest are replies)
- A thread is anchored to exactly one file and one range
- Resolving a thread deletes it and all its comments from the store

## State Transitions

Comments have no status field. The only lifecycle is:

```
[Created] ──resolve──> [Deleted from storage]
```

Threads can become orphaned when their anchored text is deleted:

```
[Anchored] ──text deleted + fuzzy score < 0.5──> [Orphaned]
[Orphaned] ──user manually re-anchors or deletes──> [Anchored] or [Deleted]
```

## Storage File Format

Location: `.vscode/plan-feedback.json` (workspace root)

```json
{
  "version": 1,
  "threads": [
    {
      "id": "a1b2c3d4-...",
      "uri": "src/auth.ts",
      "range": { "startLine": 14, "startCharacter": 0, "endLine": 21, "endCharacter": 45 },
      "selectedText": "function validateToken(token: string) {\n  ...\n}",
      "contextBefore": "import { verify } from 'jsonwebtoken';\n\n// Token validation",
      "contextAfter": "\nexport function refreshToken() {\n  ...",
      "contentHash": "a1b2c3d4",
      "comments": [
        {
          "id": "e5f6g7h8-...",
          "body": "This should handle expired tokens gracefully",
          "author": "developer",
          "createdAt": "2026-02-23T10:00:00Z"
        },
        {
          "id": "i9j0k1l2-...",
          "body": "Also consider rate limiting for repeated invalid tokens",
          "author": "developer",
          "createdAt": "2026-02-23T10:05:00Z"
        }
      ]
    }
  ],
  "lastBackup": "2026-02-23T10:05:00Z"
}
```

## Validation Rules

- `id` fields must be valid UUID v4
- `uri` must be a workspace-relative path (no absolute paths)
- `range` lines must be non-negative, `startLine <= endLine`
- `comments` array must have at least one entry (the original comment)
- `body` must be non-empty string
- `version` must be a positive integer
- `selectedText` must be non-empty (captured at creation time)

## Scale Assumptions

- Maximum 500 threads per workspace (per SC-005)
- Average 1-2 comments per thread (most threads are single comments)
- Average thread JSON size: ~500 bytes
- Maximum store file size: ~250KB (500 threads × 500 bytes)
- File read/write latency: <10ms for 250KB JSON
