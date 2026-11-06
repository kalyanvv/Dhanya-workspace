// Tests of the pure part: reading the tracker and the owner's list, counting, grouping and wording.
import { describe, expect, test } from 'claude-code/testing';

import {
  bar,
  buildSnapshot,
  epicOf,
  groupEpics,
  normaliseStatus,
  parseFields,
  parseNeeds,
  parseStories,
  percent,
  shortNote,
  statusLabel,
  statusLine,
  summarise,
  tierLabel,
} from '../hooks/core';

const SPRINT = [
  '# Progress tracker. Status: todo, in-progress, review, done, blocked',
  'project: Dhanya',
  'stories:',
  '  - { id: S0.1, title: "Accounts and tools", tier: "OWNER", status: in-progress, note: "tools done; waiting for owner" }',
  '  - { id: S0.2, title: "Scaffold", tier: "S", status: done, note: "merged in PR #1" }',
  '  - { id: S1.2, title: "Basic components, gallery", tier: "S", status: review }',
  '  - { id: S2.1, title: "Sign-in", tier: "S+R", status: todo }',
  '  - { id: S3.5, title: "Transport rule", tier: "S", status: todo, needs_decision: D-15 }',
  '  - { id: S6.1, title: "Book rules", tier: "S+R", status: blocked, note: "waiting" }',
  '  - { id: S9.1, title: "Invoices", tier: "S+R", status: todo, blocked_by_decision: D-08 }',
  '  - { id: S10.1, title: "Full Telugu", tier: "H", status: mystery }',
  '  - { id: S11.2, title: "Launch", tier: "OWNER" }',
  '    not a story line',
  '  - id: S99.9',
  '',
].join('\r\n');

describe('parseFields', () => {
  test('a quoted value keeps its commas and colons', () => {
    const f = parseFields('id: S1.1, title: "Rates, discounts: today", status: todo');
    expect(f.id).toBe('S1.1');
    expect(f.title).toBe('Rates, discounts: today');
    expect(f.status).toBe('todo');
  });

  test('an escaped quote inside a note stays in the note', () => {
    const f = parseFields('id: S1.1, note: "He said \\"done\\", then left"');
    expect(f.note).toBe('He said "done", then left');
  });

  test('a single-quoted value works too, including a doubled quote', () => {
    const f = parseFields("id: S1.1, title: 'Owner''s list', status: done");
    expect(f.title).toBe("Owner's list");
    expect(f.status).toBe('done');
  });

  test('a piece with no colon is skipped and the rest still reads', () => {
    const f = parseFields('id: S1.1, oops, status: todo');
    expect(f.id).toBe('S1.1');
    expect(f.status).toBe('todo');
  });

  test('missing fields are simply absent', () => {
    expect(parseFields('id: S1.1').title).toBeUndefined();
  });
});

describe('parseStories', () => {
  const stories = parseStories(SPRINT);

  test('reads only story lines, and keeps the file order', () => {
    expect(stories.map((s) => s.id)).toEqual([
      'S0.1',
      'S0.2',
      'S1.2',
      'S2.1',
      'S3.5',
      'S6.1',
      'S9.1',
      'S10.1',
      'S11.2',
    ]);
  });

  test('a title with a comma stays whole', () => {
    expect(stories.find((s) => s.id === 'S1.2')?.title).toBe('Basic components, gallery');
  });

  test('needs_decision and blocked_by_decision are both read', () => {
    expect(stories.find((s) => s.id === 'S3.5')?.needsDecision).toBe('D-15');
    expect(stories.find((s) => s.id === 'S9.1')?.needsDecision).toBe('D-08');
  });

  test('an unknown status word is kept as unknown, and a missing status too', () => {
    const odd = stories.find((s) => s.id === 'S10.1');
    expect(odd?.status).toBe('unknown');
    expect(odd?.rawStatus).toBe('mystery');
    expect(stories.find((s) => s.id === 'S11.2')?.status).toBe('unknown');
  });

  test('the epic comes from the step id', () => {
    expect(epicOf('S3.2')).toBe('E3');
    expect(epicOf('S10.1')).toBe('E10');
    expect(epicOf('weird')).toBe('E?');
  });

  test('normaliseStatus knows the five words and nothing else', () => {
    expect(normaliseStatus(' Done ')).toBe('done');
    expect(normaliseStatus('in-progress')).toBe('in-progress');
    expect(normaliseStatus('review')).toBe('review');
    expect(normaliseStatus('blocked')).toBe('blocked');
    expect(normaliseStatus('todo')).toBe('todo');
    expect(normaliseStatus('finished')).toBe('unknown');
  });

  test('an empty file gives no steps and does not throw', () => {
    expect(parseStories('')).toEqual([]);
  });
});

describe('counts', () => {
  const stories = parseStories(SPRINT);

  test('every step lands in exactly one count, so they add up', () => {
    const c = summarise(stories);
    expect(c.total).toBe(9);
    expect(c.done + c.inProgress + c.blocked + c.upNext).toBe(c.total);
    expect(c.done).toBe(1); // S0.2
    expect(c.inProgress).toBe(2); // S0.1 working, S1.2 in review
    expect(c.blocked).toBe(3); // S6.1 blocked, S3.5 and S9.1 wait on decisions
    expect(c.upNext).toBe(3); // S2.1 todo, S10.1 unknown, S11.2 no status
  });

  test('a finished step that still names a decision is not blocked', () => {
    const c = summarise(parseStories('  - { id: S1.1, title: "x", status: done, needs_decision: D-01 }'));
    expect(c.done).toBe(1);
    expect(c.blocked).toBe(0);
  });

  test('percent and bar are safe on zero and exact otherwise', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 4)).toBe(25);
    expect(bar(0, 0, 10)).toBe('░░░░░░░░░░');
    expect(bar(5, 10, 10)).toBe('█████░░░░░');
    expect(bar(10, 10, 4)).toBe('████');
    expect(bar(99, 10, 4)).toBe('████');
  });
});

describe('grouping and wording', () => {
  const stories = parseStories(SPRINT);

  test('epics are in number order, E2 before E10, with their names and done counts', () => {
    const groups = groupEpics(stories);
    expect(groups.map((g) => g.id)).toEqual(['E0', 'E1', 'E2', 'E3', 'E6', 'E9', 'E10', 'E11']);
    expect(groups[0]?.name).toBe('Foundation and pipeline');
    expect(groups[0]?.done).toBe(1);
    expect(groups[0]?.stories.length).toBe(2);
    expect(groups.find((g) => g.id === 'E10')?.name).toBe('Quality and hardening');
  });

  test('each step has a symbol and plain words, never a symbol alone', () => {
    const words = (id: string) => {
      const s = stories.find((x) => x.id === id);
      return s ? statusLabel(s) : undefined;
    };
    expect(words('S0.2')).toEqual({ symbol: '✓', word: 'Done' });
    expect(words('S0.1')).toEqual({ symbol: '●', word: 'Working' });
    expect(words('S1.2')).toEqual({ symbol: '◐', word: 'In review' });
    expect(words('S2.1')).toEqual({ symbol: '○', word: 'Up next' });
    expect(words('S6.1')).toEqual({ symbol: '■', word: 'Blocked' });
    expect(words('S3.5')).toEqual({ symbol: '■', word: 'Waiting on a decision' });
    expect(words('S10.1')?.word).toBe('Unknown status "mystery"');
  });

  test('who builds a step is said in plain words', () => {
    expect(tierLabel('H')).toBe('Haiku helper');
    expect(tierLabel('S')).toBe('Sonnet builder');
    expect(tierLabel('S+R')).toBe('Sonnet builder, then review');
    expect(tierLabel('OWNER')).toBe('You');
    expect(tierLabel('')).toBe('Not assigned');
  });

  test('a note is cut to its first sentence and a calm length', () => {
    expect(shortNote('Built it. Then reviewed it.')).toBe('Built it.');
    expect(shortNote('x'.repeat(300), 20)).toBe(`${'x'.repeat(19)}…`);
    expect(shortNote('')).toBe('');
  });
});

describe('the owner list', () => {
  test('open items and done items are told apart', () => {
    const { items, problem } = parseNeeds(
      JSON.stringify({
        items: [
          { id: 'N-01', status: 'open', title: 'Restart VS Code', why: 'w', how: 'h', when: 'now' },
          { id: 'N-02', status: 'done', title: 'Old thing' },
          { title: 'No id, no status' },
          { id: 'N-04', status: 'open' },
        ],
      }),
    );
    expect(problem).toBeNull();
    expect(items.length).toBe(3); // the one with no title is dropped
    expect(items[0]?.isOpen).toBe(true);
    expect(items[1]?.isOpen).toBe(false);
    expect(items[2]?.isOpen).toBe(true); // no status means still open
  });

  test('a plain list at the top is fine too', () => {
    expect(parseNeeds(JSON.stringify([{ id: 'N-01', title: 'A' }])).items.length).toBe(1);
  });

  test('malformed JSON gives a calm sentence and an empty list, never a throw', () => {
    const r = parseNeeds('{ not json', 'owner-needs.json');
    expect(r.items).toEqual([]);
    expect(r.problem).toContain('owner-needs.json');
    expect(r.problem).toContain('not valid JSON');
  });

  test('JSON with no items list also gives a calm sentence', () => {
    const r = parseNeeds('{"hello": 1}');
    expect(r.items).toEqual([]);
    expect(r.problem).toContain('no "items" list');
  });
});

describe('snapshot', () => {
  test('a missing tracker keeps its calm sentence, and the owner list still reads', () => {
    const s = buildSnapshot({
      sprintText: null,
      sprintProblem: 'Could not read the progress tracker.',
      needsText: JSON.stringify({ items: [{ id: 'N-1', status: 'open', title: 'Do it' }] }),
      needsProblem: null,
      at: 1,
    });
    expect(s.stories).toEqual([]);
    expect(s.storiesProblem).toBe('Could not read the progress tracker.');
    expect(s.needs.length).toBe(1);
  });

  test('a tracker with no steps in it says so', () => {
    const s = buildSnapshot({
      sprintText: 'project: Dhanya\n',
      sprintProblem: null,
      needsText: null,
      needsProblem: 'x',
      at: 1,
    });
    expect(s.storiesProblem).toContain('no steps were found');
    expect(s.needsProblem).toBe('x');
  });

  test('the status line counts open needs and decision waits together', () => {
    const s = buildSnapshot({
      sprintText: SPRINT,
      sprintProblem: null,
      needsText: JSON.stringify({
        items: [
          { id: 'N-1', status: 'open', title: 'A' },
          { id: 'N-2', status: 'done', title: 'B' },
        ],
      }),
      needsProblem: null,
      at: 1,
    });
    expect(statusLine(s)).toBe('Dhanya 1/9 done · 3 need you'); // 1 open item + 2 decision waits
  });
});

import {
  ageWords,
  buildCodexRun,
  codexStatusWord,
  deployWords,
  githubLines,
  latestDeploy,
  parsePrs,
  parseRuns,
  progressFromEvents,
  runningRuns,
  sortCodexRuns,
  sourceLine,
  stalenessLine,
} from '../hooks/core';

const BS = String.fromCharCode(92); // a backslash, for Windows paths

describe('Codex runs', () => {
  const events = [
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({
      type: 'item.started',
      item: { type: 'command_execution', command: `"C:${BS}x${BS}powershell.exe" -Command npm test` },
    }),
    JSON.stringify({
      type: 'item.started',
      item: {
        type: 'file_change',
        changes: [{ path: ['C:', 'Users', 'rupen', 'dhanya-wt', 's5-8', 'src', 'a.ts'].join(BS), kind: 'update' }],
      },
    }),
    'not json',
  ].join('\n');

  test('reads what Codex is doing from its events', () => {
    const p = progressFromEvents(events);
    expect(p.steps).toBe(1);
    expect(p.files).toEqual([`src${BS}a.ts`]);
    expect(p.lastAction?.startsWith('Editing:')).toBe(true);
  });

  test('builds a running run with minutes to now', () => {
    const status = JSON.stringify({ name: 's5-8', state: 'running', started: '2026-11-06T01:00:00.000Z', branch: 'feat/x' });
    const run = buildCodexRun(status, { lastAction: 'Thinking', steps: 2, files: ['a'] }, Date.parse('2026-11-06T01:12:00.000Z'));
    expect(run?.minutes).toBe(12);
    expect(run?.lastAction).toBe('Thinking');
    expect(codexStatusWord(run!).word).toBe('Working');
  });

  test('a finished run counts tokens and stops the clock', () => {
    const status = JSON.stringify({ name: 'a', state: 'done', started: '2026-11-06T01:00:00.000Z', ended: '2026-11-06T01:05:00.000Z', usage: { input_tokens: 1000, output_tokens: 500 } });
    const run = buildCodexRun(status, null, Date.parse('2026-11-06T09:00:00.000Z'));
    expect(run?.minutes).toBe(5);
    expect(run?.tokens).toBe(1500);
    expect(run?.lastAction).toBe('Finished');
  });

  test('bad status text gives nothing, and running sorts first', () => {
    expect(buildCodexRun('oops', null, 0)).toBeNull();
    const mk = (name: string, state: string, minutes: number) => ({ name, state, minutes, lastAction: '', steps: 0, files: [], branch: '', tokens: null });
    expect(sortCodexRuns([mk('a', 'done', 1), mk('b', 'running', 9)]).map((r) => r.name)).toEqual(['b', 'a']);
  });
});

describe('Pull requests and deploys', () => {
  const PRS = JSON.stringify([
    { number: 12, title: 'S4.1 Shop ordering', headRefName: 'feat/s4-1', isDraft: true },
    { number: 'bad', title: 'skipped' },
    { number: 13, title: 'S4.2', headRefName: 'feat/s4-2', isDraft: false },
  ]);
  const RUNS = JSON.stringify([
    { workflowName: 'CI', status: 'in_progress', conclusion: '', headBranch: 'feat/x', createdAt: '2026-11-06T10:00:00Z' },
    { workflowName: 'Deploy staging', status: 'completed', conclusion: 'failure', headBranch: 'main', createdAt: '2026-11-06T08:00:00Z' },
    { workflowName: 'Deploy staging', status: 'completed', conclusion: 'success', headBranch: 'main', createdAt: '2026-11-06T09:00:00Z' },
  ]);

  test('reads pull requests and skips bad rows; bad text gives null', () => {
    const prs = parsePrs(PRS)!;
    expect(prs.map((p) => p.number)).toEqual([12, 13]);
    expect(prs[0]!.isDraft).toBe(true);
    expect(parsePrs('not json')).toBeNull();
    expect(parsePrs('{"a":1}')).toBeNull();
  });

  test('reads runs newest first, finds the latest staging deploy and the running ones', () => {
    const runs = parseRuns(RUNS)!;
    expect(runs.map((r) => r.workflow)).toEqual(['CI', 'Deploy staging', 'Deploy staging']);
    const deploy = latestDeploy(runs)!;
    expect(deploy.conclusion).toBe('success');
    expect(deployWords(deploy).word).toBe('Green');
    expect(deployWords(runs[2]!).word).toBe('Red');
    expect(runningRuns(runs).map((r) => r.workflow)).toEqual(['CI']);
  });

  test('the section words are calm when GitHub fails', () => {
    expect(githubLines({ prs: null, runs: null, at: 0 }).join(' ')).toContain('could not be read');
    const lines = githubLines({ prs: parsePrs(PRS), runs: parseRuns(RUNS), at: 0 });
    expect(lines[0]).toBe('2 open pull requests');
    expect(lines[1]).toBe('#12 S4.1 Shop ordering (draft)');
  });

  test('the source line and the out-of-date warning', () => {
    expect(sourceLine('local', 0)).toBe('Source: local file (git unavailable)');
    expect(sourceLine('origin', 0)).toMatch(/^Source: origin\/main at \d\d:\d\d$/);
    expect(sourceLine('origin-stale', 0)).toContain('not reachable');
    expect(ageWords(10 * 60000, 5 * 60000)).toBe('5 min ago');
    expect(stalenessLine(1000, 0, 60000)).toBeNull();
    expect(stalenessLine(10 * 60000, 0, 60000)).toContain('10 min ago');
  });
});
