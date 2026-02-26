/**
 * Range tracking for feedback threads (US5).
 * Listens to document changes, shifts ranges on line insertions/deletions.
 * Uses diff-match-patch for fuzzy re-anchoring when text is edited within the range.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as dmp from 'diff-match-patch';
import { FeedbackStore, FeedbackThread } from './types';
import { scheduleWrite } from './comment-store';

const FUZZY_THRESHOLD = 0.5;

const DMP = new dmp.diff_match_patch();

/** Listen to document changes and update tracked ranges. */
export function registerDocumentChangeListener(
  context: vscode.ExtensionContext,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      handleDocumentChange(event, store, workspaceRoot, onStoreChange);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      const relUri = path.relative(workspaceRoot, document.uri.fsPath).replace(/\\/g, '/');
      const affected = store.threads.filter(t => t.uri === relUri);
      if (affected.length > 0) {
        scheduleWrite(workspaceRoot, store);
      }
    })
  );
}

function handleDocumentChange(
  event: vscode.TextDocumentChangeEvent,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): void {
  const relUri = path.relative(workspaceRoot, event.document.uri.fsPath).replace(/\\/g, '/');
  const threads = store.threads.filter(t => t.uri === relUri);

  if (threads.length === 0) {
    return;
  }

  let changed = false;

  // Process content changes in reverse document order to avoid offset drift
  const sortedChanges = [...event.contentChanges].sort(
    (a, b) => b.range.start.line - a.range.start.line
  );

  for (const change of sortedChanges) {
    const addedLines = change.text.split('\n').length - 1;
    const removedLines = change.range.end.line - change.range.start.line;
    const lineDelta = addedLines - removedLines;

    for (const thread of threads) {
      if (rangeOverlapsChange(thread, change)) {
        // Try fuzzy re-anchor
        const newRange = fuzzyReanchor(event.document, thread);
        if (newRange) {
          thread.range = newRange;
          thread.orphaned = false;
        } else {
          thread.orphaned = true;
        }
        changed = true;
      } else if (change.range.end.line < thread.range.startLine) {
        // Change is above the thread range — shift it
        thread.range = {
          startLine: thread.range.startLine + lineDelta,
          startCharacter: thread.range.startCharacter,
          endLine: thread.range.endLine + lineDelta,
          endCharacter: thread.range.endCharacter,
        };
        changed = true;
      }
    }
  }

  if (changed) {
    onStoreChange();
  }
}

function rangeOverlapsChange(thread: FeedbackThread, change: vscode.TextDocumentContentChangeEvent): boolean {
  const tStart = thread.range.startLine;
  const tEnd = thread.range.endLine;
  const cStart = change.range.start.line;
  const cEnd = change.range.end.line;
  return cStart <= tEnd && cEnd >= tStart;
}

function fuzzyReanchor(
  document: vscode.TextDocument,
  thread: FeedbackThread,
): { startLine: number; startCharacter: number; endLine: number; endCharacter: number } | null {
  const needle = thread.selectedText;
  const haystack = document.getText();

  // Use diff-match-patch Bitap algorithm for fuzzy matching
  const loc = thread.range.startLine > 0
    ? document.offsetAt(new vscode.Position(thread.range.startLine, 0))
    : 0;

  const matchIndex = DMP.match_main(haystack, needle, loc);

  if (matchIndex === -1) {
    return null;
  }

  // Calculate fuzzy score via levenshtein distance
  const found = haystack.slice(matchIndex, matchIndex + needle.length);
  const score = 1 - (levenshtein(needle, found) / Math.max(needle.length, found.length));

  if (score < FUZZY_THRESHOLD) {
    return null;
  }

  const startPos = document.positionAt(matchIndex);
  const endPos = document.positionAt(matchIndex + needle.length);

  return {
    startLine: startPos.line,
    startCharacter: startPos.character,
    endLine: endPos.line,
    endCharacter: endPos.character,
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    return Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0));
  });

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}
