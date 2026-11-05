# MCP connectors

An MCP connector gives Claude a safe way to use another tool, such as a browser or GitHub.

| Connector | What it's for | Status |
|---|---|---|
| github | Code, pull requests, pipeline runs | On |
| playwright | Use a real browser to try and debug screens | On |
| chrome-devtools | Speed and network checks | On |
| context7 | Up-to-date library documentation | On |
| next-devtools | Next.js documentation and app errors | On |
| Neon | Read-only look at Neon projects and databases | On (sign in at first use) |
| postgres-dev | Read the local development database, read-only | Turn on at story S0.3 |
| brevo-senders, brevo-templates, brevo-domains | Brevo email setup: sender addresses, email templates, sending domains. Token in the BREVO_MCP_TOKEN Windows variable | On |
| vercel | Projects, deploys and logs. Signs in through the browser | On |
| supabase | Read-only look at Supabase. Not used by the plan (the database is Neon) | On |

## Changing connectors

1. Edit `servers.json`. To turn one on, set `"enabled": true`.
2. Run `node ai-tools/install.mjs` from the `workspace` folder.
3. Restart VS Code, and click Allow when asked.

Versions are fixed, so a connector can't change without someone choosing to update it. To check what's new, run `npm view <package> version`.

## Rules

- No passwords or tokens in these files. Use `${NAME}`, which reads a Windows environment variable.
- No connector gets write access to the production database.
- `postgres-dev` must connect with the read-only login created in story S0.3.

## Testing

Real test runs use Playwright inside the project, not the connector. The connector is for exploring and debugging. See the `dhanya-e2e` skill and the `dhanya-qa` agent in `ai-tools/`.

Selenium is left out on purpose. See `left_out_on_purpose` in `servers.json`.
