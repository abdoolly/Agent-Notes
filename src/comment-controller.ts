/**
 * CommentController — manages VSCode Comments API threads, decorations, and commands.
 * US1: Add inline feedback on selected text.
 * US3: Reply and threaded conversations.
 * US5: Orphan visual indicator.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FeedbackStore, FeedbackThread, FeedbackComment } from './types';
import {
  addThread,
  deleteThread,
  updateThread,
} from './comment-store';

// Simple hash using string reduce (no crypto dependency)
function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

/** Custom comment class that stores the thread ID in contextValue for command routing. */
class FeedbackCommentItem implements vscode.Comment {
  body: string | vscode.MarkdownString;
  mode: vscode.CommentMode;
  author: vscode.CommentAuthorInformation;
  contextValue: string;
  reactions: vscode.CommentReaction[];

  constructor(
    public readonly threadId: string,
    comment: FeedbackComment,
  ) {
    this.body = new vscode.MarkdownString(comment.body);
    this.mode = vscode.CommentMode.Preview;
    this.author = { name: comment.author };
    // Encode thread ID and comment ID for retrieval in commands
    this.contextValue = `agent-notes:${threadId}:${comment.id}`;
    this.reactions = [];
  }
}

/** Maps threadId → VSCode CommentThread for lifecycle management */
const vsThreadMap = new Map<string, vscode.CommentThread>();

let highlightDecoration: vscode.TextEditorDecorationType;
let orphanDecoration: vscode.TextEditorDecorationType;
let commentController: vscode.CommentController;

export function createCommentController(
  context: vscode.ExtensionContext,
  store: FeedbackStore,
  workspaceRoot: string,
): vscode.CommentController {
  highlightDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    border: '1px solid rgba(255, 200, 0, 0.4)',
    borderRadius: '2px',
  });

  orphanDecoration = vscode.window.createTextEditorDecorationType({
    opacity: '0.5',
    border: '1px dashed rgba(128, 128, 128, 0.6)',
    borderRadius: '2px',
    after: {
      contentText: ' ⚠ orphaned',
      color: 'rgba(128, 128, 128, 0.8)',
      fontStyle: 'italic',
    },
  });

  commentController = vscode.comments.createCommentController('agent-notes', 'Agent Notes');
  commentController.commentingRangeProvider = {
    provideCommentingRanges(document: vscode.TextDocument) {
      const lineCount = document.lineCount;
      return [new vscode.Range(0, 0, lineCount - 1, 0)];
    },
  };

  context.subscriptions.push(commentController);

  // Restore threads for already-open documents
  for (const doc of vscode.workspace.textDocuments) {
    restoreThreadsForDocument(doc, store, workspaceRoot);
  }

  // Listen for file open to restore threads
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      restoreThreadsForDocument(doc, store, workspaceRoot);
    })
  );

  return commentController;
}

/** Register all commands for US1, US3, US5 */
export function registerCommands(
  context: vscode.ExtensionContext,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agent-notes.addFeedback', async () => {
      await handleAddFeedback(store, workspaceRoot, onStoreChange);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agent-notes.deleteThread', (thread: vscode.CommentThread) => {
      handleDeleteThread(thread, store, workspaceRoot, onStoreChange);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agent-notes.editComment', async (comment: vscode.Comment) => {
      await handleEditComment(comment, store, workspaceRoot);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agent-notes.reply', async (reply: vscode.CommentReply) => {
      await handleReply(reply, store, workspaceRoot, onStoreChange);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agent-notes.resolveThread', (thread: vscode.CommentThread) => {
      handleResolveThread(thread, store, workspaceRoot, onStoreChange);
    })
  );

  // AI-accessible: resolve by thread ID (from diagnostic code property)
  context.subscriptions.push(
    vscode.commands.registerCommand('agent-notes.resolveThreadById', (threadId: string) => {
      handleResolveThreadById(threadId, store, workspaceRoot, onStoreChange);
    })
  );
}

async function handleAddFeedback(
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const selection = editor.selection;
  const document = editor.document;

  const body = await vscode.window.showInputBox({
    prompt: 'Enter feedback comment',
    placeHolder: 'Your feedback...',
    validateInput: (v) => v.trim().length === 0 ? 'Comment cannot be empty' : null,
  });

  if (!body) {
    return;
  }

  const selectedText = document.getText(selection);
  const startLine = selection.start.line;
  const endLine = selection.end.line;

  const contextBeforeLines: string[] = [];
  for (let i = Math.max(0, startLine - 3); i < startLine; i++) {
    contextBeforeLines.push(document.lineAt(i).text);
  }

  const contextAfterLines: string[] = [];
  for (let i = endLine + 1; i <= Math.min(document.lineCount - 1, endLine + 3); i++) {
    contextAfterLines.push(document.lineAt(i).text);
  }

  const relativeUri = path.relative(workspaceRoot, document.uri.fsPath).replace(/\\/g, '/');
  const threadId = uuidv4();
  const commentId = uuidv4();
  const anchorText = selectedText || document.lineAt(startLine).text;

  const thread: FeedbackThread = {
    id: threadId,
    uri: relativeUri,
    range: {
      startLine: selection.start.line,
      startCharacter: selection.start.character,
      endLine: selection.end.line,
      endCharacter: selection.end.character,
    },
    selectedText: anchorText,
    contextBefore: contextBeforeLines.join('\n'),
    contextAfter: contextAfterLines.join('\n'),
    contentHash: hashString(anchorText),
    comments: [{
      id: commentId,
      body,
      author: vscode.env.machineId.slice(0, 8),
      createdAt: new Date().toISOString(),
    }],
  };

  addThread(workspaceRoot, store, thread);
  createVsThread(document, thread);
  refreshDecorations(editor, store, workspaceRoot);
  onStoreChange();
}

function handleDeleteThread(
  vsThread: vscode.CommentThread,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): void {
  const threadId = findThreadIdByVsThread(vsThread);
  if (threadId) {
    deleteThread(workspaceRoot, store, threadId);
    vsThreadMap.delete(threadId);
    onStoreChange();
  }
  vsThread.dispose();
  refreshDecorationsForUri(vsThread.uri, store, workspaceRoot);
}

async function handleEditComment(
  comment: vscode.Comment,
  store: FeedbackStore,
  workspaceRoot: string,
): Promise<void> {
  // Extract thread ID from contextValue: "agent-notes:{threadId}:{commentId}"
  const ctx = comment.contextValue ?? '';
  const parts = ctx.split(':');
  if (parts.length < 3 || parts[0] !== 'agent-notes') {
    return;
  }
  const threadId = parts[1];
  const commentId = parts[2];

  const storeThread = store.threads.find(t => t.id === threadId);
  if (!storeThread) {
    return;
  }

  const commentEntry = storeThread.comments.find(c => c.id === commentId);
  if (!commentEntry) {
    return;
  }

  const newBody = await vscode.window.showInputBox({
    prompt: 'Edit comment',
    value: commentEntry.body,
    validateInput: (v) => v.trim().length === 0 ? 'Comment cannot be empty' : null,
  });

  if (!newBody) {
    return;
  }

  commentEntry.body = newBody;
  updateThread(workspaceRoot, store, storeThread);

  // Update VSCode thread UI
  const vsThread = vsThreadMap.get(threadId);
  if (vsThread) {
    vsThread.comments = storeThread.comments.map(c => new FeedbackCommentItem(threadId, c));
  }
}

async function handleReply(
  reply: vscode.CommentReply,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): Promise<void> {
  const vsThread = reply.thread;
  const body = reply.text.trim();

  if (!body) {
    return;
  }

  const threadId = findThreadIdByVsThread(vsThread);

  if (threadId) {
    // Existing thread — add reply
    const storeThread = store.threads.find(t => t.id === threadId);
    if (!storeThread) {
      return;
    }

    const newComment: FeedbackComment = {
      id: uuidv4(),
      body,
      author: vscode.env.machineId.slice(0, 8),
      createdAt: new Date().toISOString(),
    };

    storeThread.comments.push(newComment);
    updateThread(workspaceRoot, store, storeThread);

    vsThread.comments = storeThread.comments.map(c => new FeedbackCommentItem(threadId, c));
    onStoreChange();
  } else {
    // New thread from "+" gutter button — create it
    const document = vsThread.uri.scheme === 'file'
      ? vscode.workspace.textDocuments.find(d => d.uri.toString() === vsThread.uri.toString())
      : undefined;

    const relativeUri = path.relative(workspaceRoot, vsThread.uri.fsPath).replace(/\\/g, '/');
    const newThreadId = uuidv4();
    const range = vsThread.range ?? new vscode.Range(0, 0, 0, 0);

    const selectedText = document
      ? document.getText(range)
      : '';

    const startLine = range.start.line;
    const endLine = range.end.line;

    let contextBefore = '';
    let contextAfter = '';
    if (document) {
      const beforeLines: string[] = [];
      for (let i = Math.max(0, startLine - 3); i < startLine; i++) {
        beforeLines.push(document.lineAt(i).text);
      }
      contextBefore = beforeLines.join('\n');

      const afterLines: string[] = [];
      for (let i = endLine + 1; i <= Math.min(document.lineCount - 1, endLine + 3); i++) {
        afterLines.push(document.lineAt(i).text);
      }
      contextAfter = afterLines.join('\n');
    }

    const anchorText = selectedText || (document ? document.lineAt(startLine).text : '');

    const thread: FeedbackThread = {
      id: newThreadId,
      uri: relativeUri,
      range: {
        startLine: range.start.line,
        startCharacter: range.start.character,
        endLine: range.end.line,
        endCharacter: range.end.character,
      },
      selectedText: anchorText,
      contextBefore,
      contextAfter,
      contentHash: hashString(anchorText),
      comments: [{
        id: uuidv4(),
        body,
        author: vscode.env.machineId.slice(0, 8),
        createdAt: new Date().toISOString(),
      }],
    };

    addThread(workspaceRoot, store, thread);

    // Register this vsThread in our map and update its comments UI
    vsThreadMap.set(newThreadId, vsThread);
    vsThread.label = 'Agent Notes';
    vsThread.comments = thread.comments.map(c => new FeedbackCommentItem(newThreadId, c));

    if (document) {
      const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
      if (editor) {
        refreshDecorations(editor, store, workspaceRoot);
      }
    }

    onStoreChange();
  }
}

function handleResolveThread(
  vsThread: vscode.CommentThread,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): void {
  const threadId = findThreadIdByVsThread(vsThread);
  if (threadId) {
    deleteThread(workspaceRoot, store, threadId);
    vsThreadMap.delete(threadId);
    onStoreChange();
  }
  vsThread.dispose();
  refreshDecorationsForUri(vsThread.uri, store, workspaceRoot);
}

function handleResolveThreadById(
  threadId: string,
  store: FeedbackStore,
  workspaceRoot: string,
  onStoreChange: () => void,
): void {
  const storeThread = store.threads.find(t => t.id === threadId);
  if (!storeThread) {
    return;
  }

  // Dispose the VS Code comment thread if it exists
  const vsThread = vsThreadMap.get(threadId);
  if (vsThread) {
    vsThread.dispose();
    vsThreadMap.delete(threadId);
  }

  const fileUri = vscode.Uri.file(path.join(workspaceRoot, storeThread.uri));
  deleteThread(workspaceRoot, store, threadId);
  refreshDecorationsForUri(fileUri, store, workspaceRoot);
  onStoreChange();
}

function restoreThreadsForDocument(
  document: vscode.TextDocument,
  store: FeedbackStore,
  workspaceRoot: string,
): void {
  const relativeUri = path.relative(workspaceRoot, document.uri.fsPath).replace(/\\/g, '/');
  const threads = store.threads.filter(t => t.uri === relativeUri);

  for (const thread of threads) {
    if (!vsThreadMap.has(thread.id)) {
      createVsThread(document, thread);
    }
  }

  const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
  if (editor) {
    refreshDecorations(editor, store, workspaceRoot);
  }
}

function createVsThread(document: vscode.TextDocument, thread: FeedbackThread): vscode.CommentThread {
  const range = new vscode.Range(
    thread.range.startLine,
    thread.range.startCharacter,
    thread.range.endLine,
    thread.range.endCharacter,
  );

  const vsThread = commentController.createCommentThread(document.uri, range, []);
  vsThread.label = 'Agent Notes';
  vsThread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
  vsThread.comments = thread.comments.map(c => new FeedbackCommentItem(thread.id, c));

  vsThreadMap.set(thread.id, vsThread);
  return vsThread;
}

function findThreadIdByVsThread(vsThread: vscode.CommentThread): string | undefined {
  for (const [id, t] of vsThreadMap.entries()) {
    if (t === vsThread) {
      return id;
    }
  }
  return undefined;
}

function refreshDecorations(
  editor: vscode.TextEditor,
  store: FeedbackStore,
  workspaceRoot: string,
): void {
  const relativeUri = path.relative(workspaceRoot, editor.document.uri.fsPath).replace(/\\/g, '/');
  const threads = store.threads.filter(t => t.uri === relativeUri);

  const normalRanges: vscode.Range[] = [];
  const orphanRanges: vscode.Range[] = [];

  for (const thread of threads) {
    const range = new vscode.Range(
      thread.range.startLine,
      thread.range.startCharacter,
      thread.range.endLine,
      thread.range.endCharacter,
    );
    if (thread.orphaned) {
      orphanRanges.push(range);
    } else {
      normalRanges.push(range);
    }
  }

  editor.setDecorations(highlightDecoration, normalRanges);
  editor.setDecorations(orphanDecoration, orphanRanges);
}

function refreshDecorationsForUri(uri: vscode.Uri, store: FeedbackStore, workspaceRoot: string): void {
  const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === uri.fsPath);
  if (editor) {
    refreshDecorations(editor, store, workspaceRoot);
  }
}

/** Called by file watcher when store is reloaded from disk. Re-syncs all VS threads. */
export function syncFromStore(
  store: FeedbackStore,
  workspaceRoot: string,
): void {
  // Dispose threads no longer in store
  for (const [id, vsThread] of vsThreadMap.entries()) {
    if (!store.threads.find(t => t.id === id)) {
      vsThread.dispose();
      vsThreadMap.delete(id);
    }
  }

  // Restore newly added threads
  for (const doc of vscode.workspace.textDocuments) {
    restoreThreadsForDocument(doc, store, workspaceRoot);
  }
}

export function disposeAll(): void {
  for (const vsThread of vsThreadMap.values()) {
    vsThread.dispose();
  }
  vsThreadMap.clear();
  highlightDecoration?.dispose();
  orphanDecoration?.dispose();
}

/** Update decorations in response to store changes (called from range-tracker). */
export function refreshAllDecorations(store: FeedbackStore, workspaceRoot: string): void {
  for (const editor of vscode.window.visibleTextEditors) {
    refreshDecorations(editor, store, workspaceRoot);
  }

  // Update vsThread ranges from store
  for (const thread of store.threads) {
    const vsThread = vsThreadMap.get(thread.id);
    if (vsThread) {
      vsThread.range = new vscode.Range(
        thread.range.startLine,
        thread.range.startCharacter,
        thread.range.endLine,
        thread.range.endCharacter,
      );
      vsThread.comments = thread.comments.map(c => new FeedbackCommentItem(thread.id, c));
    }
  }
}
