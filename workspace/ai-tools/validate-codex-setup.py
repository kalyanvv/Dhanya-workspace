#!/usr/bin/env python3
"""Validate generated configuration and discovery without opening credential files."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tomllib
import yaml

tools = Path(__file__).resolve().parent
workspace = tools.parent
home = Path.home()
manifest = json.loads((tools / 'codex-runtime' / 'installation.json').read_text(encoding='utf-8'))
files = [home / '.codex' / 'config.toml', workspace / '.codex' / 'config.toml',
         workspace.parent / '.codex' / 'config.toml']
files += list((workspace / '.codex' / 'agents').glob('*.toml'))
files += [Path(checkout) / '.codex' / 'config.toml' for checkout in manifest.get('configured_checkouts', [])]
for path in files:
    tomllib.loads(path.read_text(encoding='utf-8'))
print(f'TOML: {len(files)} files parsed')

config = tomllib.loads(files[0].read_text(encoding='utf-8'))
servers = {name: entry for name, entry in config['mcp_servers'].items() if name.startswith('dhanya-')}
assert len(servers) == len(manifest['mcp_servers'])
assert all(entry['enabled'] for entry in servers.values())
print(f'MCP: {len(servers)} enabled entries, using the file-backed launcher')

role_config = tomllib.loads(files[1].read_text(encoding='utf-8'))
roles = role_config.get('agents', {})
assert len(roles) == manifest['agent_count']
for name, role in roles.items():
    content = tomllib.loads(Path(role['config_file']).read_text(encoding='utf-8'))
    assert content.get('developer_instructions'), name
    assert 'model' not in content, name
print(f'Agents: {len(roles)} roles with instructions; model inheritance preserved')
for checkout in manifest.get('configured_checkouts', []):
    local = tomllib.loads((Path(checkout) / '.codex' / 'config.toml').read_text(encoding='utf-8'))
    assert len(local.get('agents', {})) == manifest['agent_count'], checkout
print(f'Worktrees: {len(manifest.get("configured_checkouts", []))} have role catalogs and shared context')
for skill in ['bmad-agent-analyst', 'bmad-agent-pm', 'bmad-agent-architect', 'bmad-agent-ux-designer', 'bmad-agent-dev']:
    result = subprocess.run([sys.executable, str(workspace / '_bmad' / 'scripts' / 'resolve_customization.py'),
                             '--project-root', str(workspace), '--skill', str(Path(manifest['skill_projection_root']) / skill),
                             '--key', 'agent'], capture_output=True, text=True, encoding='utf-8')
    assert result.returncode == 0, f'Persona customization failed: {skill}'
    json.loads(result.stdout)
print('BMad: all 5 persona customization blocks resolve from the Codex copies')

names = {}
for folder in (home / '.agents' / 'skills').iterdir():
    path = folder / 'SKILL.md'
    if not path.is_file(): continue
    text = path.read_text(encoding='utf-8-sig')
    match = re.match(r'^---\s*\n(.*?)\n---', text, re.S)
    assert match, str(path)
    metadata = yaml.safe_load(match.group(1))
    assert metadata.get('name') and metadata.get('description'), str(path)
    names.setdefault(metadata['name'], []).append(folder.name)
assert len(names) >= manifest['skill_count']
duplicates = {name: folders for name, folders in names.items() if len(folders) > 1}
assert not duplicates, f'Duplicate skill names: {duplicates}'
print(f'Skills: {len(names)} valid distinct names with reachable source files')

# The lead's standing rule forbids opening .env or token files, including for a
# security check. Validate the connector structure; do not claim a value comparison.
for name, entry in servers.items():
    assert set(entry) <= {'command', 'args', 'cwd', 'enabled', 'startup_timeout_sec', 'tool_timeout_sec'}, name
    assert len(entry['args']) == 2, name
    assert Path(entry['args'][0]).resolve() == (tools / 'codex-mcp.mjs').resolve(), name
    assert entry['args'][1] in manifest['mcp_servers'], name
print('Credential handling: connector entries use the launcher; no credential files opened')
