/**
 * Auto-manages .gitignore to ensure .vscode/agent-notes.json is excluded.
 * FR-016: Add storage file to .gitignore automatically on extension activation.
 */

import * as fs from 'fs';
import * as path from 'path';

const GITIGNORE_ENTRY = '.vscode/agent-notes.json';

export function ensureGitignored(workspaceRoot: string): void {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${GITIGNORE_ENTRY}\n`, 'utf-8');
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim());

  if (lines.includes(GITIGNORE_ENTRY)) {
    return; // Already present
  }

  const newContent = content.endsWith('\n')
    ? content + GITIGNORE_ENTRY + '\n'
    : content + '\n' + GITIGNORE_ENTRY + '\n';

  fs.writeFileSync(gitignorePath, newContent, 'utf-8');
}
