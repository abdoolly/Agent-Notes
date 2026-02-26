import * as assert from 'assert';
import { formatDiagnosticMessage } from '../../src/diagnostic-formatter';
import { FeedbackThread, FeedbackComment } from '../../src/types';

function makeComment(overrides: Partial<FeedbackComment> = {}): FeedbackComment {
  return {
    id: '87654321-4321-4321-8321-210987654321',
    body: 'Test comment',
    author: 'developer',
    createdAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

function makeThread(overrides: Partial<FeedbackThread> = {}): FeedbackThread {
  return {
    id: '12345678-1234-4234-8234-123456789012',
    uri: 'src/auth.ts',
    range: { startLine: 5, startCharacter: 0, endLine: 5, endCharacter: 20 },
    selectedText: 'function authenticate()',
    contextBefore: '',
    contextAfter: '',
    contentHash: 'abc123',
    comments: [makeComment()],
    ...overrides,
  };
}

describe('diagnostics', () => {
  describe('formatDiagnosticMessage', () => {
    it('formats a single-comment thread', () => {
      const thread = makeThread();
      const message = formatDiagnosticMessage(thread);

      assert.ok(message.includes('[Feedback]'));
      assert.ok(message.includes('developer'));
      assert.ok(message.includes('Test comment'));
      assert.ok(message.includes('On: "function authenticate()"'));
      assert.ok(!message.includes('[Reply]'));
      assert.ok(!message.includes('---'));
    });

    it('formats a multi-reply thread', () => {
      const thread = makeThread({
        comments: [
          makeComment({ body: 'Consider error handling here', author: 'reviewer' }),
          makeComment({
            id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            body: 'Good point, will fix',
            author: 'developer',
            createdAt: '2026-01-15T11:00:00.000Z',
          }),
          makeComment({
            id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
            body: 'Fixed in latest commit',
            author: 'developer',
            createdAt: '2026-01-15T12:00:00.000Z',
          }),
        ],
      });
      const message = formatDiagnosticMessage(thread);

      assert.ok(message.includes('[Feedback] reviewer'));
      assert.ok(message.includes('Consider error handling here'));
      assert.ok(message.includes('On: "function authenticate()"'));
      assert.ok(message.includes('---'));
      assert.ok(message.includes('[Reply] developer'));
      assert.ok(message.includes('Good point, will fix'));
      assert.ok(message.includes('Fixed in latest commit'));
    });

    it('formats an orphaned thread with [ORPHANED] prefix', () => {
      const thread = makeThread({ orphaned: true });
      const message = formatDiagnosticMessage(thread);

      assert.ok(message.startsWith('[ORPHANED] [Feedback]'));
    });

    it('does not include [ORPHANED] for non-orphaned threads', () => {
      const thread = makeThread({ orphaned: false });
      const message = formatDiagnosticMessage(thread);

      assert.ok(!message.includes('[ORPHANED]'));
    });

    it('includes selected text in On: line', () => {
      const thread = makeThread({ selectedText: 'const x = 42;' });
      const message = formatDiagnosticMessage(thread);

      assert.ok(message.includes('On: "const x = 42;"'));
    });

    it('uses --- separator between replies', () => {
      const thread = makeThread({
        comments: [
          makeComment(),
          makeComment({
            id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            body: 'Reply 1',
          }),
        ],
      });
      const message = formatDiagnosticMessage(thread);

      const lines = message.split('\n');
      const separatorIndex = lines.indexOf('---');
      assert.ok(separatorIndex > 0, 'Should have a --- separator');
      assert.ok(lines[separatorIndex + 1].startsWith('[Reply]'));
    });

    it('includes resolve instruction with thread ID', () => {
      const thread = makeThread();
      const message = formatDiagnosticMessage(thread);

      assert.ok(message.includes('[Resolve]'));
      assert.ok(message.includes('12345678-1234-4234-8234-123456789012'));
      assert.ok(message.includes('.vscode/agent-notes.json'));
    });
  });
});
