// Tests of the pane itself: it loads the two files, draws on every surface, and never crashes.
import type { On } from 'claude-code';
import { expect, mock, test } from 'claude-code/testing';

const PANE = {
  plugin: 'dhanya-progress',
  component: 'Pane',
  requestId: 'dhanya-progress',
  props: {
    title: 'Dhanya progress',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const;

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const;

const SPRINT = [
  'stories:',
  '  - { id: S0.1, title: "Accounts and tools", tier: "OWNER", status: in-progress, note: "tools done" }',
  '  - { id: S0.2, title: "Scaffold", tier: "S", status: done }',
  '  - { id: S1.2, title: "Basic components", tier: "S", status: review }',
  '  - { id: S2.1, title: "Sign-in", tier: "S+R", status: todo }',
  '  - { id: S9.1, title: "Invoices", tier: "S+R", status: todo, needs_decision: D-08 }',
  '  - { id: S6.1, title: "Book rules", tier: "S+R", status: blocked, note: "waiting" }',
].join('\n');

const NEEDS = JSON.stringify({
  items: [
    { id: 'N-01', status: 'open', title: 'Restart VS Code', why: 'Loads the connectors', how: 'Close and reopen', when: 'When Claude says so' },
    { id: 'N-02', status: 'done', title: 'Already done thing' },
  ],
});

type FileAnswers = { sprint?: string | null; needs?: string | null };
type Spy = {
  registered?: string[];
  statuses?: string[];
  canPlacePane?: boolean;
};

/** The engine beneath the mod: the two files, a clock, a pane, and the commands. */
function stand(
  $: unknown,
  on: On,
  files: FileAnswers,
  spy: Spy = {},
) {
  void $;
  mock.clock(on, { now: Date.UTC(2026, 10, 5, 9, 5) });
  on('command.register', (_, e) => {
    spy.registered?.push(e.name);
    return { value: { command: e.name } };
  });
  on('ui.open', () =>
    spy.canPlacePane === false
      ? { value: { isPlaced: false, reason: 'no pane here' } }
      : { value: { isPlaced: true } },
  );
  on('ui.status', (_, e) => {
    if (e.text !== undefined) spy.statuses?.push(e.text);
    return { value: undefined };
  });
  on('session.start', (_, e) => ({ cwd: e.cwd }));
  on('fs.read', (_, e) => {
    if (e.path.endsWith('sprint-status.yaml')) {
      return files.sprint === null || files.sprint === undefined
        ? { deny: 'ENOENT' }
        : { value: files.sprint };
    }
    if (e.path.endsWith('owner-needs.json')) {
      return files.needs === null || files.needs === undefined
        ? { deny: 'ENOENT' }
        : { value: files.needs };
    }
    return { deny: 'ENOENT' };
  });
}

test('the pane shows the numbers, what you need to do, and the areas, on every surface', async ($, on) => {
  stand($, on, { sprint: SPRINT, needs: NEEDS });
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true });

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface });

    // One of six steps is done.
    expect(await ui.find({ type: 'Text', text: /1 of 6 steps done \(17%\)/ })).toBeDefined();

    // The four counts add up: done 1, in progress 2, blocked 2 (S6.1 and S9.1), up next 1.
    expect(await ui.find({ key: 't-done' })).toBeDefined();
    expect((await ui.find({ key: 't-done' }))?.text).toContain('1');
    expect((await ui.find({ key: 't-work' }))?.text).toContain('2');
    expect((await ui.find({ key: 't-block' }))?.text).toContain('2');
    expect((await ui.find({ key: 't-next' }))?.text).toContain('1');

    // Needs from you comes with a count (1 open item + 1 waiting on a decision), plain words.
    expect(await ui.find({ type: 'Text', text: /Needs from you \(2\)/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Restart VS Code/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Why: Loads the connectors/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Waiting on a decision: D-08/ })).toBeDefined();
    // A finished item is not listed under Needs from you.
    expect(await ui.find({ type: 'Text', text: /Already done thing/ })).toBeUndefined();

    // Status is words plus symbols.
    expect(await ui.find({ type: 'Text', text: /In review/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Working/ })).toBeDefined();

    // The footer says when and where from.
    expect(await ui.find({ type: 'Text', text: /Updated \d\d:\d\d/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /sprint-status\.yaml and owner-needs\.json/ })).toBeDefined();
    expect(await ui.find({ key: 'refresh' })).toBeDefined();
    await ui.unmount();
  }
});

test('an area opens when pressed, and the Done list opens when pressed', async ($, on) => {
  stand($, on, { sprint: SPRINT, needs: NEEDS });
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true });

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });

    expect(await ui.find({ type: 'Text', text: /S0\.2 Scaffold/ })).toBeUndefined();
    await ui.press({ key: 'done-toggle' });
    expect(await ui.find({ type: 'Text', text: /S0\.2 Scaffold/ })).toBeDefined();
    await ui.press({ key: 'done-toggle' });
    expect(await ui.find({ type: 'Text', text: /S0\.2 Scaffold/ })).toBeUndefined();

    await ui.press({ key: 'epic-E1' });
    expect(await ui.find({ type: 'Text', text: /S1\.2 Basic components/ })).toBeDefined();
    await ui.unmount();
  }
});

test('with both files missing the pane still draws and says what to check', async ($, on) => {
  stand($, on, { sprint: null, needs: null });
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true });

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ type: 'Text', text: /Could not read the progress tracker/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Could not read the list of what you need to do/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /Nothing needed from you right now/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /0 of 0 steps done/ })).toBeDefined();
    await ui.unmount();
  }
});

test('a broken needs file gives a calm sentence and the tracker still shows', async ($, on) => {
  stand($, on, { sprint: SPRINT, needs: '{ nope' });
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true });

  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' });
  expect(await ui.find({ type: 'Text', text: /not valid JSON/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /1 of 6 steps done/ })).toBeDefined();
  await ui.unmount();
});

test('Refresh now re-reads the files, so a change shows without waiting', async ($, on) => {
  const files: FileAnswers = { sprint: SPRINT, needs: NEEDS };
  stand($, on, files);
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true });

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' });
  expect(await ui.find({ type: 'Text', text: /1 of 6 steps done/ })).toBeDefined();

  files.sprint = SPRINT.replace('status: todo }', 'status: done }'); // S2.1 finished
  await ui.press({ key: 'refresh' });
  expect(await ui.find({ type: 'Text', text: /2 of 6 steps done/ })).toBeDefined();
  await ui.unmount();
});

test('the status line and both commands are registered when the session starts', async ($, on) => {
  const registered: string[] = [];
  const statuses: string[] = [];
  stand($, on, { sprint: SPRINT, needs: NEEDS }, { registered, statuses });

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true });

  expect(registered).toContain('dhanya');
  expect(registered).toContain('dhanya-refresh');
  expect(statuses.at(-1)).toBe('Dhanya 1/6 done · 2 need you');
});

test('a surface that cannot place a pane does not break the session', async ($, on) => {
  stand($, on, { sprint: SPRINT, needs: NEEDS }, { canPlacePane: false });
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true });
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' });
  expect(await ui.find({ type: 'Text', text: /steps done/ })).toBeDefined();
  await ui.unmount();
});
