# Dhanya workspace kit

Current shared tooling and project context. Application source remains in Dhanya-sandbox; credentials and raw sessions are excluded.

Latest feature and CI review: [latest-project-review.md](workspace/ai-tools/context/latest-project-review.md).
Agent continuation and skill guide: [CONTINUE-WORK.md](workspace/ai-tools/context/CONTINUE-WORK.md).
Copied source hashes: [WORKSPACE-SNAPSHOT.json](WORKSPACE-SNAPSHOT.json).
Exact third-party revisions: [tool-sources.json](workspace/ai-tools/context/tool-sources.json).

On a new PC:

    git clone https://github.com/kalyanvv/Dhanya-workspace.git tooling
    node tooling/setup-new-pc.mjs workspace

Then follow the remaining setup steps. Third-party source clones are reconstructed separately (THIRD-PARTY.md).

To refresh only this repository from the working workspace:

    node ai-tools/save-work.mjs --workspace-only

This mode does not read .env or push application branches.
