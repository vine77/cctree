import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig, resolveDirectory } from './config.js';
import { getActiveSessions } from './active.js';
import { parseSession } from './parser.js';
import type {
  ProjectInfo,
  SessionInfo,
  SubagentInfo,
  SessionsIndex,
} from './types.js';

const UUID_JSONL_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;
const UUID_DIR_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ScanOptions {
  /** Override ~/.claude location. Defaults to ~/.claude */
  claudeDir?: string;
  /** Max sessions per project. Defaults to no limit (all sessions). */
  limit?: number;
  /** Filter to projects matching this string (partial match on slug or directory). */
  projectFilter?: string;
}

export async function scan(options?: ScanOptions): Promise<ProjectInfo[]> {
  const claudeDir = options?.claudeDir ?? join(homedir(), '.claude');
  const projectsDir = join(claudeDir, 'projects');

  // Load config + active sessions in parallel
  const [{ slugToDir, projectMeta }, activeSessions] = await Promise.all([
    loadConfig(claudeDir),
    getActiveSessions(claudeDir),
  ]);

  let projectSlugs: string[];
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectSlugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.error(
      `No Claude Code projects found at ${projectsDir}`,
    );
    process.exit(1);
  }

  // Apply project filter
  if (options?.projectFilter) {
    const filter = options.projectFilter.toLowerCase();
    projectSlugs = projectSlugs.filter((slug) => {
      if (slug.toLowerCase().includes(filter)) return true;
      const dir = resolveDirectory(slug, slugToDir);
      return dir ? dir.toLowerCase().includes(filter) : false;
    });
  }

  const projects: ProjectInfo[] = [];

  for (const slug of projectSlugs) {
    const projectDir = join(projectsDir, slug);

    let dirents: import('node:fs').Dirent[];
    try {
      dirents = await readdir(projectDir, { withFileTypes: true });
    } catch {
      console.error(`Warning: could not read ${projectDir}, skipping`);
      continue;
    }

    // Find session JSONL files
    const jsonlFiles = dirents
      .filter((e: import('node:fs').Dirent) => e.isFile() && UUID_JSONL_RE.test(e.name))
      .map((e: import('node:fs').Dirent) => e.name);

    // Find session directories (UUID-named dirs)
    const sessionDirs = dirents
      .filter((e: import('node:fs').Dirent) => e.isDirectory() && UUID_DIR_RE.test(e.name))
      .map((e: import('node:fs').Dirent) => e.name);

    // Get mtime for each JSONL file for sorting
    const jsonlWithMtime: { file: string; mtime: number }[] = [];
    for (const file of jsonlFiles) {
      try {
        const s = await stat(join(projectDir, file));
        jsonlWithMtime.push({ file, mtime: s.mtimeMs });
      } catch {
        // skip files we can't stat
      }
    }

    // Sort by mtime descending (most recent first)
    jsonlWithMtime.sort((a, b) => b.mtime - a.mtime);

    // Apply limit
    const limited = options?.limit
      ? jsonlWithMtime.slice(0, options.limit)
      : jsonlWithMtime;

    // Parse sessions
    const sessions: SessionInfo[] = [];

    for (const { file } of limited) {
      const sessionId = file.replace('.jsonl', '');
      const filepath = join(projectDir, file);

      try {
        const parsed = await parseSession(filepath);

        // Read subagent info from session directory if it exists
        const { subagentCount, subagents } = await readSubagents(
          projectDir,
          sessionId,
        );

        const displayName =
          parsed.customTitle ?? parsed.slug ?? sessionId.slice(0, 8);

        sessions.push({
          id: sessionId,
          name: displayName,
          slug: parsed.slug,
          customTitle: parsed.customTitle,
          firstPrompt: parsed.firstPrompt,
          firstTimestamp: parsed.firstTimestamp,
          lastTimestamp: parsed.lastTimestamp,
          gitBranch: parsed.gitBranch,
          model: parsed.model,
          userMessageCount: parsed.userMessageCount,
          assistantMessageCount: parsed.assistantMessageCount,
          subagentCount,
          subagents,
          prLinks: parsed.prLinks,
          summary: parsed.summary,
          version: parsed.version,
          totalDurationMs: parsed.totalDurationMs,
          isActive: activeSessions.has(sessionId),
        });
      } catch {
        console.error(`Warning: could not parse ${filepath}, skipping`);
      }
    }

    // Handle orphaned session directories (no sibling .jsonl)
    const jsonlSessionIds = new Set(
      jsonlFiles.map((f) => f.replace('.jsonl', '')),
    );
    const orphanedDirs = sessionDirs.filter((d: string) => !jsonlSessionIds.has(d));

    if (orphanedDirs.length > 0) {
      const indexSessions = await loadSessionsIndex(projectDir);
      for (const dirName of orphanedDirs) {
        const indexed = indexSessions.get(dirName);
        const { subagentCount, subagents } = await readSubagents(
          projectDir,
          dirName,
        );

        sessions.push({
          id: dirName,
          name: indexed?.firstPrompt?.slice(0, 40) ?? dirName.slice(0, 8),
          slug: null,
          customTitle: null,
          firstPrompt: indexed?.firstPrompt ?? null,
          firstTimestamp: indexed?.created ?? null,
          lastTimestamp: indexed?.modified ?? null,
          gitBranch: indexed?.gitBranch ?? null,
          model: null,
          userMessageCount: indexed?.messageCount ?? 0,
          assistantMessageCount: 0,
          subagentCount,
          subagents,
          prLinks: [],
          summary: indexed?.summary ?? null,
          version: null,
          totalDurationMs: 0,
          isActive: activeSessions.has(dirName),
        });
      }
    }

    // Sort sessions by lastTimestamp descending
    sessions.sort((a, b) => {
      if (!a.lastTimestamp && !b.lastTimestamp) return 0;
      if (!a.lastTimestamp) return 1;
      if (!b.lastTimestamp) return -1;
      return b.lastTimestamp.localeCompare(a.lastTimestamp);
    });

    // Resolve directory
    let directory = resolveDirectory(slug, slugToDir);

    // Fallback: try sessions-index.json originalPath
    if (!directory) {
      try {
        const raw = await readFile(
          join(projectDir, 'sessions-index.json'),
          'utf-8',
        );
        const index = JSON.parse(raw) as SessionsIndex;
        if (index.originalPath) directory = index.originalPath;
      } catch {
        // no fallback available
      }
    }

    // Get lastCost from config
    const meta = directory ? projectMeta.get(directory) : undefined;

    const lastActive =
      sessions.length > 0 ? sessions[0].lastTimestamp : null;

    projects.push({
      slug,
      directory,
      sessions,
      lastActive,
      lastCost: meta?.lastCost ?? null,
    });
  }

  // Sort projects by lastActive descending
  projects.sort((a, b) => {
    if (!a.lastActive && !b.lastActive) return 0;
    if (!a.lastActive) return 1;
    if (!b.lastActive) return -1;
    return b.lastActive.localeCompare(a.lastActive);
  });

  return projects;
}

async function readSubagents(
  projectDir: string,
  sessionId: string,
): Promise<{ subagentCount: number; subagents: SubagentInfo[] }> {
  const subagentsDir = join(projectDir, sessionId, 'subagents');
  let files: string[];
  try {
    files = await readdir(subagentsDir);
  } catch {
    return { subagentCount: 0, subagents: [] };
  }

  const jsonlFiles = files.filter((f: string) => f.endsWith('.jsonl'));
  const metaFiles = files.filter((f: string) => f.endsWith('.meta.json'));
  const subagents: SubagentInfo[] = [];

  for (const metaFile of metaFiles) {
    try {
      const raw = await readFile(join(subagentsDir, metaFile), 'utf-8');
      const meta = JSON.parse(raw) as {
        agentType?: string;
        description?: string;
      };
      subagents.push({
        agentType: meta.agentType ?? 'unknown',
        description: meta.description ?? null,
      });
    } catch {
      // skip unparseable meta files
    }
  }

  return { subagentCount: jsonlFiles.length, subagents };
}

async function loadSessionsIndex(
  projectDir: string,
): Promise<Map<string, SessionsIndex['entries'][number]>> {
  const map = new Map<string, SessionsIndex['entries'][number]>();
  try {
    const raw = await readFile(
      join(projectDir, 'sessions-index.json'),
      'utf-8',
    );
    const index = JSON.parse(raw) as SessionsIndex;
    for (const entry of index.entries) {
      map.set(entry.sessionId, entry);
    }
  } catch {
    // no index available
  }
  return map;
}
