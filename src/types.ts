export interface ProjectInfo {
  /** Raw path-slug from filesystem (e.g. "-Users-ward-src-myapp") */
  slug: string;
  /** Resolved real directory path, or null if lookup failed */
  directory: string | null;
  sessions: SessionInfo[];
  /** ISO timestamp of most recent activity across all sessions */
  lastActive: string | null;
  /** Cost of the last session in USD, from ~/.claude.json */
  lastCost: number | null;
}

export interface SessionInfo {
  /** Full session UUID */
  id: string;
  /** Display name: customTitle > slug > short UUID */
  name: string;
  /** Auto-generated 3-word slug (e.g. "crispy-discovering-dewdrop") */
  slug: string | null;
  /** User-set title via /rename, if any */
  customTitle: string | null;
  /** Last user message content, truncated */
  lastPrompt: string | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  gitBranch: string | null;
  /** Model used in the last assistant message */
  model: string | null;
  /** Count of real human prompts (excludes tool results and compaction summaries) */
  userMessageCount: number;
  assistantMessageCount: number;
  /** Number of subagent JSONL files in the session's subagents/ dir */
  subagentCount: number;
  /** Subagent descriptions from .meta.json files */
  subagents: SubagentInfo[];
  /** PRs created or linked during the session */
  prLinks: PrLink[];
  /** Conversation summary from a summary entry, if present */
  summary: string | null;
  /** Claude Code version string */
  version: string | null;
  /** Total accumulated turn duration in ms (from system/turn_duration entries) */
  totalDurationMs: number;
  /** Whether this session's PID is currently running */
  isActive: boolean;
}

export interface SubagentInfo {
  /** e.g. "general-purpose", "Explore" */
  agentType: string;
  /** e.g. "Analyze nelson repo thoroughly" */
  description: string | null;
}

export interface PrLink {
  number: number;
  url: string;
  repo: string;
}

/** Shape of the relevant parts of ~/.claude.json */
export interface ClaudeConfig {
  projects?: Record<
    string,
    {
      lastSessionId?: string;
      lastCost?: number;
      lastAPIDuration?: number;
      lastLinesAdded?: number;
      lastLinesRemoved?: number;
      lastModelUsage?: Record<
        string,
        {
          inputTokens?: number;
          outputTokens?: number;
          cacheReadInputTokens?: number;
          cacheCreationInputTokens?: number;
          costUSD?: number;
        }
      >;
      exampleFiles?: string[];
      [key: string]: unknown;
    }
  >;
}

/** Shape of sessions-index.json */
export interface SessionsIndex {
  version: number;
  entries: SessionsIndexEntry[];
  originalPath: string;
}

export interface SessionsIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  lastPrompt?: string;
  summary?: string;
  messageCount?: number;
  created?: string;
  modified?: string;
  gitBranch?: string;
  projectPath?: string;
  isSidechain?: boolean;
}

/** Shape of ~/.claude/sessions/{pid}.json */
export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
}

/** Result from parsing a single JSONL session file */
export interface SessionParseResult {
  slug: string | null;
  customTitle: string | null;
  lastPrompt: string | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  gitBranch: string | null;
  model: string | null;
  userMessageCount: number;
  assistantMessageCount: number;
  prLinks: PrLink[];
  summary: string | null;
  version: string | null;
  totalDurationMs: number;
}
