# Dhanya progress

A panel that sits beside the chat and shows, at a glance and in plain words, how the Dhanya project is going:

- **How far along**: "12 of 67 steps done" with a bar and a percentage.
- **Four counts**: Done, In progress, Blocked, Up next. They always add up to the total.
- **Needs from you**: the most important box, at the top. It lists what you have to do or decide, why, how, and what it blocks. It also lists steps waiting on a decision, such as D-08.
- **Working on now**: steps being built or reviewed, who builds them, and a one-line note.
- **Blocked** and **Up next** (the next five steps).
- **By area**: one row per area (Accounts and network, Books, and so on) with a small bar. Select a row to open its steps.
- **Done**: folded away, select it to see every finished step.

Every status is a symbol plus words (✓ Done, ● Working, ◐ In review, ■ Blocked, ○ Up next), so it never depends on colour alone.

## Using it

- It opens by itself when the session starts if the window can show a side pane.
- Type `/dhanya` to open it, or `/dhanya-refresh` to re-read the files and see the numbers in the chat.
- The status line also shows a short summary, such as `Dhanya 12/67 done · 3 need you`.

## Where the numbers come from

Two files, both read every 20 seconds and when you press **Refresh now**:

1. `sandbox/docs/plan/sprint-status.yaml`, the progress tracker the build agents update.
2. `ai-tools/progress/owner-needs.json`, the list of what you need to do. Claude keeps it up to date.

If a file is missing or broken, the pane says so in plain words and keeps showing everything else.

## Changing the settings

Open the Claude Code settings (`/config`) and look for the **dhanya-progress** options: how often to refresh (default 20 seconds, never less than 5) and the paths of the two files.

## For developers

`hooks/core.ts` holds the reading and counting (no drawing), `hooks/register.tsx` draws the pane, `tests/` holds the tests (`claude plugin test <this folder>`).
