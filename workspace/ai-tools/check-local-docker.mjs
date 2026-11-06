// Targeted Dhanya checks using a private disposable Postgres, never the shared test DB.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { parseArgs } from "node:util";
import { spawn, spawnSync, execFileSync } from "node:child_process";

const { values } = parseArgs({
  options: {
    worktree: { type: "string" },
    integration: { type: "string", multiple: true, default: [] },
    browser: { type: "string", multiple: true, default: [] },
    project: { type: "string", multiple: true, default: ["phone"] },
    grep: { type: "string" },
  },
});
if (!values.worktree || !(values.integration.length + values.browser.length)) {
  throw new Error(
    "Provide --worktree and at least one --integration or --browser test file.",
  );
}
const root = fs.realpathSync(values.worktree);
const worktrees = path.join(os.homedir(), "dhanya-wt");
if (!root.toLowerCase().startsWith((worktrees + path.sep).toLowerCase())) {
  throw new Error("Use a feature worktree under dhanya-wt.");
}
const branch = execFileSync("git", ["branch", "--show-current"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (!branch || branch === "main")
  throw new Error("A feature branch is required.");
if (!values.project.every(project => ["phone", "desktop", "phone-safari"].includes(project)))
  throw new Error("Unknown browser project.");
if (
  fs
    .readdirSync(root)
    .some((n) =>
      /^\.env(?:\.(?:local|development|production|test)(?:\.local)?)?$/.test(n),
    )
) {
  throw new Error(
    "Local environment files exist; refusing to load credentials implicitly.",
  );
}
for (const [kind, files] of [
  ["integration", values.integration],
  ["browser", values.browser],
]) {
  for (const file of files) {
    const actual = fs.realpathSync(path.resolve(root, file));
    const relative = path.relative(root, actual).replaceAll("\\", "/");
    const allowed =
      kind === "integration"
        ? /^tests\/integration\/.+\.test\.ts$/
        : /^tests\/(e2e|a11y)\/.+\.spec\.ts$/;
    if (!allowed.test(relative))
      throw new Error(
        `Select an existing ${kind} test file inside the worktree.`,
      );
  }
}
if (!fs.existsSync(path.join(root, "node_modules", "vitest", "vitest.mjs"))) {
  throw new Error("Install this worktree's lockfile dependencies first.");
}
// Pass system paths to children, not inherited API keys, tokens or database addresses.
const env = {};
const systemNames =
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|HOME|HOMEDRIVE|HOMEPATH|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|LANG|LC_ALL|TERM|NO_COLOR|FORCE_COLOR)$/i;
for (const name of Object.keys(process.env))
  if (systemNames.test(name)) env[name] = process.env[name];
env.NEXT_TELEMETRY_DISABLED = "1";
const docker = (args) =>
  execFileSync("docker", args, { encoding: "utf8", env }).trim();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function run(label, args, extra = {}) {
  console.log(label);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...env, ...extra },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  console.log(
    output
      .split(/\r?\n/)
      .filter((line) =>
        /Test Files|^\s*Tests\s|\d+ passed|\d+ failed/.test(line),
      )
      .slice(-4)
      .join("\n"),
  );
  if (result.status !== 0) {
    const diagnostics = output
      .split(/\r?\n/)
      .filter((line) =>
        /^\s*(?:FAIL\s|Type error:|Error:|AssertionError:|error:|Caused by:|\u276f|Failed to compile)/.test(line),
      )
      .slice(-12);
    console.error(
      diagnostics
        .map((line) =>
          line.replace(
            /(?:ghp_|github_pat_|xkeysib-|napi_|npg_|sbp_)[A-Za-z0-9_-]+/g,
            "[REDACTED]",
          ),
        )
        .join("\n"),
    );
    throw new Error(
      `${label} failed (exit ${result.status}); no cloud service was used.`,
    );
  }
}
let container;
let server;
const config = path.join(
  root,
  ".codex",
  `local-vitest-${process.pid}.config.mts`,
);
try {
  container = docker([
    "run",
    "--detach",
    "--rm",
    "--pull=never",
    "--name",
    `dhanya-codex-test-${process.pid}`,
    "--label",
    "dhanya.codex.local-test=true",
    "--publish",
    "127.0.0.1::5432",
    "--env",
    "POSTGRES_PASSWORD=dhanya_local_only",
    "--env",
    "POSTGRES_DB=postgres",
    "postgres:17",
  ]);
  if (!/^[a-f0-9]{64}$/.test(container))
    throw new Error("Unexpected private container id.");
  const port = Number(
    docker(["port", container, "5432/tcp"]).split(":").at(-1),
  );
  if (!Number.isInteger(port) || port < 1024)
    throw new Error("Unexpected private database port.");
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (
      spawnSync(
        "docker",
        [
          "exec",
          container,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
          "-d",
          "postgres",
        ],
        { env, stdio: "ignore" },
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await wait(500);
  }
  if (!ready) throw new Error("Private database did not become ready.");
  console.log(
    `Private Postgres ready on localhost:${port}; shared databases unchanged.`,
  );
  const owner = `postgres://postgres:dhanya_local_only@127.0.0.1:${port}/dhanya_test`;
  const app = `postgres://dhanya_app:dhanya_app@127.0.0.1:${port}/dhanya_test`;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      env,
      encoding: "utf8",
      input: fs.readFileSync(
        path.join(root, "docker/init/01-databases-and-readonly-role.sql"),
        "utf8",
      ),
    },
  );
  run(
    "Prepare private dev fixture for read-only-role checks",
    ["scripts/migrate.mjs"],
    { DATABASE_URL: owner.replace("/dhanya_test", "/dhanya_dev") },
  );
  const readonly = `postgres://dhanya_readonly:dhanya_readonly@127.0.0.1:${port}/dhanya_dev`;
  if (values.integration.length) {
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(
      config,
      `import base from '../vitest.config.mts';\nexport default { ...base, test: { ...base.test, projects: base.test.projects.map(p => p.test.name === 'integration' ? { ...p, test: { ...p.test, env: { ...p.test.env, DATABASE_URL: ${JSON.stringify(app)} } } } : p) } };\n`,
    );
    run(
      "Selected integration tests (UTC)",
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        config,
        "--project",
        "integration",
        ...values.integration,
      ],
      {
        TEST_DATABASE_URL: owner,
        APP_TEST_DATABASE_URL: app,
        DATABASE_URL: app,
        DHANYA_DEV_READONLY_URL: readonly,
        TZ: "UTC",
      },
    );
  } else {
    run(
      "Apply migrations to the private test database",
      ["scripts/migrate.mjs"],
      { DATABASE_URL: owner },
    );
    run(
      "Apply the existing app-role grants",
      [
        "--input-type=module",
        "--eval",
        "import pg from 'pg'; import { applyAppRole } from './scripts/app-role.mjs'; const c = new pg.Client({connectionString: process.env.DATABASE_URL}); await c.connect(); try { await applyAppRole(c, 'dhanya_app'); } finally { await c.end(); }",
      ],
      { DATABASE_URL: owner },
    );
  }
  if (values.browser.length) {
    const listener = net.createServer();
    await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const webPort = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const baseURL = `http://127.0.0.1:${webPort}`;
    const appEnv = { APP_ENV: "test", APP_URL: baseURL, DATABASE_URL: app };
    run(
      "Build once for the selected browser checks",
      ["node_modules/next/dist/bin/next", "build"],
      appEnv,
    );
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(webPort),
      ],
      { cwd: root, env: { ...env, ...appEnv }, stdio: "ignore" },
    );
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${baseURL}/api/health/deep`)).ok) {
          healthy = true;
          break;
        }
      } catch {}
      if (server.exitCode !== null)
        throw new Error("Local test server stopped unexpectedly.");
      await wait(500);
    }
    if (!healthy) throw new Error("Local test server did not become healthy.");
    run(
      `Selected browser checks (${values.project.join(", ")})`,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        ...values.browser,
        ...values.project.map(project => `--project=${project}`),
        ...(values.grep ? ["--grep", values.grep] : []),
        "--workers=1",
      ],
      { ...appEnv, PLAYWRIGHT_BASE_URL: baseURL, A11Y_ALL_MODES: "0" },
    );
  }
  console.log("Local Docker checks passed; no GitHub workflow started.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) server.kill();
  if (fs.existsSync(config)) fs.unlinkSync(config);
  if (container && /^[a-f0-9]{64}$/.test(container)) {
    docker(["stop", "--time", "5", container]);
    console.log("Stopped and removed only this run's disposable database.");
  }
}
