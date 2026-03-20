import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { PrLink, SessionParseResult } from './types.js';

export async function parseSession(
  filepath: string,
): Promise<SessionParseResult> {
  const rl = createInterface({ input: createReadStream(filepath) });

  const result: SessionParseResult = {
    slug: null,
    customTitle: null,
    lastPrompt: null,
    firstTimestamp: null,
    lastTimestamp: null,
    gitBranch: null,
    model: null,
    userMessageCount: 0,
    assistantMessageCount: 0,
    prLinks: [],
    summary: null,
    version: null,
    totalDurationMs: 0,
  };

  const seenPrUrls = new Set<string>();

  for await (const line of rl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // Track timestamps from any entry that has one
    if (entry.timestamp) {
      if (!result.firstTimestamp) result.firstTimestamp = entry.timestamp;
      result.lastTimestamp = entry.timestamp;
    }

    // slug appears on assistant and system entries, NOT user entries
    if (entry.slug && !result.slug) result.slug = entry.slug;
    if (entry.gitBranch && !result.gitBranch) result.gitBranch = entry.gitBranch;
    if (entry.version && !result.version) result.version = entry.version;

    switch (entry.type) {
      case 'user':
        if (entry.isCompactSummary) break;
        if (entry.toolUseResult) break;
        result.userMessageCount++;
        {
          const content = entry.message?.content;
          let raw: string | null = null;
          if (typeof content === 'string') {
            raw = content;
          } else if (Array.isArray(content)) {
            const text = content.find(
              (b: { type: string }) => b.type === 'text',
            );
            if (text) raw = text.text;
          }
          if (raw) {
            // Strip XML tags (e.g. <local-command-caveat>...</local-command-caveat>)
            const cleaned = raw.replace(/<[^>]+>/g, '').trim();
            if (cleaned) result.lastPrompt = cleaned.slice(0, 200);
          }
        }
        break;
      case 'assistant':
        result.assistantMessageCount++;
        if (entry.message?.model) result.model = entry.message.model;
        break;
      case 'system':
        if (
          entry.subtype === 'turn_duration' &&
          typeof entry.durationMs === 'number'
        ) {
          result.totalDurationMs += entry.durationMs;
        }
        break;
      case 'custom-title':
        result.customTitle = entry.customTitle ?? null;
        break;
      case 'summary':
        result.summary = entry.summary ?? null;
        break;
      case 'pr-link':
        if (entry.prUrl && !seenPrUrls.has(entry.prUrl)) {
          seenPrUrls.add(entry.prUrl);
          result.prLinks.push({
            number: entry.prNumber,
            url: entry.prUrl,
            repo: entry.prRepository,
          } as PrLink);
        }
        break;
      // Skip: progress, file-history-snapshot, last-prompt, queue-operation, agent-name, saved_hook_context
    }
  }

  return result;
}
