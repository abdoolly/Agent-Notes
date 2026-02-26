/**
 * JSON persistence layer for FeedbackStore.
 * Reads/writes .vscode/agent-notes.json with atomic write (temp → rename) and backup.
 * All file I/O is async to avoid blocking the extension host thread.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { FeedbackStore, FeedbackThread, FeedbackComment } from './types';

const STORE_FILENAME = 'agent-notes.json';
const BACKUP_SUFFIX = '.backup.json';

/** UUID v4 regex */
export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function emptyStore(): FeedbackStore {
  return {
    version: 1,
    threads: [],
    lastBackup: new Date().toISOString(),
  };
}

export function storePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vscode', STORE_FILENAME);
}

export function backupPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vscode', STORE_FILENAME.replace('.json', BACKUP_SUFFIX));
}

// --- Async I/O (primary API for extension + MCP server) ---

/** Read store from disk asynchronously. Returns empty store if file does not exist. */
export async function readStoreAsync(workspaceRoot: string): Promise<FeedbackStore> {
  const filePath = storePath(workspaceRoot);
  try {
    await fsp.access(filePath);
  } catch {
    return emptyStore();
  }

  const raw = await fsp.readFile(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as FeedbackStore;
    validateStore(parsed);
    return parsed;
  } catch {
    // Attempt backup recovery
    return recoverFromBackup(workspaceRoot);
  }
}

async function recoverFromBackup(workspaceRoot: string): Promise<FeedbackStore> {
  const bp = backupPath(workspaceRoot);
  try {
    await fsp.access(bp);
    const backup = JSON.parse(await fsp.readFile(bp, 'utf-8')) as FeedbackStore;
    validateStore(backup); // P1 fix: validate backup too
    return backup;
  } catch {
    return emptyStore();
  }
}

/** Write store to disk atomically (write temp, rename). Async version. */
export async function writeStoreAsync(workspaceRoot: string, store: FeedbackStore): Promise<void> {
  const dir = path.join(workspaceRoot, '.vscode');
  await fsp.mkdir(dir, { recursive: true });

  const filePath = storePath(workspaceRoot);
  const tempPath = filePath + '.tmp';
  const json = JSON.stringify(store, null, 2);

  await fsp.writeFile(tempPath, json, 'utf-8');
  await fsp.rename(tempPath, filePath);

  // Write backup atomically too (>30s since last backup)
  const lastBackup = new Date(store.lastBackup).getTime();
  if (Date.now() - lastBackup > 30_000) {
    store.lastBackup = new Date().toISOString();
    const bp = backupPath(workspaceRoot);
    const bpTemp = bp + '.tmp';
    await fsp.writeFile(bpTemp, JSON.stringify(store, null, 2), 'utf-8');
    await fsp.rename(bpTemp, bp);
  }
}

// --- Debounced write for extension host (prevents per-keystroke disk writes) ---

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: { workspaceRoot: string; store: FeedbackStore } | null = null;

/** Schedule a debounced write (300ms). Immediate writes flush any pending. */
export function scheduleWrite(workspaceRoot: string, store: FeedbackStore): void {
  pendingWrite = { workspaceRoot, store };
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    flushWrite();
  }, 300);
}

/** Flush any pending debounced write immediately. */
export async function flushWrite(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (pendingWrite) {
    const { workspaceRoot, store } = pendingWrite;
    pendingWrite = null;
    await writeStoreAsync(workspaceRoot, store);
  }
}

// --- Sync I/O (kept for backward compat with tests and initial load) ---

/** Read store from disk synchronously. Returns empty store if file does not exist. */
export function readStore(workspaceRoot: string): FeedbackStore {
  const filePath = storePath(workspaceRoot);
  if (!fs.existsSync(filePath)) {
    return emptyStore();
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as FeedbackStore;
    validateStore(parsed);
    return parsed;
  } catch {
    // Attempt backup recovery with validation
    const bp = backupPath(workspaceRoot);
    if (fs.existsSync(bp)) {
      try {
        const backup = JSON.parse(fs.readFileSync(bp, 'utf-8')) as FeedbackStore;
        validateStore(backup);
        return backup;
      } catch {
        return emptyStore();
      }
    }
    return emptyStore();
  }
}

/** Write store synchronously — only used in tests. Extension should use writeStoreAsync or scheduleWrite. */
export function writeStore(workspaceRoot: string, store: FeedbackStore): void {
  const dir = path.join(workspaceRoot, '.vscode');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = storePath(workspaceRoot);
  const tempPath = filePath + '.tmp';
  const json = JSON.stringify(store, null, 2);

  fs.writeFileSync(tempPath, json, 'utf-8');
  fs.renameSync(tempPath, filePath);

  // Write backup atomically too
  const lastBackup = new Date(store.lastBackup).getTime();
  if (Date.now() - lastBackup > 30_000) {
    store.lastBackup = new Date().toISOString();
    const bp = backupPath(workspaceRoot);
    const bpTemp = bp + '.tmp';
    fs.writeFileSync(bpTemp, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(bpTemp, bp);
  }
}

// --- Mutators (use async writes) ---

/** Add a thread to the store and persist asynchronously. */
export function addThread(workspaceRoot: string, store: FeedbackStore, thread: FeedbackThread): void {
  store.threads.push(thread);
  scheduleWrite(workspaceRoot, store);
}

/** Delete a thread by ID from the store and persist asynchronously. Returns true if found. */
export function deleteThread(workspaceRoot: string, store: FeedbackStore, threadId: string): boolean {
  const idx = store.threads.findIndex(t => t.id === threadId);
  if (idx === -1) {
    return false;
  }
  store.threads.splice(idx, 1);
  scheduleWrite(workspaceRoot, store);
  return true;
}

/** Update a thread in place and persist asynchronously. Returns true if found. */
export function updateThread(workspaceRoot: string, store: FeedbackStore, thread: FeedbackThread): boolean {
  const idx = store.threads.findIndex(t => t.id === thread.id);
  if (idx === -1) {
    return false;
  }
  store.threads[idx] = thread;
  scheduleWrite(workspaceRoot, store);
  return true;
}

// --- Validation ---

export class ValidationError extends Error {}

/** Validate a FeedbackStore structure. Throws ValidationError on violation. */
export function validateStore(store: FeedbackStore): void {
  if (typeof store.version !== 'number' || store.version < 1) {
    throw new ValidationError('version must be a positive integer');
  }
  if (!Array.isArray(store.threads)) {
    throw new ValidationError('threads must be an array');
  }
  for (const thread of store.threads) {
    validateThread(thread);
  }
}

export function validateThread(thread: FeedbackThread): void {
  if (!UUID_V4_RE.test(thread.id)) {
    throw new ValidationError(`thread.id is not a valid UUID v4: ${thread.id}`);
  }
  if (typeof thread.uri !== 'string' || thread.uri.length === 0) {
    throw new ValidationError('thread.uri must be a non-empty string');
  }
  if (path.isAbsolute(thread.uri)) {
    throw new ValidationError('thread.uri must be workspace-relative (no absolute paths)');
  }
  validateRange(thread);
  if (!Array.isArray(thread.comments) || thread.comments.length === 0) {
    throw new ValidationError('thread.comments must have at least one entry');
  }
  if (typeof thread.selectedText !== 'string' || thread.selectedText.length === 0) {
    throw new ValidationError('thread.selectedText must be non-empty');
  }
  for (const comment of thread.comments) {
    validateComment(comment);
  }
}

export function validateRange(thread: FeedbackThread): void {
  const r = thread.range;
  if (r.startLine < 0 || r.endLine < 0 || r.startCharacter < 0 || r.endCharacter < 0) {
    throw new ValidationError('range values must be non-negative');
  }
  if (r.startLine > r.endLine) {
    throw new ValidationError('range.startLine must be <= endLine');
  }
}

export function validateComment(comment: FeedbackComment): void {
  if (!UUID_V4_RE.test(comment.id)) {
    throw new ValidationError(`comment.id is not a valid UUID v4: ${comment.id}`);
  }
  if (typeof comment.body !== 'string' || comment.body.trim().length === 0) {
    throw new ValidationError('comment.body must be non-empty');
  }
}
