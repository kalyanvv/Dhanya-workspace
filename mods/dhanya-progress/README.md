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
- Type `/dhanya` to open it, or `/dhanya-refresh` to re-read the files, or `/dhanya-update` to fetch the latest from GitHub first, and see the numbers in the chat.
- The status line also shows a short summary, such as `Dhanya 12/67 done · 3 need you`.

## Where the numbers come from

- The progress tracker (`docs/plan/sprint-status.yaml`) is read from the **remote main branch** on GitHub, so nobody has to pull first. If git does not work, the pane uses the local copy of the file and says so.
- `ai-tools/progress/owner-needs.json`, the list of what you need to do. Claude keeps it up to date.
- **Pull requests and deploys**: open pull requests, the latest staging deploy (green or red, with the time) and anything running now.
- **Codex agents**: the runs the Codex bridge writes to `~/.dhanya/codex-runs`.

If something is missing or broken, the pane says so in plain words and keeps showing everything else. The footer line says where the tracker came from, for example `Source: origin/main at 14:05`.

## How it updates itself

| What | How often |
| --- | --- |
| Needs file, Codex runs, and re-reading the tracker | every 20 seconds |
| `git fetch` of the project, then the tracker from `origin/main` | every 5 minutes |
| Pull requests and workflow runs from GitHub (`gh`) | every 2 minutes |
| Everything at once | the **Refresh now** button, or `/dhanya-update` (which also prints the board as text) |

If the board has not been read for a while, a yellow "Out of date" line appears under it. Pull requests and deploys need the GitHub tool signed in once (`gh auth login`); if it is not, that section says it could not be read and the rest keeps working. The pane only reads the few fields it shows and never prints any token.

## Changing the settings

Open the Claude Code settings (`/config`) and look for the **dhanya-progress** options: how often to refresh (default 20 seconds, never less than 5) and the paths of the two files.

## For developers

`hooks/core.ts` holds the reading and counting (no drawing), `hooks/register.tsx` draws the pane, `tests/` holds the tests (`claude plugin test <this folder>`).
