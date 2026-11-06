// The Dhanya progress pane: what is done, in progress, blocked, and what the owner needs to do.
// Data comes from two files, read every few seconds and on the Refresh button.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register } from 'claude-code';

import type { CodexRun, Snapshot, Story } from '../types';
import {
  bar,
  buildCodexRun,
  buildSnapshot,
  clock,
  codexStatusWord,
  decisionWaits,
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
  shape: 'snapshot-1',
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

type Files = { sprintFile: string; needsFile: string; codexDir: string };

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

/** Refreshes the files and returns the whole board as text, for windows without a side pane. */
async function boardText($: EngineInterface, files: Files): Promise<string> {
  return textBoard(await refresh($, files));
}

async function refresh($: EngineInterface, files: Files): Promise<Snapshot> {
  const [sprint, needs] = await Promise.all([
    readText($, files.sprintFile, 'the progress tracker'),
    readText($, files.needsFile, 'the list of what you need to do'),
  ]);
  const at = await $.clock.now();
  const snapshot = buildSnapshot({
    sprintText: sprint.text,
    sprintProblem: sprint.problem,
    needsText: needs.text,
    needsProblem: needs.problem,
    needsFileName: fileName(files.needsFile),
    at,
  });
  await update($, snapshotAtom, () => snapshot);
  const codexRuns = await readCodexRuns($, files.codexDir);
  await update($, codexAtom, () => codexRuns);
  $.ui.status(statusLine(snapshot));
  return snapshot;
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
  };

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dhanya',
      description: 'Open the Dhanya progress pane: what is done, in progress and needed from you',
    });
    await $.command.register({
      name: 'dhanya-refresh',
      description: 'Re-read the Dhanya progress files now',
    });
    try {
      await refresh($, files);
    } catch {
      // The pane draws a calm message from its state; a failed first reading is not fatal.
    }
    $.clock.every(refreshMs, () => {
      void refresh($, files).catch(() => undefined);
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

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const snapshot = await read($, snapshotAtom);
    const openEpics = await read($, openEpicsAtom);
    const isDoneOpen = await read($, doneOpenAtom);
    const codexRuns = await read($, codexAtom);
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
              void refresh($, files).catch(() => undefined);
            }}
          />
          <Text dimColor>
            Updated {clock(snapshot.at)} · re-reads every {Math.round(refreshMs / 1000)} seconds
          </Text>
          <Text dimColor>
            Reads {fileName(files.sprintFile)} and {fileName(files.needsFile)}
          </Text>
        </Box>
      </Box>
    );
  });
};
