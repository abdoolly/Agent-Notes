/**
 * TreeDataProvider for the Feedback Overview Panel (US4).
 * Two-level tree: file nodes → thread nodes.
 * Click-to-navigate to source range.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FeedbackStore, FeedbackThread } from './types';

class FileNode extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly threadCount: number,
  ) {
    super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);
    this.description = filePath;
    this.tooltip = `${threadCount} feedback thread${threadCount !== 1 ? 's' : ''}`;
    this.contextValue = 'feedbackFile';
    this.iconPath = new vscode.ThemeIcon('file');
  }
}

class ThreadNode extends vscode.TreeItem {
  constructor(
    public readonly thread: FeedbackThread,
    public readonly workspaceRoot: string,
  ) {
    const firstComment = thread.comments[0];
    const preview = firstComment.body.length > 50
      ? firstComment.body.slice(0, 47) + '...'
      : firstComment.body;

    super(preview, vscode.TreeItemCollapsibleState.None);
    this.description = `Line ${thread.range.startLine + 1}${thread.orphaned ? ' ⚠ orphaned' : ''}`;
    this.tooltip = firstComment.body;
    this.contextValue = 'feedbackThread';
    this.iconPath = new vscode.ThemeIcon(thread.orphaned ? 'warning' : 'comment');

    const absoluteUri = vscode.Uri.file(path.join(workspaceRoot, thread.uri));
    this.command = {
      command: 'agent-notes.navigateToThread',
      title: 'Navigate to thread',
      arguments: [absoluteUri, thread.range],
    };
  }
}

type FeedbackTreeItem = FileNode | ThreadNode;

export class FeedbackPanelProvider implements vscode.TreeDataProvider<FeedbackTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<FeedbackTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private store: FeedbackStore,
    private workspaceRoot: string,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  updateStore(store: FeedbackStore): void {
    this.store = store;
    this.refresh();
  }

  getTreeItem(element: FeedbackTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FeedbackTreeItem): FeedbackTreeItem[] {
    if (!element) {
      // Root level: group threads by file
      const fileMap = new Map<string, FeedbackThread[]>();
      for (const thread of this.store.threads) {
        const threads = fileMap.get(thread.uri) ?? [];
        threads.push(thread);
        fileMap.set(thread.uri, threads);
      }

      return Array.from(fileMap.entries()).map(
        ([filePath, threads]) => new FileNode(filePath, threads.length)
      );
    }

    if (element instanceof FileNode) {
      const threads = this.store.threads.filter(t => t.uri === element.filePath);
      return threads.map(t => new ThreadNode(t, this.workspaceRoot));
    }

    return [];
  }
}

export function registerNavigateCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'agent-notes.navigateToThread',
      async (uri: vscode.Uri, range: { startLine: number; startCharacter: number; endLine: number; endCharacter: number }) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const vsRange = new vscode.Range(
          range.startLine,
          range.startCharacter,
          range.endLine,
          range.endCharacter,
        );
        editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(vsRange.start, vsRange.end);
      }
    )
  );
}
