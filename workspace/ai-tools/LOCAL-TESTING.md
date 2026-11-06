# Local checks before a push

Run cheap static/unit checks directly in the selected feature worktree. For
database and browser changes, use the existing project tests with a private
Postgres 17 container. GitHub CI remains the final merge gate; do not use it
as the first place to discover a failing test.

From the shared workspace, select only the affected files:

```powershell
node ai-tools/check-local-docker.mjs --worktree C:/Users/rupen/dhanya-wt/s3-4-5 --integration tests/integration/pricing-settings.test.ts
```

For the pricing screen journeys as well:

```powershell
node ai-tools/check-local-docker.mjs --worktree C:/Users/rupen/dhanya-wt/s3-4-5 --integration tests/integration/pricing-settings.test.ts --browser tests/e2e/journeys/mill-pricing-settings.spec.ts --browser tests/a11y/pricing-settings.a11y.spec.ts
```

Choose the worktree and specs for the actual change. Repeat `--integration` or
`--browser` to select additional files. Browser checks default to one phone
project and one worker; `--project desktop` or `phone-safari` selects a different
existing project when its behavior matters. Pure logic needs unit tests, not Docker.

The runner:

- Requires a feature worktree under `dhanya-wt` with dependencies already installed.
- Uses the cached `postgres:17` image, a new private container and a free loopback
  port. It initializes the databases/roles from the project's own Docker SQL.
- Points test, app and read-only-role connections at that container. A temporary
  ignored Vitest config overrides the old hard-coded app port. No tracked port
  changes are needed, so a private port cannot accidentally reach main.
- Runs selected integration files in UTC. Use the existing both-time-zone gates
  for relevant date changes; this targeted check does not replace them.
- Builds once only when browser tests were selected, starts one local server,
  and reuses it for the selected journeys/accessibility checks. Light mode is
  used normally; nightly owns the additional modes and Linux visual baselines.
- Reads no `.env` or authentication files and forwards only system path variables
  plus its own local test settings. It refuses worktrees with local environment
  files instead of silently loading them.
- Stops its own server and disposable container and removes its own temporary
  config. It does not reset the shared port-5433 database or another builder's DB.

Do not run two builds from the same worktree: they still share `.next` and browser
reports. Distinct worktrees with private databases avoid that collision when
parallel builders are authorized. No branch push, GitHub workflow, staging or
production operation is performed by this tool.

Observed proof on the discounts/transport branch: 16 targeted integration tests,
one production build and five phone browser/accessibility journeys passed using
a private container. The extracted reusable runner's integration-only path also
passed all 16 tests; its browser-only bootstrap is checked separately.
The browser-only bootstrap passed two existing accessibility journeys, and the
private read-only-role fixture passed all eight existing role checks.
