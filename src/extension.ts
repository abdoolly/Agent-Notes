/**
 * Extension entry point.
 * Activates: CommentController, commands, FeedbackPanel, RangeTracker, Diagnostics, file watcher.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { readStore } from './comment-store';
import { ensureGitignored } from './gitignore-manager';
import {
  createCommentController,
  registerCommands,
  syncFromStore,
  disposeAll,
  refreshAllDecorations,
} from './comment-controller';
import { FeedbackPanelProvider, registerNavigateCommand } from './feedback-panel';
import { registerDocumentChangeListener } from './range-tracker';
import { createDiagnosticCollection, refreshDiagnostics } from './diagnostics';
import { FeedbackStore } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Ensure .gitignore has our storage file
  try {
    ensureGitignored(workspaceRoot);
  } catch {
    // Non-fatal — workspace may not have .gitignore
  }

  // Load or create the store
  const store: FeedbackStore = readStore(workspaceRoot);

  // Diagnostics collection — feedback appears in Problems panel
  const diagnosticCollection = createDiagnosticCollection();
  context.subscriptions.push(diagnosticCollection);
  refreshDiagnostics(diagnosticCollection, store, workspaceRoot);

  // Called whenever in-memory store changes — refreshes panel and diagnostics
  function onStoreChange(): void {
    panelProvider.updateStore(store);
    refreshDiagnostics(diagnosticCollection, store, workspaceRoot);
  }

  // Initialize CommentController (US1)
  createCommentController(context, store, workspaceRoot);
  registerCommands(context, store, workspaceRoot, onStoreChange);

  // Feedback panel sidebar (US4)
  const panelProvider = new FeedbackPanelProvider(store, workspaceRoot);
  const treeView = vscode.window.createTreeView('agentNotesPanel', {
    treeDataProvider: panelProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  registerNavigateCommand(context);

  // Range tracker (US5) — also refresh decorations on range changes
  registerDocumentChangeListener(context, store, workspaceRoot, () => {
    refreshAllDecorations(store, workspaceRoot);
    onStoreChange();
  });

  // File watcher: reload store when external tools modify the store file
  const storageRelPath = path.join('.vscode', 'agent-notes.json');
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolders[0], storageRelPath)
  );

  watcher.onDidChange(() => {
    const reloaded = readStore(workspaceRoot);
    store.threads = reloaded.threads;
    store.version = reloaded.version;
    store.lastBackup = reloaded.lastBackup;
    syncFromStore(store, workspaceRoot);
    panelProvider.updateStore(store);
    refreshDiagnostics(diagnosticCollection, store, workspaceRoot);
  });

  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  disposeAll();
}
