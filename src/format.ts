import type { ProjectInfo, SessionInfo } from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

function color(code: string, text: string): string {
  return useColor ? `${code}${text}${c.reset}` : text;
}

export function formatTree(projects: ProjectInfo[]): string {
  if (projects.length === 0) return 'No projects found.';

  const lines: string[] = [];

  for (const project of projects) {
    // Project header
    const dirLabel = project.directory
      ? ` (${project.directory})`
      : '';
    lines.push(
      color(c.bold, `📁 ${project.name}`) + color(c.dim, dirLabel),
    );

    const sessionCount = project.sessions.length;
    const lastActiveStr = project.lastActive
      ? relativeTime(project.lastActive)
      : 'never';
    const costStr =
      project.lastCost != null && project.lastCost > 0
        ? ` · $${project.lastCost.toFixed(2)}`
        : '';
    lines.push(
      color(
        c.dim,
        `│  ${sessionCount} session${sessionCount !== 1 ? 's' : ''} · last active ${lastActiveStr}${costStr}`,
      ),
    );
    lines.push(color(c.dim, '│'));

    // Sessions
    for (let i = 0; i < project.sessions.length; i++) {
      const session = project.sessions[i];
      const isLast = i === project.sessions.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const continuation = isLast ? '    ' : '│   ';

      lines.push(...formatSession(session, prefix, continuation));

      if (!isLast) lines.push(color(c.dim, '│'));
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatSession(
  session: SessionInfo,
  prefix: string,
  continuation: string,
): string[] {
  const lines: string[] = [];
  const shortId = session.id.slice(0, 8);

  // Line 1: status + name + short ID
  const dot = session.isActive
    ? color(c.green, '●')
    : color(c.dim, '○');
  const name = session.isActive
    ? color(c.bold, session.name)
    : session.name;

  lines.push(`${prefix}${dot} ${name} ${color(c.dim, `(${shortId})`)}`);

  // Line 2: date, branch, model, version
  const parts: string[] = [];
  if (session.lastTimestamp) {
    parts.push(formatDate(session.lastTimestamp));
  }
  if (session.gitBranch) parts.push(session.gitBranch);
  if (session.model) parts.push(session.model);
  if (session.version) parts.push(`v${session.version}`);
  lines.push(
    color(c.dim, continuation) + color(c.cyan, parts.join(' · ')),
  );

  // Line 3: stats
  const stats: string[] = [];
  stats.push(
    `${session.userMessageCount} message${session.userMessageCount !== 1 ? 's' : ''}`,
  );
  if (session.subagentCount > 0) {
    stats.push(
      `${session.subagentCount} subagent${session.subagentCount !== 1 ? 's' : ''}`,
    );
  }
  if (session.prLinks.length > 0) {
    stats.push(
      `${session.prLinks.length} PR${session.prLinks.length !== 1 ? 's' : ''}`,
    );
  }
  if (session.totalDurationMs > 0) {
    stats.push(formatDuration(session.totalDurationMs));
  }
  lines.push(color(c.dim, continuation) + stats.join(' · '));

  // Line 4: first prompt (truncated)
  if (session.lastPrompt) {
    const truncated =
      session.lastPrompt.length > 80
        ? session.lastPrompt.slice(0, 77) + '...'
        : session.lastPrompt;
    // Replace newlines with spaces for display
    const oneline = truncated.replace(/\n/g, ' ');
    lines.push(
      color(c.dim, continuation) + color(c.dim, `"${oneline}"`),
    );
  }

  return lines;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()} ${hours}:${mins}`;
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
