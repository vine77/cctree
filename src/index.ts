#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { scan } from './lib.js';
import { formatTree } from './format.js';

const { values } = parseArgs({
  options: {
    path: { type: 'string', short: 'p' },
    limit: { type: 'string', short: 'n' },
    json: { type: 'boolean' },
    project: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
  strict: false,
});

if (values.help) {
  console.log(`cctree — Claude Code Session Browser

Usage: cctree [options]

Options:
  -p, --path <dir>     Override ~/.claude location
  -n, --limit <N>      Show only N most recent sessions per project (default: all)
  --json               Output as JSON instead of formatted tree
  --project <slug>     Filter to a specific project (partial match on slug or directory)
  -h, --help           Show help
  -v, --version        Show version`);
  process.exit(0);
}

if (values.version) {
  try {
    const pkg = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf-8'),
    );
    console.log(pkg.version);
  } catch {
    console.log('unknown');
  }
  process.exit(0);
}

const claudeDir =
  typeof values.path === 'string' ? values.path : join(homedir(), '.claude');
const limit =
  typeof values.limit === 'string' ? parseInt(values.limit, 10) : undefined;
const projectFilter =
  typeof values.project === 'string' ? values.project : undefined;

const projects = await scan({ claudeDir, limit, projectFilter });

if (values.json) {
  console.log(JSON.stringify({ projects }, null, 2));
} else {
  console.log(formatTree(projects));
}
