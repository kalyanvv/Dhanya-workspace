param(
    [ValidateSet('gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-luna')]
    [string]$Model = 'gpt-6.1-terra',
    [switch]$Preview
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$installation = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'codex-runtime/installation.json') | ConvertFrom-Json
$codexArgs = @('-C', $workspaceRoot, '-m', $Model)
# These configured launchers read the central env file at startup. Disable them
# for this session while the owner's no-credential-file rule is active.
foreach ($server in $installation.mcp_servers) {
    if ($server -notmatch '^[a-zA-Z0-9-]+$') { throw 'Invalid connector catalog name.' }
    $codexArgs += @('-c', "mcp_servers.dhanya-$($server.ToLowerInvariant()).enabled=false")
}
$codexArgs += 'Read ai-tools/context/CONTINUE-WORK.md, use dhanya-workflow, verify live GitHub and worktree state, and continue the next authorized unblocked work. Respect the current lead assignment. Do not read credential files or launch credential-reading connectors.'
if ($Preview) {
    [pscustomobject]@{ Command = 'codex'; Arguments = $codexArgs } | ConvertTo-Json -Depth 3
    exit 0
}
& codex @codexArgs
exit $LASTEXITCODE
