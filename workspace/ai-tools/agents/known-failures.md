# Known failures and their fixes (read this before you start; it saves tokens)

Every builder and helper reads this first. If you hit a NEW failure and fix it, add one short entry
at the bottom (symptom, cause, fix) and mention it in your report.

## Setup and tools
- **No Python here.** Use `node -e` or a small node script for edits. `python3: command not found`.
- **Bash tool is POSIX.** Backticks and `\r` in heredocs eat text: use a quoted heredoc (`<<'EOF'`) or the Edit tool. `${{ }}` in workflow files: use the Edit tool.
- **`npm ci` fails with EPERM** when a node server from an earlier run is still alive. Stop only that process by its PID, never by name. Never run two `npm ci` at once in one folder (corrupts node_modules: delete it and reinstall).
- **Long commands:** `sleep` followed by another command is blocked. Run long watches in the background, or use an until-loop.
- **Line endings:** the repo uses LF (`.gitattributes`). If Prettier fails on CRLF, run `npx prettier --write <files>`. Do not use `git reset --hard`.
- **Force push and branch deletion are blocked.** Use a normal push; rebase locally and push a new branch if needed.
- **Never read `C:\Users\rupen\.dhanya\.env`.** Never print tokens or passwords. Never connect to Neon or Vercel yourself.

## Git and merging
- **Rebase conflicts** are almost always in `docs/plan/decisions.md`, `docs/plan/sprint-status.yaml`, `messages/en.json` and `messages/te.json`, `src/app/layout.tsx`. Markdown: keep both sides. sprint-status.yaml: keep the branch side, then re-check that main's newer status lines (other stories) were not lost. Messages JSON: parse both sides and deep-merge the keys; do not hand-edit commas. Run `npx prettier --write` after.
- **Migrations clash:** two stories adding the same migration number. Check `ls src/server/db/migrations` on latest main and take the next free number.
- **Each worktree needs its own `npm ci`.**
- Open pull requests as DRAFT, mark ready when done (drafts cost no CI minutes).

## Tests
- **Visual baselines:** only made in the Linux container (`npm run test:visual:update`). Never add Windows screenshots.
- **Axe colour-contrast on a toast or banner:** caused by scanning mid fade-in. The axe helper now waits for finite animations. If you add a new animated element, do not add colours that depend on opacity.
- **Long chip or label overflowing by 1px on Linux:** add `max-w-full` and wrap.
- **WebKit (phone-safari)** can report stale body styles: the axe helper already forces a style refresh.
- **Concurrency tests on a slow CI database** time out on connections. Set up fixtures in batches of 10, then fire the real concurrent requests.
- **Build-time env validation fails in CI/Vercel build:** use the placeholder values already in `deploy-staging.yml`; never real secrets.
- **Time:** domain code uses epoch milliseconds; books and credit use ISO text (`instant.ts`). Use India (IST) day logic from `time.ts`. Run unit and integration tests under both UTC and Asia/Kolkata (`npm run test:unit:tz`).
- Pooled DB connections: services open their own connection; do not hold a transaction open while calling another service that opens its own (take a transaction/executor argument instead).

## Product rules (do not re-ask)
- English only for now (Telugu skipped; `te.json` stays English placeholder).
- Invoices/PDF come later. Money is integer paise; percentages in basis points; half-up rounding.
- UI: apple-design skill for every screen, clarity checked, 170 kB gz first-load budget.
- Report in plain layman language; diagram at the end only if it helps.

## Do not waste tokens
- Read only the part of a file you need (offset and limit, or Grep). Do not re-read a file you just edited.
- Never print whole logs. Filter with grep/tail (for example `| tail -20`, or only lines with FAIL/Error).
- Run the narrowest test first (one file or one test ID), the whole suite only once at the end.
- Do not re-derive decisions already in `docs/plan/decisions.md`; follow them.
- Do not re-run a failing command unchanged. Read the error, change something, then run.
- Do not start servers or builds you do not need; stop the ones you start.
- If the same fix fails twice, stop and report the blocker in plain words instead of looping.
- Keep the final report short and in the requested shape.
