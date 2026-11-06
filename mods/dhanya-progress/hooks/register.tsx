// The Dhanya progress pane: what is done, in progress, blocked, and what the owner needs to do.
// Data comes from two files, read every few seconds and on the Refresh button.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import type { CodexRun, GitHubInfo, Snapshot, SourceKind, Story } from '../types';
import {
  bar,
  buildCodexRun,
  buildSnapshot,
  clock,
  codexStatusWord,
  decisionWaits,
  githubLines,
  parsePrs,
  parseRuns,
  sourceLine,
  stalenessLine,
  fileName,
  groupEpics,
  isBlocked,
  openNeeds,
  percent,
  progressFromEvents,
  shortNote,
  sortCodexRuns,
  statusLabel,
  statusLine,
  summarise,
  textBoard,
  tierLabel,
} from './core';

const PANE = 'dhanya-progress';
const TITLE = 'Dhanya progress';

// A reload keeps stored values, so change a tag when the shape of a value changes.
const snapshotAtom = atom({ plugin: 'dhanya-progress', key: 'snapshot' } as const, null, {
  shape: 'snapshot-2',
});
const githubAtom = atom({ plugin: 'dhanya-progress', key: 'github' } as const, null, {
  shape: 'github-1',
});
const openEpicsAtom = atom({ plugin: 'dhanya-progress', key: 'openEpics' } as const, [], {
  shape: 'epics-1',
});
const codexAtom = atom({ plugin: 'dhanya-progress', key: 'codexRuns' } as const, [], {
  shape: 'codex-1',
});
const doneOpenAtom = atom({ plugin: 'dhanya-progress', key: 'isDoneOpen' } as const, false, {
  shape: 'done-1',
});

type Files = {
  sprintFile: string;
  needsFile: string;
  codexDir: string;
  repoDir: string;
  repo: string;
};

const GIT_EVERY_MS = 5 * 60 * 1000;
const GH_EVERY_MS = 2 * 60 * 1000;
const TRACKER_IN_REPO = 'docs/plan/sprint-status.yaml';

// What the slow reads last did. Kept for the session; a reload simply asks again.
const memory = { fetchedAt: 0, fetchOk: false, lastGoodFetch: 0, ghAt: 0, busy: false };

/** Runs a host command by argv (no shell). Returns its text, or null when it failed for any reason. */
async function runText(
  $: EngineInterface,
  argv: string[],
  timeoutMs: number,
): Promise<string | null> {
  try {
    const result = await $.process.run(argv, { timeoutMs });
    return result.exitCode === 0 ? result.stdout : null;
  } catch {
    return null;
  }
}

/** The tracker from the remote main branch (fetched at most every 5 minutes), else the local file. */
async function readTracker(
  $: EngineInterface,
  files: Files,
  now: number,
  force: boolean,
): Promise<{ text: string | null; problem: string | null; source: SourceKind; sourceAt: number }> {
  if (force || now - memory.fetchedAt >= GIT_EVERY_MS) {
    const fetched = await runText($, ['git', '-C', files.repoDir, 'fetch', '--quiet', 'origin'], 25000);
    memory.fetchOk = fetched !== null;
    // After a failed fetch, try again in a minute rather than at the next 20 seconds.
    memory.fetchedAt = memory.fetchOk ? now : now - GIT_EVERY_MS + 60000;
    if (memory.fetchOk) memory.lastGoodFetch = now;
  }
  const shown = await runText(
    $,
    ['git', '-C', files.repoDir, 'show', `origin/main:${TRACKER_IN_REPO}`],
    15000,
  );
  if (shown !== null && shown.trim() !== '') {
    return {
      text: shown,
      problem: null,
      source: memory.fetchOk ? 'origin' : 'origin-stale',
      sourceAt: memory.lastGoodFetch,
    };
  }
  const local = await readText($, files.sprintFile, 'the progress tracker');
  return { ...local, source: 'local', sourceAt: now };
}

/** Open pull requests and recent workflow runs, through the gh tool. Only the JSON fields asked for are read. */
async function readGitHub($: EngineInterface, files: Files, now: number): Promise<GitHubInfo> {
  const [prText, runJson] = await Promise.all([
    runText(
      $,
      ['gh', 'pr', 'list', '--repo', files.repo, '--json', 'number,title,headRefName,isDraft', '--limit', '10'],
      25000,
    ),
    runText(
      $,
      [
        'gh', 'run', 'list', '--repo', files.repo,
        '--json', 'workflowName,status,conclusion,headBranch,createdAt', '--limit', '6',
      ],
      25000,
    ),
  ]);
  return {
    prs: prText === null ? null : parsePrs(prText),
    runs: runJson === null ? null : parseRuns(runJson),
    at: now,
  };
}

/** Reads the Codex runs written by ai-tools/codex-bridge.mjs. Never throws; no folder means no runs. */
async function readCodexRuns($: EngineInterface, dir: string): Promise<CodexRun[]> {
  try {
    const names = (await $.fs.list(dir)).filter((entry) => entry.kind === 'dir').map((entry) => entry.name);
    const now = await $.clock.now();
    const runs: CodexRun[] = [];
    for (const name of names) {
      try {
        const statusText = await $.fs.read(`${dir}/${name}/status.json`);
        let progress = null;
        try {
          progress = JSON.parse(await $.fs.read(`${dir}/${name}/progress.json`));
        } catch {
          try {
            progress = progressFromEvents(await $.fs.read(`${dir}/${name}/events.jsonl`));
          } catch {
            progress = null;
          }
        }
        const run = buildCodexRun(statusText, progress, now);
        if (run) runs.push(run);
      } catch {
        // a folder without a readable status file is skipped
      }
    }
    return sortCodexRuns(runs).slice(0, 8);
  } catch {
    return [];
  }
}

/** Reads one file. Never throws: a missing or unreadable file comes back as a calm sentence. */
async function readText(
  $: EngineInterface,
  path: string,
  what: string,
): Promise<{ text: string | null; problem: string | null }> {
  try {
    return { text: await $.fs.read(path), problem: null };
  } catch {
    return {
      text: null,
      problem: `Could not read ${what} (${fileName(path)}). Check that this file exists: ${path}`,
    };
  }
}

/** Refreshes everything and returns the whole board as text, for windows without a side pane. */
async function boardText($: EngineInterface, files: Files): Promise<string> {
  const snapshot = await refresh($, files, true);
  return textBoard(snapshot, await read($, githubAtom));
}

/**
 * Reads everything. The two small files and the Codex runs are read every time; the slow reads
 * (git fetch every 5 minutes, GitHub every 2 minutes) only when due, or always when `force` is set.
 */
async function refresh($: EngineInterface, files: Files, force = false): Promise<Snapshot> {
  const now = await $.clock.now();
  const [tracker, needs] = await Promise.all([
    readTracker($, files, now, force),
    readText($, files.needsFile, 'the list of what you need to do'),
  ]);
  const snapshot = buildSnapshot({
    sprintText: tracker.text,
    sprintProblem: tracker.problem,
    needsText: needs.text,
    needsProblem: needs.problem,
    needsFileName: fileName(files.needsFile),
    at: now,
    source: tracker.source,
    sourceAt: tracker.sourceAt,
  });
  await update($, snapshotAtom, () => snapshot);
  const codexRuns = await readCodexRuns($, files.codexDir);
  await update($, codexAtom, () => codexRuns);
  if (force || now - memory.ghAt >= GH_EVERY_MS) {
    memory.ghAt = now;
    const github = await readGitHub($, files, now);
    await update($, githubAtom, () => github);
  }
  $.ui.status(statusLine(snapshot));
  return snapshot;
}

/** Same as refresh, but a timer tick skips itself while a slow read is running, and nothing throws. */
async function refreshQuietly($: EngineInterface, files: Files, force = false): Promise<void> {
  if (memory.busy && !force) return;
  memory.busy = true;
  try {
    await refresh($, files, force);
  } catch {
    // The pane keeps showing its last good reading.
  } finally {
    memory.busy = false;
  }
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((one) => one !== id) : [...list, id];
}

export const register: Register = (on, options) => {
  const seconds = Number(options.refreshSeconds);
  const refreshMs = (Number.isFinite(seconds) ? Math.max(5, seconds) : 20) * 1000;
  const files: Files = {
    sprintFile: String(options.sprintFile),
    needsFile: String(options.needsFile),
    codexDir: String(options.codexRunsDir ?? 'C:/Users/rupen/.dhanya/codex-runs'),
    repoDir: String(
      options.repoDir ?? 'C:/Users/rupen/OneDrive/Documents/Staffing/Personal/Projects/workspace/sandbox',
    ),
    repo: String(options.githubRepo ?? 'kalyanvv/Dhanya-sandbox'),
  };

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dhanya',
      description: 'Open the Dhanya progress pane: what is done, in progress and needed from you',
    });
    await $.command.register({
      name: 'dhanya-update',
      description: 'Fetch the latest from GitHub now and show the Dhanya board as text',
    });
    await $.command.register({
      name: 'dhanya-refresh',
      description: 'Re-read the Dhanya progress files now',
    });
    await refreshQuietly($, files, true);
    $.clock.every(refreshMs, () => {
      void refreshQuietly($, files);
    });
    try {
      await $.ui.open({ id: PANE, title: TITLE });
    } catch {
      // A surface that cannot place a pane is fine: /dhanya tries again.
    }
    return next(e);
  });

  on('command.run', { command: 'dhanya' }, async ($) => {
    try {
      const opened = await $.ui.open({ id: PANE, title: TITLE });
      return {
        text: opened.isPlaced
          ? 'Dhanya progress pane opened.'
          : await boardText($, files),
      };
    } catch {
      return { text: 'Could not open the Dhanya progress pane in this window.' };
    }
  });

  on('command.run', { command: 'dhanya-refresh' }, async ($) => {
    try {
      return { text: await boardText($, files) };
    } catch {
      return { text: 'Could not refresh the Dhanya progress files.' };
    }
  });

  on('command.run', { command: 'dhanya-update' }, async ($) => {
    try {
      return { text: await boardText($, files) };
    } catch {
      return { text: 'Could not update the Dhanya board right now.' };
    }
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const snapshot = await read($, snapshotAtom);
    const openEpics = await read($, openEpicsAtom);
    const isDoneOpen = await read($, doneOpenAtom);
    const codexRuns = await read($, codexAtom);
    const github = await read($, githubAtom);
    const nowMs = await $.clock.now();
    const columns = e.props?.bodyColumns ?? 50;
    const barWidth = Math.min(40, Math.max(10, columns - 6));

    if (snapshot === null) {
      return (
        <Box flexDirection="column" padding="md">
          <Text size="heading" weight="bold">
            Dhanya
          </Text>
          <Text dimColor>Reading the progress files…</Text>
        </Box>
      );
    }

    const counts = summarise(snapshot.stories);
    const pct = percent(counts.done, counts.total);
    const needsOpen = openNeeds(snapshot);
    const waits = decisionWaits(snapshot);
    const needYou = needsOpen.length + waits.length;
    const working = snapshot.stories.filter(
      (s) => !isBlocked(s) && (s.status === 'in-progress' || s.status === 'review'),
    );
    const blocked = snapshot.stories.filter((s) => s.status === 'blocked');
    const upNext = snapshot.stories
      .filter((s) => !isBlocked(s) && s.status !== 'done' && s.status !== 'in-progress' && s.status !== 'review')
      .slice(0, 5);
    const done = snapshot.stories.filter((s) => s.status === 'done');
    const epics = groupEpics(snapshot.stories);

    const tile = (key: string, n: number, word: string, symbol: string, color: string) => (
      <Box
        key={key}
        flexDirection="column"
        borderStyle="round"
        borderColor={color}
        paddingX="md"
        minWidth={14}
      >
        <Text size="title" weight="bold" tabular color={color}>
          {n}
        </Text>
        <Text>
          {symbol} {word}
        </Text>
      </Box>
    );

    const storyRow = (s: Story, withWho: boolean) => {
      const label = statusLabel(s);
      const note = shortNote(s.note);
      return (
        <Box key={s.id} flexDirection="column">
          <Text>
            {label.symbol} <Text weight="bold">{s.id}</Text> {s.title}
          </Text>
          <Text dimColor>
            {label.word}
            {withWho ? ` · ${tierLabel(s.tier)}` : ''}
            {note ? ` · ${note}` : ''}
          </Text>
        </Box>
      );
    };

    return (
      <Box flexDirection="column" padding="md" gap="md">
        {/* Header: the one number that matters most. */}
        <Box flexDirection="column">
          <Text size="title" weight="bold">
            Dhanya
          </Text>
          <Text size="heading" weight="semibold">
            {counts.done} of {counts.total} steps done ({pct}%)
          </Text>
          <Text mono color="success">
            {bar(counts.done, counts.total, barWidth)}
          </Text>
        </Box>

        {/* Four counts. They always add up to the total. */}
        <Box flexDirection="row" flexWrap="wrap" gap="sm">
          {tile('t-done', counts.done, 'Done', '✓', 'success')}
          {tile('t-work', counts.inProgress, 'In progress', '●', 'suggestion')}
          {tile('t-block', counts.blocked, 'Blocked', '■', 'error')}
          {tile('t-next', counts.upNext, 'Up next', '○', 'subtle')}
        </Box>

        {/* Problems with the two files, said calmly. */}
        {snapshot.storiesProblem && (
          <Box borderStyle="round" borderColor="warning" paddingX="md" flexDirection="column">
            <Text weight="bold">! Heads-up</Text>
            <Text>{snapshot.storiesProblem}</Text>
          </Box>
        )}
        {snapshot.needsProblem && (
          <Box borderStyle="round" borderColor="warning" paddingX="md" flexDirection="column">
            <Text weight="bold">! Heads-up</Text>
            <Text>{snapshot.needsProblem}</Text>
          </Box>
        )}

        {/* Needs from you: first, and the most prominent. */}
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="warning"
          paddingX="md"
          paddingY="sm"
          gap="sm"
        >
          <Text size="heading" weight="bold" color="warning">
            {needYou > 0 ? `! Needs from you (${needYou})` : '✓ Needs from you'}
          </Text>
          {needYou === 0 && <Text>Nothing needed from you right now.</Text>}
          {needsOpen.map((item) => (
            <Box key={`need-${item.id}`} flexDirection="column">
              <Text weight="bold">
                ! {item.title}
              </Text>
              {item.why && <Text dimColor>Why: {item.why}</Text>}
              {item.how && <Text>How: {item.how}</Text>}
              {item.when && <Text dimColor>Needed before: {item.when}</Text>}
            </Box>
          ))}
          {waits.map((s) => (
            <Box key={`wait-${s.id}`} flexDirection="column">
              <Text weight="bold">■ Waiting on a decision: {s.needsDecision}</Text>
              <Text dimColor>
                {s.id} {s.title}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Codex runs: started by the Codex bridge, shown like the other agents. */}
        <Box flexDirection="column" gap="xs">
          <Text size="heading" weight="bold">
            Codex agents ({codexRuns.filter((run) => run.state === 'running').length} working)
          </Text>
          {codexRuns.length === 0 && <Text dimColor>No Codex runs yet.</Text>}
          {codexRuns.map((run) => {
            const label = codexStatusWord(run);
            return (
              <Box key={`codex-${run.name}`} flexDirection="column">
                <Text>
                  {label.symbol} <Text weight="bold">{run.name}</Text>
                  <Text dimColor> · {label.word} · {run.minutes} min</Text>
                </Text>
                <Text dimColor>{run.lastAction}</Text>
                <Text dimColor>
                  {run.steps} steps · {run.files.length} files
                  {run.tokens ? ` · ${Math.round(run.tokens / 1000)}k tokens` : ''}
                  {run.branch ? ` · ${run.branch}` : ''}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Pull requests and deploys, from GitHub. */}
        <Box flexDirection="column" gap="xs">
          <Text size="heading" weight="bold">
            Pull requests and deploys
          </Text>
          {githubLines(github).map((line, i) => (
            <Text key={`gh-${i}`} dimColor={line.startsWith('#')}>
              {line}
            </Text>
          ))}
        </Box>

        {/* Working on now. */}
        <Box flexDirection="column" gap="xs">
          <Text size="heading" weight="bold">
            Working on now ({working.length})
          </Text>
          {working.length === 0 && <Text dimColor>Nothing is being worked on at the moment.</Text>}
          {working.map((s) => storyRow(s, true))}
        </Box>

        {/* Blocked. */}
        <Box flexDirection="column" gap="xs">
          <Text size="heading" weight="bold">
            Blocked ({blocked.length})
          </Text>
          {blocked.length === 0 && <Text dimColor>Nothing is blocked.</Text>}
          {blocked.map((s) => (
            <Box key={s.id} flexDirection="column">
              <Text>
                ■ <Text weight="bold">{s.id}</Text> {s.title}
              </Text>
              <Text dimColor>
                {s.needsDecision ? `Waiting on decision ${s.needsDecision}` : 'Blocked'}
                {s.note ? ` · ${shortNote(s.note)}` : ''}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Up next. */}
        <Box flexDirection="column" gap="xs">
          <Text size="heading" weight="bold">
            Up next
          </Text>
          {upNext.length === 0 && <Text dimColor>Nothing queued.</Text>}
          {upNext.map((s) => (
            <Text key={s.id}>
              ○ <Text weight="bold">{s.id}</Text> {s.title}
              <Text dimColor> · {tierLabel(s.tier)}</Text>
            </Text>
          ))}
        </Box>

        {/* By area. Select a row to open it. */}
        <Box flexDirection="column" gap="xs">
          <Text size="heading" weight="bold">
            By area
          </Text>
          {epics.map((epic) => {
            const isOpen = openEpics.includes(epic.id);
            return (
              <Box key={`area-${epic.id}`} flexDirection="column">
                <Button
                  key={`epic-${epic.id}`}
                  plain
                  onPress={() => update($, openEpicsAtom, (list) => toggle(list, epic.id))}
                >
                  {isOpen ? '▾' : '▸'} {epic.id} {epic.name}
                  <Text dimColor>
                    {' '}
                    {epic.done}/{epic.stories.length} done
                  </Text>
                </Button>
                <Text mono color="success">
                  {bar(epic.done, epic.stories.length, Math.min(24, barWidth))}
                </Text>
                {isOpen && (
                  <Box flexDirection="column" paddingLeft="md">
                    {epic.stories.map((s) => {
                      const label = statusLabel(s);
                      return (
                        <Text key={s.id}>
                          {label.symbol} <Text weight="bold">{s.id}</Text> {s.title}
                          <Text dimColor> · {label.word}</Text>
                        </Text>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Done, folded away. */}
        <Box flexDirection="column" gap="xs">
          <Button
            key="done-toggle"
            plain
            onPress={() => update($, doneOpenAtom, (open) => !open)}
          >
            {isDoneOpen ? '▾' : '▸'} Done ({done.length})
          </Button>
          {isDoneOpen && done.length === 0 && <Text dimColor>Nothing finished yet.</Text>}
          {isDoneOpen &&
            done.map((s) => (
              <Text key={s.id}>
                ✓ <Text weight="bold">{s.id}</Text> {s.title}
              </Text>
            ))}
        </Box>

        {/* Footer: when, how, and where the numbers come from. */}
        <Box flexDirection="column">
          <Button
            key="refresh"
            variant="secondary"
            label="Refresh now"
            onPress={() => {
              void refreshQuietly($, files, true);
            }}
          />
          <Text dimColor>
            Updated {clock(snapshot.at)} · re-reads every {Math.round(refreshMs / 1000)} seconds
          </Text>
          <Text dimColor>{sourceLine(snapshot.source, snapshot.sourceAt)}</Text>
          {stalenessLine(nowMs, snapshot.at, refreshMs * 3) && (
            <Text color="warning">{stalenessLine(nowMs, snapshot.at, refreshMs * 3)}</Text>
          )}
        </Box>
      </Box>
    );
  });
};
