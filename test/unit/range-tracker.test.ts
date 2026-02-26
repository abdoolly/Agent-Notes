/**
 * Unit tests for range-tracker logic.
 * Tests the delta computation and orphan detection without VSCode API.
 */

import * as assert from 'assert';
import { FeedbackThread } from '../../src/types';

/** Simulate the range shift logic from range-tracker.ts */
function shiftRange(
  thread: FeedbackThread,
  changeStartLine: number,
  changeEndLine: number,
  addedLines: number,
  removedLines: number,
): FeedbackThread {
  const lineDelta = addedLines - removedLines;

  // Edit is above the thread range — shift it
  if (changeEndLine < thread.range.startLine) {
    return {
      ...thread,
      range: {
        startLine: thread.range.startLine + lineDelta,
        startCharacter: thread.range.startCharacter,
        endLine: thread.range.endLine + lineDelta,
        endCharacter: thread.range.endCharacter,
      },
    };
  }

  // Edit overlaps the range — orphan it if no fuzzy match possible
  const overlaps = changeStartLine <= thread.range.endLine && changeEndLine >= thread.range.startLine;
  if (overlaps) {
    return { ...thread, orphaned: true };
  }

  return thread;
}

function makeThread(startLine: number, endLine: number): FeedbackThread {
  return {
    id: '12345678-1234-4234-8234-123456789012',
    uri: 'src/auth.ts',
    range: { startLine, startCharacter: 0, endLine, endCharacter: 20 },
    selectedText: 'function foo() {}',
    contextBefore: '',
    contextAfter: '',
    contentHash: 'abc123',
    comments: [{ id: '87654321-4321-4321-8321-210987654321', body: 'test', author: 'dev', createdAt: '' }],
  };
}

describe('range-tracker', () => {
  describe('line insertion above range', () => {
    it('shifts range down when lines inserted above', () => {
      const thread = makeThread(15, 22);
      // Insert 5 lines before line 15 (change at line 10, adding 5 lines)
      const result = shiftRange(thread, 10, 10, 5, 0);
      assert.strictEqual(result.range.startLine, 20);
      assert.strictEqual(result.range.endLine, 27);
    });

    it('shifts range up when lines deleted above', () => {
      const thread = makeThread(20, 27);
      // Delete 3 lines above (change at line 5, removing 3)
      const result = shiftRange(thread, 5, 7, 0, 3);
      assert.strictEqual(result.range.startLine, 17);
      assert.strictEqual(result.range.endLine, 24);
    });

    it('does not shift range when edit is below', () => {
      const thread = makeThread(5, 10);
      // Edit at line 15 — below the range
      const result = shiftRange(thread, 15, 15, 2, 0);
      assert.strictEqual(result.range.startLine, 5);
      assert.strictEqual(result.range.endLine, 10);
    });
  });

  describe('edit within range', () => {
    it('marks thread as orphaned when edit overlaps range', () => {
      const thread = makeThread(15, 22);
      // Edit overlaps (change within lines 15-22)
      const result = shiftRange(thread, 17, 19, 1, 3);
      assert.strictEqual(result.orphaned, true);
    });

    it('marks thread as orphaned when entire range deleted', () => {
      const thread = makeThread(15, 22);
      // Delete lines 15-22 entirely
      const result = shiftRange(thread, 15, 22, 0, 8);
      assert.strictEqual(result.orphaned, true);
    });
  });

  describe('edge cases', () => {
    it('handles edit exactly at range start line (overlap)', () => {
      const thread = makeThread(10, 15);
      const result = shiftRange(thread, 10, 10, 2, 0);
      // changeStartLine (10) <= endLine (15) AND changeEndLine (10) >= startLine (10) → overlaps
      assert.strictEqual(result.orphaned, true);
    });

    it('handles single-line range shifted by one line', () => {
      const thread = makeThread(5, 5);
      const result = shiftRange(thread, 3, 3, 1, 0);
      assert.strictEqual(result.range.startLine, 6);
      assert.strictEqual(result.range.endLine, 6);
    });

    it('does not shift when edit is at end line (below)', () => {
      const thread = makeThread(5, 10);
      // Edit at line 11, which is below endLine (10)
      const result = shiftRange(thread, 11, 12, 2, 0);
      assert.strictEqual(result.range.startLine, 5);
      assert.strictEqual(result.range.endLine, 10);
    });
  });
});
