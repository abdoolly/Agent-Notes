/**
 * Diagnostics integration for Agent Notes.
 * Converts FeedbackThreads into VS Code diagnostics so feedback appears
 * in the Problems panel and is visible to AI agents via get_diagnostics.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FeedbackStore, FeedbackThread } from './types';
import { formatDiagnosticMessage } from './diagnostic-formatter';

const COLLECTION_NAME = 'agent-notes';
const SOURCE_LABEL = 'Agent Notes';

/** Create the singleton DiagnosticCollection for feedback. */
export function createDiagnosticCollection(): vscode.DiagnosticCollection {
  return vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
}

/** Refresh all diagnostics from the current store state. */
export function refreshDiagnostics(
  collection: vscode.DiagnosticCollection,
  store: FeedbackStore,
  workspaceRoot: string,
): void {
  collection.clear();

  // Group threads by file URI
  const grouped = new Map<string, FeedbackThread[]>();
  for (const thread of store.threads) {
    const existing = grouped.get(thread.uri);
    if (existing) {
      existing.push(thread);
    } else {
      grouped.set(thread.uri, [thread]);
    }
  }

  for (const [relPath, threads] of grouped) {
    const fileUri = vscode.Uri.file(path.join(workspaceRoot, relPath));
    const diagnostics = threads.map(thread => createDiagnostic(thread));
    collection.set(fileUri, diagnostics);
  }
}

function createDiagnostic(thread: FeedbackThread): vscode.Diagnostic {
  const range = new vscode.Range(
    thread.range.startLine,
    thread.range.startCharacter,
    thread.range.endLine,
    thread.range.endCharacter,
  );

  const message = formatDiagnosticMessage(thread);

  const diagnostic = new vscode.Diagnostic(
    range,
    message,
    vscode.DiagnosticSeverity.Information,
  );
  diagnostic.source = SOURCE_LABEL;
  diagnostic.code = thread.id;

  return diagnostic;
}
