/**
 * TypeScript interfaces for the Agent Notes extension.
 * Matches the data model in specs/001-editor-feedback-ext/data-model.md
 */

export interface Range {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface FeedbackComment {
  id: string;           // UUID v4
  body: string;         // Plain text comment content
  author: string;       // Display name of comment author
  createdAt: string;    // ISO 8601 timestamp
}

export interface FeedbackThread {
  id: string;                 // UUID v4
  uri: string;                // Workspace-relative file path
  range: Range;               // Anchored text range
  selectedText: string;       // Original selected text for fuzzy re-anchoring
  contextBefore: string;      // 3 lines above selection
  contextAfter: string;       // 3 lines below selection
  contentHash: string;        // CRC32 hash of anchored text
  comments: FeedbackComment[]; // First = original, rest = replies
  orphaned?: boolean;         // True if anchor text was deleted
}

export interface FeedbackStore {
  version: number;            // Schema version (starts at 1)
  threads: FeedbackThread[];  // All active feedback threads
  lastBackup: string;         // ISO 8601 timestamp of last backup write
}
