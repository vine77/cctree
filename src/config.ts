import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ClaudeConfig } from './types.js';

export interface ConfigResult {
  config: ClaudeConfig;
  /** Map from path-slug (e.g. "-Users-ward-src-myapp") to real directory path */
  slugToDir: Map<string, string>;
  /** Map from real directory path to per-project metadata */
  projectMeta: Map<string, { lastCost?: number }>;
}

export async function loadConfig(claudeDir?: string): Promise<ConfigResult> {
  const dir = claudeDir ?? join(homedir(), '.claude');
  // ~/.claude.json is at the HOME root, NOT inside ~/.claude/
  const configPath = join(dir, '..', '.claude.json');

  const slugToDir = new Map<string, string>();
  const projectMeta = new Map<string, { lastCost?: number }>();
  let config: ClaudeConfig = {};

  try {
    const raw = await readFile(configPath, 'utf-8');
    config = JSON.parse(raw) as ClaudeConfig;
  } catch {
    console.error(
      `Warning: ${configPath} not found or malformed, directory paths will not be resolved`,
    );
    return { config, slugToDir, projectMeta };
  }

  if (config.projects) {
    for (const [realPath, meta] of Object.entries(config.projects)) {
      const slug = realPath.replaceAll('.', '-').replaceAll('/', '-');
      slugToDir.set(slug, realPath);
      projectMeta.set(realPath, { lastCost: meta.lastCost });
    }
  }

  return { config, slugToDir, projectMeta };
}

export function resolveDirectory(
  slug: string,
  slugToDir: Map<string, string>,
): string | null {
  return slugToDir.get(slug) ?? null;
}
