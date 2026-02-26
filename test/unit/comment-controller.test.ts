/**
 * Unit tests for CommentController logic (non-VSCode parts).
 * VSCode API integration is tested in test/integration/extension.test.ts.
 *
 * These tests validate: thread creation logic, range handling, comment store integration.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { emptyStore, addThread, deleteThread, readStore, flushWrite } from '../../src/comment-store';
import { FeedbackThread, FeedbackComment } from '../../src/types';

function makeComment(body: string): FeedbackComment {
  return {
    id: '87654321-4321-4321-8321-210987654321',
    body,
    author: 'developer',
    createdAt: new Date().toISOString(),
  };
}

function makeThread(id: string, uri: string): FeedbackThread {
  return {
    id,
    uri,
    range: { startLine: 5, startCharacter: 0, endLine: 10, endCharacter: 20 },
    selectedText: 'function foo() {}',
    contextBefore: '// before',
    contextAfter: '// after',
    contentHash: 'abc123',
    comments: [makeComment('Initial feedback comment')],
  };
}

describe('comment-controller (store integration)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-ctrl-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stores a thread with correct range and comment body', async () => {
    const store = emptyStore();
    const thread = makeThread('12345678-1234-4234-8234-123456789012', 'src/auth.ts');
    addThread(tmpDir, store, thread);
    await flushWrite();

    const loaded = readStore(tmpDir);
    assert.strictEqual(loaded.threads.length, 1);
    const t = loaded.threads[0];
    assert.strictEqual(t.range.startLine, 5);
    assert.strictEqual(t.range.endLine, 10);
    assert.strictEqual(t.comments[0].body, 'Initial feedback comment');
    assert.strictEqual(t.uri, 'src/auth.ts');
  });

  it('stores selectedText and contextBefore/contextAfter', async () => {
    const store = emptyStore();
    const thread = makeThread('12345678-1234-4234-8234-123456789012', 'src/auth.ts');
    addThread(tmpDir, store, thread);
    await flushWrite();

    const loaded = readStore(tmpDir);
    assert.strictEqual(loaded.threads[0].selectedText, 'function foo() {}');
    assert.strictEqual(loaded.threads[0].contextBefore, '// before');
    assert.strictEqual(loaded.threads[0].contextAfter, '// after');
  });

  it('removes thread from store on delete', async () => {
    const store = emptyStore();
    const thread = makeThread('12345678-1234-4234-8234-123456789012', 'src/auth.ts');
    addThread(tmpDir, store, thread);
    await flushWrite();
    deleteThread(tmpDir, store, thread.id);
    await flushWrite();

    const loaded = readStore(tmpDir);
    assert.strictEqual(loaded.threads.length, 0);
  });

  it('handles multiple threads for different files', async () => {
    const store = emptyStore();
    addThread(tmpDir, store, makeThread('12345678-1234-4234-8234-123456789012', 'src/auth.ts'));
    addThread(tmpDir, store, makeThread('87654321-4321-4321-8321-210987654321', 'src/utils.ts'));
    await flushWrite();

    const loaded = readStore(tmpDir);
    assert.strictEqual(loaded.threads.length, 2);
    const uris = loaded.threads.map(t => t.uri);
    assert.ok(uris.includes('src/auth.ts'));
    assert.ok(uris.includes('src/utils.ts'));
  });

  it('appends reply to thread comments', async () => {
    const store = emptyStore();
    const thread = makeThread('12345678-1234-4234-8234-123456789012', 'src/auth.ts');
    addThread(tmpDir, store, thread);
    await flushWrite();

    // Simulate reply: load, push comment, save
    const loaded = readStore(tmpDir);
    const t = loaded.threads[0];
    t.comments.push({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      body: 'This is a reply',
      author: 'developer',
      createdAt: new Date().toISOString(),
    });
    // Update the in-memory store and write
    const idx = store.threads.findIndex(x => x.id === t.id);
    store.threads[idx] = t;
    const { writeStore } = require('../../src/comment-store');
    writeStore(tmpDir, store);

    const reloaded = readStore(tmpDir);
    assert.strictEqual(reloaded.threads[0].comments.length, 2);
    assert.strictEqual(reloaded.threads[0].comments[1].body, 'This is a reply');
  });
});
