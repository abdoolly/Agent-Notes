import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  emptyStore,
  readStore,
  writeStore,
  addThread,
  deleteThread,
  updateThread,
  flushWrite,
  validateStore,
  validateThread,
  validateComment,
  ValidationError,
  storePath,
  backupPath,
} from '../../src/comment-store';
import { FeedbackStore, FeedbackThread, FeedbackComment } from '../../src/types';

function makeThread(overrides: Partial<FeedbackThread> = {}): FeedbackThread {
  return {
    id: '12345678-1234-4234-8234-123456789012',
    uri: 'src/auth.ts',
    range: { startLine: 0, startCharacter: 0, endLine: 1, endCharacter: 10 },
    selectedText: 'function foo() {}',
    contextBefore: '',
    contextAfter: '',
    contentHash: 'abc123',
    comments: [makeComment()],
    ...overrides,
  };
}

function makeComment(overrides: Partial<FeedbackComment> = {}): FeedbackComment {
  return {
    id: '87654321-4321-4321-8321-210987654321',
    body: 'Test comment',
    author: 'developer',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('comment-store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-notes-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('emptyStore', () => {
    it('returns a valid empty store', () => {
      const store = emptyStore();
      assert.strictEqual(store.version, 1);
      assert.deepStrictEqual(store.threads, []);
      assert.ok(store.lastBackup);
    });
  });

  describe('readStore', () => {
    it('returns empty store when file does not exist', () => {
      const store = readStore(tmpDir);
      assert.strictEqual(store.version, 1);
      assert.deepStrictEqual(store.threads, []);
    });

    it('reads and parses an existing store', () => {
      const vscodeDir = path.join(tmpDir, '.vscode');
      fs.mkdirSync(vscodeDir);
      const expected: FeedbackStore = {
        version: 1,
        threads: [makeThread()],
        lastBackup: new Date().toISOString(),
      };
      fs.writeFileSync(storePath(tmpDir), JSON.stringify(expected, null, 2), 'utf-8');
      const store = readStore(tmpDir);
      assert.strictEqual(store.version, 1);
      assert.strictEqual(store.threads.length, 1);
      assert.strictEqual(store.threads[0].id, expected.threads[0].id);
    });

    it('recovers from corrupted file using backup', () => {
      const vscodeDir = path.join(tmpDir, '.vscode');
      fs.mkdirSync(vscodeDir);
      fs.writeFileSync(storePath(tmpDir), 'not valid json', 'utf-8');
      const backup: FeedbackStore = {
        version: 1,
        threads: [makeThread()],
        lastBackup: new Date(Date.now() - 60000).toISOString(),
      };
      fs.writeFileSync(backupPath(tmpDir), JSON.stringify(backup, null, 2), 'utf-8');
      const store = readStore(tmpDir);
      assert.strictEqual(store.threads.length, 1);
    });

    it('returns empty store when corrupted and no backup', () => {
      const vscodeDir = path.join(tmpDir, '.vscode');
      fs.mkdirSync(vscodeDir);
      fs.writeFileSync(storePath(tmpDir), '{bad json', 'utf-8');
      const store = readStore(tmpDir);
      assert.deepStrictEqual(store.threads, []);
    });
  });

  describe('writeStore / addThread / deleteThread', () => {
    it('creates .vscode dir if missing and writes store', () => {
      const store = emptyStore();
      writeStore(tmpDir, store);
      assert.ok(fs.existsSync(storePath(tmpDir)));
    });

    it('adds a thread and persists it', async () => {
      const store = emptyStore();
      const thread = makeThread();
      addThread(tmpDir, store, thread);
      await flushWrite();
      const reloaded = readStore(tmpDir);
      assert.strictEqual(reloaded.threads.length, 1);
      assert.strictEqual(reloaded.threads[0].id, thread.id);
    });

    it('deletes a thread and persists', async () => {
      const store = emptyStore();
      const thread = makeThread();
      addThread(tmpDir, store, thread);
      await flushWrite();
      const deleted = deleteThread(tmpDir, store, thread.id);
      await flushWrite();
      assert.strictEqual(deleted, true);
      const reloaded = readStore(tmpDir);
      assert.strictEqual(reloaded.threads.length, 0);
    });

    it('returns false when deleting non-existent thread', () => {
      const store = emptyStore();
      const result = deleteThread(tmpDir, store, 'does-not-exist');
      assert.strictEqual(result, false);
    });

    it('updates a thread and persists', async () => {
      const store = emptyStore();
      const thread = makeThread();
      addThread(tmpDir, store, thread);
      await flushWrite();
      const updated = { ...thread, comments: [...thread.comments, makeComment({ body: 'Reply', id: '11111111-1111-4111-8111-111111111111' })] };
      const result = updateThread(tmpDir, store, updated);
      await flushWrite();
      assert.strictEqual(result, true);
      const reloaded = readStore(tmpDir);
      assert.strictEqual(reloaded.threads[0].comments.length, 2);
    });
  });

  describe('validateStore', () => {
    it('validates a valid store without throwing', () => {
      const store: FeedbackStore = {
        version: 1,
        threads: [makeThread()],
        lastBackup: new Date().toISOString(),
      };
      assert.doesNotThrow(() => validateStore(store));
    });

    it('throws for invalid version', () => {
      const store = { version: 0, threads: [], lastBackup: '' } as unknown as FeedbackStore;
      assert.throws(() => validateStore(store), ValidationError);
    });

    it('throws for non-array threads', () => {
      const store = { version: 1, threads: null, lastBackup: '' } as unknown as FeedbackStore;
      assert.throws(() => validateStore(store), ValidationError);
    });
  });

  describe('validateThread', () => {
    it('throws for invalid UUID', () => {
      const thread = makeThread({ id: 'not-a-uuid' });
      assert.throws(() => validateThread(thread), ValidationError);
    });

    it('throws for absolute uri', () => {
      const thread = makeThread({ uri: '/absolute/path/file.ts' });
      assert.throws(() => validateThread(thread), ValidationError);
    });

    it('throws for empty selectedText', () => {
      const thread = makeThread({ selectedText: '' });
      assert.throws(() => validateThread(thread), ValidationError);
    });

    it('throws for empty comments array', () => {
      const thread = makeThread({ comments: [] });
      assert.throws(() => validateThread(thread), ValidationError);
    });

    it('throws for invalid range (startLine > endLine)', () => {
      const thread = makeThread({ range: { startLine: 5, startCharacter: 0, endLine: 3, endCharacter: 0 } });
      assert.throws(() => validateThread(thread), ValidationError);
    });
  });

  describe('validateComment', () => {
    it('throws for empty body', () => {
      const comment = makeComment({ body: '   ' });
      assert.throws(() => validateComment(comment), ValidationError);
    });

    it('throws for invalid UUID in comment', () => {
      const comment = makeComment({ id: 'bad-id' });
      assert.throws(() => validateComment(comment), ValidationError);
    });
  });
});
