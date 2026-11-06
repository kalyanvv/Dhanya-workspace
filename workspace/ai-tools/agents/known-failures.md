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

## Added by builders
- **Parallel builders share one `dhanya_test` database.** Two integration runs at the same time give random failures ("table missing", files that cannot load). Run the full integration suite for only one worktree at a time (the lead says when), or give a test its own private database as IT-OPS-01 does. GitHub CI has its own database, so a green CI run is the final proof.
- **Heredocs with many apostrophes** can break the Bash command. Write markdown files with the Write tool.
- **Each parallel builder needs its own Postgres port** if it runs integration tests at the same time as another builder (shared port 5433 is dropped mid-run). Prefer running them one at a time.
- **Two Playwright runs from one worktree at once break each other** ("Failed to load external module pg-..." in `.next`, all tests fail). Both run `npm run build` into the same `.next` and both reset the test database. A command with `... ; (playwright ... ) &` inside a Bash call that times out keeps running in the background: check for stray runs (PowerShell, process command lines) before starting another. Stop only your own by PID.
- **`cat > file` with no heredoc waits for input forever** and the Bash call hangs until it times out. Use the Write tool for files.
- **App login can still DELETE a table you narrowed in a migration** (found in S3.1). `scripts/app-role.mjs` re-grants SELECT, INSERT, UPDATE, DELETE on ALL tables every time it runs (test setup and role creation), which silently undoes a `REVOKE` in your migration. A table that must never be deleted from (products, product_variants) or is read only (rice_types) needs a line in the narrowing loop in `app-role.mjs` too, and an integration test that connects as `dhanya_app` and expects `permission denied`.
- **Shared test database gives random "sign-in failed 500/401" or "org_id not present"** when another builder's run drops the schema. Run your own Postgres (`docker run -d --rm --name pg-x -e POSTGRES_PASSWORD=dhanya_local_only -e POSTGRES_DB=dhanya_test -p 5455:5432 postgres:17`), set TEST_DATABASE_URL and APP_TEST_DATABASE_URL to port 5455, and temporarily change the port in the DATABASE_URL line of `vitest.config.mts` (revert before committing). The dev read-only role test needs the dev database and will fail there.
- **Browser tests: wait for the sign-in to finish.** After the sign-in helper, assert the URL is /home before the next page.goto, or the goto cancels the sign-in and you land on Sign in is coming (S2.5/S2.6).
- **Bash heredoc node scripts lose backslashes in regex text** (//home$/ became //home$/). Build such text with new RegExp(...) or use the Edit/Write tools.
- **Several parallel builders: give your own Postgres container and port.** Port 5433 is written in vitest.config.mts, playwright.config.ts, drizzle.config.ts, scripts/db-url.mjs, scripts/create-app-role.mjs, tests/e2e/support/global-setup.ts and tests/integration/db-helpers.ts. Swap it with sed, and never git add those files (git add explicit paths, not -A).
- **cleanSlate does TRUNCATE users CASCADE**, which also empties any table with a foreign key to users (for example invites.created_by). Re-create what you need in each test.
- **Private test database:** vitest.config.mts hard-codes the app DATABASE_URL at port 5433, so a private Postgres needs that line changed too (revert before committing), not only TEST_DATABASE_URL, APP_TEST_DATABASE_URL and DHANYA_DEV_READONLY_URL. Simplest: do not run the full integration suite locally while other builders run; use CI as the final proof.
- **Merge database changes in number order.** The migrator skips an older change that arrives after a newer one has already run on staging. Merge the story with the lower migration number first (0008, then 0009, then 0010...), and merge main into the later branch before it goes in.
- **drizzle-kit generate numbers a migration by position** (it wrote `0010_...` and overwrote the existing `0010_snapshot.json`). Rename the SQL file, the journal tag and the new snapshot to the real number, restore the old snapshot from git, and put any `UNIQUE` the new foreign key needs BEFORE the foreign key in the SQL (S3.3).
- **A temporary test-database port can get committed by accident** (5563 reached main through a merged branch in `tests/e2e/support/global-setup.ts`). After merging another branch, run `git grep -n "localhost:55\|localhost:54"` and make sure only 5433 remains.
- **Heredocs with apostrophes in text** (for example "Today's rate") break the Bash call with "unexpected EOF". Use the Write tool, then a small node script file.
