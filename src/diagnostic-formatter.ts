/**
 * Pure formatting logic for diagnostic messages.
 * No VS Code dependency — testable outside the extension host.
 */

import { FeedbackThread } from './types';

/** Format a thread into a plain-text diagnostic message. */
export function formatDiagnosticMessage(thread: FeedbackThread): string {
  const firstComment = thread.comments[0];
  const replies = thread.comments.slice(1);

  const prefix = thread.orphaned ? '[ORPHANED] ' : '';
  const header = `${prefix}[Feedback] ${firstComment.author} (${formatDate(firstComment.createdAt)}): ${firstComment.body}`;
  const anchor = `On: "${thread.selectedText}"`;

  const parts = [header, anchor];

  for (const reply of replies) {
    parts.push('---');
    parts.push(`[Reply] ${reply.author} (${formatDate(reply.createdAt)}): ${reply.body}`);
  }

  parts.push('');
  parts.push(`[Resolve] After addressing this feedback, resolve it by removing the thread object with "id": "${thread.id}" from the "threads" array in .vscode/agent-notes.json`);

  return parts.join('\n');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
