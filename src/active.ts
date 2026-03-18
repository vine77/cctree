import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ActiveSession } from './types.js';

/**
 * Returns a Set of session IDs that are currently running
 * by checking ~/.claude/sessions/*.json and verifying PIDs are alive.
 */
export async function getActiveSessions(
  claudeDir: string,
): Promise<Set<string>> {
  const active = new Set<string>();
  const sessionsDir = join(claudeDir, 'sessions');

  let files: string[];
  try {
    files = await readdir(sessionsDir);
  } catch {
    return active;
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(sessionsDir, file), 'utf-8');
      const session = JSON.parse(raw) as ActiveSession;
      if (isPidAlive(session.pid)) {
        active.add(session.sessionId);
      }
    } catch {
      // skip unparseable files
    }
  }

  return active;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
