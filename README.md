# cctree

`tree` meets `git log` for your [Claude Code](https://claude.com/claude-code) history.

Scans `~/.claude/projects/` and prints a structured overview of your projects, sessions, and stats.

```
📁 myapp (/Users/ward/src/myapp)
│  3 sessions · last active 2h ago · $2.47
│
├── ● cctree-v1 (c7eb0015)
│   Mar 17 22:35 · main · claude-opus-4-6 · v2.1.77
│   12 messages · 3 subagents · 1 PR
│   "Can you look at 2025-03-17-PLAN-v1.md for..."
│
└── ○ sunny-hatching-neumann (a1b2c3d4)
    Mar 16 14:20 · feature/auth · claude-sonnet-4-6 · v2.1.77
    34 messages
    "Add OAuth2 login flow for the mobile app"
```

## Install

```sh
npm install -g cctree
```

## Usage

```sh
cctree                        # tree view of all projects
cctree --json                 # JSON output
cctree --project myapp        # filter by project name
cctree -n 3                   # limit to 3 most recent sessions per project
```

## Library

```ts
import { scan } from 'cctree';

const projects = await scan();

for (const project of projects) {
  console.log(project.directory, project.sessions.length);
}
```

## License

MIT
