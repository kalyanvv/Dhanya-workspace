// The pure part of the Dhanya progress pane: reading the two files and turning them
// into numbers and words. No drawing and no engine calls live here, so it is easy to test.
import type {NeedItem, Snapshot, Status, Story, CodexRun } from '../types';

export const EPIC_NAMES: Record<string, string> = {
  E0: 'Foundation and pipeline',
  E1: 'Design system and shell',
  E2: 'Accounts and network',
  E3: 'Catalog and pricing',
  E4: 'Shop ordering',
  E5: 'Mill orders and negotiation',
  E6: 'Books',
  E7: 'Credit ledger',
  E8: 'Dashboard',
  E9: 'Documents and exports',
  E10: 'Quality and hardening',
  E11: 'Pilot',
};

const KNOWN: readonly Status[] = ['done', 'in-progress', 'review', 'blocked', 'todo'];

/** Splits the inside of `{ a: 1, b: "x, y" }` into fields. Tolerant: a bad piece is skipped. */
export function parseFields(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  const n = inner.length;
  let i = 0;
  while (i < n) {
    while (i < n && (inner[i] === ' ' || inner[i] === ',' || inner[i] === '\t')) i++;
    const keyStart = i;
    while (i < n && inner[i] !== ':' && inner[i] !== ',') i++;
    if (i >= n || inner[i] !== ':') {
      // Not a "key: value" piece. Skip to the next comma and carry on.
      while (i < n && inner[i] !== ',') i++;
      continue;
    }
    const key = inner.slice(keyStart, i).trim();
    i++; // the colon
    while (i < n && (inner[i] === ' ' || inner[i] === '\t')) i++;
    let value = '';
    const quote = inner[i];
    if (quote === '"') {
      i++;
      while (i < n && inner[i] !== '"') {
        if (inner[i] === '\\' && i + 1 < n) {
          const next = inner[i + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else {
          value += inner[i];
          i++;
        }
      }
      i++; // the closing quote
      while (i < n && inner[i] !== ',') i++;
    } else if (quote === "'") {
      i++;
      while (i < n) {
        if (inner[i] === "'" && inner[i + 1] === "'") {
          value += "'";
          i += 2;
        } else if (inner[i] === "'") {
          break;
        } else {
          value += inner[i];
          i++;
        }
      }
      i++;
      while (i < n && inner[i] !== ',') i++;
    } else {
      const valueStart = i;
      while (i < n && inner[i] !== ',') i++;
      value = inner.slice(valueStart, i).trim();
    }
    if (key) out[key] = value;
  }
  return out;
}

export function normaliseStatus(raw: string): Status {
  const word = raw.trim().toLowerCase();
  return (KNOWN as readonly string[]).includes(word) ? (word as Status) : 'unknown';
}

export function epicOf(id: string): string {
  const match = /^S(\d+)(?:\.|$)/.exec(id);
  return match ? `E${match[1]}` : 'E?';
}

/** Reads the tracker. Only lines like `  - { id: S0.1, ... }` count; every other line is ignored. */
export function parseStories(text: string): Story[] {
  const stories: Story[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*-\s*\{(.*)\}\s*$/.exec(line);
    if (!match) continue;
    const fields = parseFields(match[1] ?? '');
    const id = (fields.id ?? '').trim();
    if (!id) continue;
    const rawStatus = (fields.status ?? '').trim();
    stories.push({
      id,
      title: fields.title ?? '',
      tier: (fields.tier ?? '').trim(),
      status: rawStatus ? normaliseStatus(rawStatus) : 'unknown',
      rawStatus,
      note: fields.note ?? '',
      needsDecision: (fields.needs_decision ?? fields.blocked_by_decision ?? '').trim(),
      epic: epicOf(id),
    });
  }
  return stories;
}

/** Reads the owner's list. Never throws: a bad file gives an empty list and a calm sentence. */
export function parseNeeds(text: string, fileName = 'owner-needs.json'): {
  items: NeedItem[];
  problem: string | null;
} {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      items: [],
      problem: `${fileName} could not be read because it is not valid JSON. Ask Claude to fix it.`,
    };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : null;
  if (list === null) {
    return {
      items: [],
      problem: `${fileName} has no "items" list, so there is nothing to show. Ask Claude to fix it.`,
    };
  }
  const items: NeedItem[] = [];
  list.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    const title = text(item.title);
    if (!title) return;
    items.push({
      id: text(item.id) || `N-${index + 1}`,
      isOpen: text(item.status).toLowerCase() !== 'done',
      title,
      why: text(item.why),
      how: text(item.how),
      when: text(item.when),
    });
  });
  return { items, problem: null };
}

export type Counts = {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  upNext: number;
};

/** A step waits on a decision when it says so and is not finished. */
export function isWaitingOnDecision(story: Story): boolean {
  return story.needsDecision !== '' && story.status !== 'done';
}

export function isBlocked(story: Story): boolean {
  return story.status === 'blocked' || isWaitingOnDecision(story);
}

/** Every step lands in exactly one count, so the four numbers add up to the total. */
export function summarise(stories: readonly Story[]): Counts {
  const counts: Counts = { total: stories.length, done: 0, inProgress: 0, blocked: 0, upNext: 0 };
  for (const story of stories) {
    if (story.status === 'done') counts.done++;
    else if (isBlocked(story)) counts.blocked++;
    else if (story.status === 'in-progress' || story.status === 'review') counts.inProgress++;
    else counts.upNext++; // todo, and any word the pane does not know
  }
  return counts;
}

export type EpicGroup = { id: string; name: string; stories: Story[]; done: number };

/** Groups steps by epic, in epic order (E0, E1, ... E11, then anything odd). */
export function groupEpics(stories: readonly Story[]): EpicGroup[] {
  const map = new Map<string, Story[]>();
  for (const story of stories) {
    const list = map.get(story.epic) ?? [];
    list.push(story);
    map.set(story.epic, list);
  }
  const order = (id: string): number => {
    const match = /^E(\d+)$/.exec(id);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  return [...map.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
    .map(([id, list]) => ({
      id,
      name: EPIC_NAMES[id] ?? 'Other',
      stories: list,
      done: list.filter((s) => s.status === 'done').length,
    }));
}

export function tierLabel(tier: string): string {
  switch (tier.trim().toUpperCase()) {
    case 'H':
      return 'Haiku helper';
    case 'S':
      return 'Sonnet builder';
    case 'S+R':
      return 'Sonnet builder, then review';
    case 'OWNER':
      return 'You';
    case '':
      return 'Not assigned';
    default:
      return tier;
  }
}

/** Symbol and plain words for one step. Symbol and word always travel together. */
export function statusLabel(story: Story): { symbol: string; word: string } {
  if (story.status === 'done') return { symbol: '✓', word: 'Done' };
  if (story.status === 'blocked') return { symbol: '■', word: 'Blocked' };
  if (isWaitingOnDecision(story)) return { symbol: '■', word: 'Waiting on a decision' };
  if (story.status === 'in-progress') return { symbol: '●', word: 'Working' };
  if (story.status === 'review') return { symbol: '◐', word: 'In review' };
  if (story.status === 'todo') return { symbol: '○', word: 'Up next' };
  return { symbol: '?', word: story.rawStatus ? `Unknown status "${story.rawStatus}"` : 'No status' };
}

/** The first sentence of a note, cut to a calm length. */
export function shortNote(note: string, max = 110): string {
  const clean = note.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const firstStop = clean.search(/[.;](\s|$)/);
  const sentence = firstStop > 0 ? clean.slice(0, firstStop + 1) : clean;
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trimEnd()}…`;
}

/** A bar made of blocks: filled part and empty part, always the same width. */
export function bar(done: number, total: number, width: number): string {
  const cells = Math.max(1, Math.floor(width));
  const share = total > 0 ? done / total : 0;
  const filled = Math.min(cells, Math.max(0, Math.round(share * cells)));
  return '█'.repeat(filled) + '░'.repeat(cells - filled);
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function clock(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function openNeeds(snapshot: Snapshot): NeedItem[] {
  return snapshot.needs.filter((item) => item.isOpen);
}

/** What waits on a decision, as items the "Needs from you" section can list. */
export function decisionWaits(snapshot: Snapshot): Story[] {
  return snapshot.stories.filter(isWaitingOnDecision);
}

export function statusLine(snapshot: Snapshot): string {
  const counts = summarise(snapshot.stories);
  const needYou = openNeeds(snapshot).length + decisionWaits(snapshot).length;
  return `Dhanya ${counts.done}/${counts.total} done · ${needYou} need you`;
}

export function buildSnapshot(input: {
  sprintText: string | null;
  sprintProblem: string | null;
  needsText: string | null;
  needsProblem: string | null;
  needsFileName?: string;
  at: number;
}): Snapshot {
  const stories = input.sprintText === null ? [] : parseStories(input.sprintText);
  let storiesProblem = input.sprintProblem;
  if (input.sprintText !== null && stories.length === 0) {
    storiesProblem = 'The progress tracker was read, but no steps were found in it.';
  }
  let needs: NeedItem[] = [];
  let needsProblem = input.needsProblem;
  if (input.needsText !== null) {
    const parsed = parseNeeds(input.needsText, input.needsFileName);
    needs = parsed.items;
    needsProblem = parsed.problem;
  }
  return { stories, needs, storiesProblem, needsProblem, at: input.at };
}

/** Last part of a path, for friendly messages. */
export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** The whole board as plain text, for windows that cannot draw a side pane. */
export function textBoard(snapshot: Snapshot): string {
  const counts = summarise(snapshot.stories);
  const lines: string[] = [];
  lines.push(`DHANYA PROGRESS (updated ${clock(snapshot.at)})`);
  lines.push(
    `${bar(counts.done, counts.total, 20)} ${counts.done} of ${counts.total} steps done (${percent(counts.done, counts.total)}%)`,
  );
  lines.push(
    `✓ Done ${counts.done}   ● In progress ${counts.inProgress}   ■ Blocked ${counts.blocked}   ○ Up next ${counts.upNext}`,
  );
  if (snapshot.storiesProblem) lines.push(`Note: ${snapshot.storiesProblem}`);
  if (snapshot.needsProblem) lines.push(`Note: ${snapshot.needsProblem}`);

  lines.push('', 'NEEDS FROM YOU');
  const needs = openNeeds(snapshot);
  const waits = decisionWaits(snapshot);
  if (needs.length === 0 && waits.length === 0) {
    lines.push('  Nothing needed from you right now.');
  }
  for (const item of needs) {
    lines.push(`  ■ ${item.title}`);
    if (item.why) lines.push(`      Why:  ${item.why}`);
    if (item.how) lines.push(`      How:  ${item.how}`);
    if (item.when) lines.push(`      When: ${item.when}`);
  }
  for (const story of waits) {
    lines.push(`  ■ Waiting on decision ${story.needsDecision}: ${story.id} ${story.title}`);
  }

  const working = snapshot.stories.filter(
    (s) => (s.status === 'in-progress' || s.status === 'review') && !isBlocked(s),
  );
  lines.push('', 'WORKING ON NOW');
  if (working.length === 0) lines.push('  Nothing is being worked on right now.');
  for (const story of working) {
    const label = statusLabel(story);
    const note = shortNote(story.note);
    lines.push(`  ${label.symbol} ${story.id} ${story.title} (${tierLabel(story.tier)}, ${label.word})${note ? ` - ${note}` : ''}`);
  }

  const blocked = snapshot.stories.filter(isBlocked);
  lines.push('', 'BLOCKED');
  if (blocked.length === 0) lines.push('  Nothing is blocked.');
  for (const story of blocked) {
    const why = story.needsDecision ? `waiting on decision ${story.needsDecision}` : shortNote(story.note);
    lines.push(`  ■ ${story.id} ${story.title}${why ? ` - ${why}` : ''}`);
  }

  const next = snapshot.stories.filter((s) => s.status === 'todo' && !isBlocked(s)).slice(0, 5);
  lines.push('', 'UP NEXT');
  for (const story of next) lines.push(`  ○ ${story.id} ${story.title} (${tierLabel(story.tier)})`);
  if (next.length === 0) lines.push('  Nothing queued.');

  lines.push('', 'BY AREA');
  for (const epic of groupEpics(snapshot.stories)) {
    lines.push(`  ${epic.id} ${epic.name}: ${bar(epic.done, epic.stories.length, 10)} ${epic.done}/${epic.stories.length}`);
  }
  return lines.join('\n');
}

// ---- Codex runs (started by ai-tools/codex-bridge.mjs) ---------------------------------------

type CodexProgress = { lastAction?: string; steps?: number; files?: string[] };
type CodexStatus = {
  name?: string;
  state?: string;
  started?: string;
  ended?: string;
  branch?: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
};

const shorten = (text: string, n: number): string => text.replace(/s+/g, ' ').trim().slice(0, n);

/** Works out what Codex is doing from its event log, for a run that has no progress file. */
export function progressFromEvents(text: string): CodexProgress {
  const files: string[] = [];
  let steps = 0;
  let lastAction = 'Starting';
  for (const line of text.split('
')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as { type?: string; item?: Record<string, unknown> };
      const item = e.item as { type?: string; command?: string; text?: string; changes?: { path?: string }[] } | undefined;
      if (e.type === 'turn.started') lastAction = 'Thinking';
      if (!item) continue;
      if (item.type === 'command_execution' && e.type === 'item.started') {
        steps += 1;
        lastAction = 'Running: ' + shorten(String(item.command ?? '').replace(/^"[^"]*powershell.exe"s+-Commands+/i, ''), 90);
      } else if (item.type === 'file_change' && e.type === 'item.started') {
        for (const ch of item.changes ?? []) {
          const p = String(ch.path ?? '').replace(/^.*dhanya-wt[\/][^\/]+[\/]/i, '');
          if (p && !files.includes(p)) files.push(p);
        }
        lastAction = 'Editing: ' + shorten((item.changes ?? []).map((ch) => String(ch.path ?? '').split(/[\/]/).pop()).join(', '), 90);
      } else if (item.type === 'agent_message' && e.type === 'item.completed') {
        lastAction = 'Says: ' + shorten(String(item.text ?? ''), 110);
      }
    } catch {
      /* skip a line that is not JSON */
    }
  }
  return { lastAction, steps, files };
}

/** One Codex run, from its status file and (when there is one) its progress. */
export function buildCodexRun(statusText: string, progress: CodexProgress | null, nowMs: number): CodexRun | null {
  let s: CodexStatus;
  try {
    s = JSON.parse(statusText) as CodexStatus;
  } catch {
    return null;
  }
  if (!s.name) return null;
  const start = Date.parse(s.started ?? '');
  const end = s.state === 'running' ? nowMs : Date.parse(s.ended ?? '') || nowMs;
  const minutes = Number.isFinite(start) ? Math.max(0, Math.round((end - start) / 60000)) : 0;
  const tokens = s.usage ? (s.usage.input_tokens ?? 0) + (s.usage.output_tokens ?? 0) : null;
  return {
    name: s.name,
    state: s.state ?? 'running',
    minutes,
    lastAction: progress?.lastAction ?? (s.state === 'done' ? 'Finished' : s.state === 'failed' ? 'Stopped with an error' : 'Starting'),
    steps: progress?.steps ?? 0,
    files: progress?.files ?? [],
    branch: s.branch ?? '',
    tokens,
  };
}

/** Running first, then the most recent finished ones. */
export function sortCodexRuns(runs: readonly CodexRun[]): CodexRun[] {
  const rank = (r: CodexRun) => (r.state === 'running' ? 0 : 1);
  return [...runs].sort((a, b) => rank(a) - rank(b) || a.minutes - b.minutes);
}

export function codexStatusWord(run: CodexRun): { symbol: string; word: string } {
  if (run.state === 'running') return { symbol: '●', word: 'Working' };
  if (run.state === 'done') return { symbol: '✓', word: 'Finished' };
  return { symbol: '■', word: 'Stopped with an error' };
}
