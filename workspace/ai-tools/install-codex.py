#!/usr/bin/env python3
"""Install workspace skills/agents and secret-free Codex MCP configuration. Repeatable."""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tomllib
from datetime import datetime, timezone
import yaml

TOOLS = Path(__file__).resolve().parent
WORKSPACE = TOOLS.parent
PROJECTS = WORKSPACE.parent
HOME = Path.home()
CODEX = HOME / '.codex'
BEGIN = '# BEGIN DHANYA CODEX MCP (ai-tools/install-codex.py)'
END = '# END DHANYA CODEX MCP'
q = lambda value: json.dumps(str(value), ensure_ascii=False)

def application_worktrees():
    result = subprocess.run(['git', '-C', str(WORKSPACE / 'sandbox'), 'worktree', 'list', '--porcelain'], capture_output=True, text=True)
    roots = []
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if not line.startswith('worktree '): continue
            root = Path(line[len('worktree '):]).resolve()
            if root.exists() and (root.is_relative_to(WORKSPACE) or root.is_relative_to(HOME / 'dhanya-wt')):
                roots.append(root)
    return roots

def managed(existing: str, begin: str, end: str, content: str, prepend=False) -> str:
    pattern = re.compile(re.escape(begin) + r'.*?' + re.escape(end) + r'\n?', re.S)
    existing = pattern.sub('', existing).strip()
    block = f'{begin}\n{content.rstrip()}\n{end}\n'
    return block + '\n' + existing + '\n' if prepend else existing + '\n\n' + block

def backup(path: Path):
    if not path.exists(): return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    dest = CODEX / 'backups' / 'dhanya' / stamp
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest / path.name)

def frontmatter(path: Path):
    text = path.read_text(encoding='utf-8-sig')
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.S)
    if not match: return None, text
    raw = match.group(1)
    try:
        header = yaml.safe_load(raw)
    except yaml.YAMLError:
        # Some existing Claude agents have unquoted ": " in their one-line description.
        # Normalize only the imported metadata; leave the original source untouched.
        raw = re.sub(r'^description: (.+)$', lambda m: 'description: ' + json.dumps(m.group(1)), raw, flags=re.M)
        header = yaml.safe_load(raw)
    return header, text[match.end():]

def junction(link: Path, target: Path):
    link.parent.mkdir(parents=True, exist_ok=True)
    if link.exists():
        if link.resolve() == target.resolve(): return
        # Preserve pre-existing user installations rather than replacing them.
        return
    if os.name == 'nt':
        # pathlib creates a directory symlink only with Windows developer mode. A junction
        # works without elevation. Values here are generated local paths, never user commands.
        result = subprocess.run(['cmd', '/d', '/c', 'mklink', '/J', str(link), str(target)], capture_output=True, text=True)
        if result.returncode: raise RuntimeError(f'Could not link skill folder {link.name}')
    else:
        link.symlink_to(target, target_is_directory=True)

def retarget_managed_skill(link: Path, target: Path, previous_source: Path):
    if link.exists() and link.resolve() != target.resolve():
        resolved = link.resolve()
        # Only replace directory links installed by this workspace. Never remove a real
        # directory or a skill supplied by another installation.
        owned_roots = [WORKSPACE / '.claude' / 'skills', TOOLS / 'ECC' / 'skills',
                       TOOLS / 'ECC' / '.agents' / 'skills', TOOLS / 'skills']
        managed_source = resolved == previous_source.resolve() or any(resolved.is_relative_to(root.resolve()) for root in owned_roots)
        managed_projection = resolved.is_relative_to((TOOLS / 'codex-skills').resolve())
        stat = link.lstat()
        is_link = link.is_symlink() or bool(getattr(stat, 'st_file_attributes', 0) & 0x400)
        if is_link and (managed_source or managed_projection):
            if link.is_symlink(): link.unlink()
            else: os.rmdir(link)  # removes the junction only, never its target
    junction(link, target)

def project_skill(name: str, source: Path) -> Path:
    """Create a Codex-safe copy without changing the Claude/upstream source."""
    target = TOOLS / 'codex-skills' / name
    shutil.copytree(source, target, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('node_modules', '.git', '__pycache__', '*.pyc'))
    header, body = frontmatter(source / 'SKILL.md')
    allowed = {'name', 'description', 'metadata', 'license', 'allowed-tools'}
    extra = {key: value for key, value in header.items() if key not in allowed}
    header = {key: value for key, value in header.items() if key in allowed}
    metadata = dict(header.get('metadata') or {})
    metadata['dhanya_source'] = str(source)
    if extra: metadata['source_frontmatter'] = extra
    header['metadata'] = metadata
    plugin_root = TOOLS / 'ECC' if source.is_relative_to(TOOLS / 'ECC') else WORKSPACE / '.claude'
    replacements = {
        '${CLAUDE_PLUGIN_ROOT:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}}': plugin_root.as_posix(),
        '${CLAUDE_SKILL_DIR}': target.as_posix(), '$CLAUDE_SKILL_DIR': target.as_posix(),
        '${CLAUDE_PLUGIN_ROOT}': plugin_root.as_posix(), '$CLAUDE_PLUGIN_ROOT': plugin_root.as_posix(),
        '${CLAUDE_PROJECT_DIR}': WORKSPACE.as_posix(), '$CLAUDE_PROJECT_DIR': WORKSPACE.as_posix(),
    }
    if name == 'skill-host-compat':
        # This teaching example deliberately shows forbidden syntax. Keep it as literal
        # text rather than presenting it as an executable command in a Codex projection.
        def literal_example(match):
            if 'CLAUDE_' in match.group(3) or '$ARGUMENTS' in match.group(3):
                return '```text' + match.group(2) + '\n' + match.group(3) + '```'
            return match.group(0)
        body = re.sub(r'^```(bash|sh|zsh)([^\n]*)\n(.*?)^```', literal_example, body, flags=re.M | re.S)
    else:
        for old, new in replacements.items(): body = body.replace(old, new)
        body = body.replace('$ARGUMENTS', 'the arguments in the current user request')
    if name == 'dhanya-e2e':
        body = ('\n**Current owner decision (2026-11-05):** version 1 is English only. '
                'Keep translation infrastructure/key parity, but do not add Telugu journeys, '
                'PDF checks or reader sign-off until the owner requests that phase. This '
                'supersedes older bilingual examples below.\n\n' + body)
    (target / 'SKILL.md').write_text('---\n' + yaml.safe_dump(header, sort_keys=False, allow_unicode=True).rstrip() + '\n---\n' + body, encoding='utf-8')
    return target

def main():
    CODEX.mkdir(parents=True, exist_ok=True)
    config = CODEX / 'config.toml'
    original = config.read_text(encoding='utf-8-sig') if config.exists() else ''
    clean = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n?', '', original, flags=re.S)
    parsed = tomllib.loads(clean)
    catalog = json.loads((TOOLS / 'mcps' / 'servers.json').read_text(encoding='utf-8-sig'))['servers']
    names = [name for name, server in catalog.items() if server.get('enabled')] + ['openai-docs']
    blocks = []
    for name in names:
        codex_name = 'dhanya-' + name.lower()
        if codex_name in parsed.get('mcp_servers', {}):
            raise RuntimeError(f'Unmanaged MCP configuration already exists: {codex_name}')
        blocks.extend([
            f'[mcp_servers.{q(codex_name)}]',
            f'command = {q(shutil.which("node") or "node")}',
            f'args = [{q(TOOLS / "codex-mcp.mjs")}, {q(name)}]',
            f'cwd = {q(WORKSPACE)}',
            'enabled = true', 'startup_timeout_sec = 120', 'tool_timeout_sec = 120', '',
        ])
    checkouts = application_worktrees()
    for trusted_root in dict.fromkeys([PROJECTS, WORKSPACE, *checkouts]):
        if str(trusted_root) not in parsed.get('projects', {}):
            blocks.extend([f'[projects.{q(trusted_root)}]', 'trust_level = "trusted"', ''])
    updated = managed(original, BEGIN, END, '\n'.join(blocks))
    # Recognize existing per-repo CLAUDE.md instructions when no AGENTS.md is present.
    fallbacks = parsed.get('project_doc_fallback_filenames', [])
    if 'CLAUDE.md' not in fallbacks:
        # Preserve an existing fallback list and replace only its top-level assignment.
        updated = re.sub(r'^project_doc_fallback_filenames\s*=\s*\[[^\]]*\]\s*\n?', '', updated, flags=re.M)
        updated = f'project_doc_fallback_filenames = {json.dumps([*fallbacks, "CLAUDE.md"])}\n\n' + updated.lstrip()
    tomllib.loads(updated)
    if updated != original:
        backup(config)
        config.write_text(updated, encoding='utf-8')

    # Use repository skills as the source. Installed project copies take precedence over
    # the upstream library, so Dhanya's customizations and BMad installation are preserved.
    candidates = {}
    for root in [TOOLS / 'ECC' / 'skills', WORKSPACE / '.claude' / 'skills',
                 TOOLS / 'ECC' / '.agents' / 'skills', TOOLS / 'skills']:
        for folder in sorted(root.iterdir()):
            skill = folder / 'SKILL.md'
            if not skill.is_file(): continue
            header, _ = frontmatter(skill)
            if not header or not header.get('name') or not header.get('description'):
                raise RuntimeError(f'Invalid skill metadata: {skill}')
            candidates[folder.name] = folder
    skills_root = HOME / '.agents' / 'skills'
    system_root = CODEX / 'skills' / '.system'
    skipped = []
    for name, folder in candidates.items():
        if (system_root / name / 'SKILL.md').exists():
            skipped.append(name)
            continue
        projection = project_skill(name, folder)
        retarget_managed_skill(skills_root / name, projection, folder)

    # Make the existing agent prompts available as native Codex roles. No Claude model
    # names or new model choices are imposed; roles inherit the selected Codex model.
    role_dir = WORKSPACE / '.codex' / 'agents'
    role_dir.mkdir(parents=True, exist_ok=True)
    roles = []
    for source in sorted((WORKSPACE / '.claude' / 'agents').glob('*.md')):
        header, body = frontmatter(source)
        if not header or not header.get('name'): continue
        name = str(header['name']).replace('-', '_')
        instructions = (
            f'Adapted from {source}. Read {WORKSPACE / "AGENTS.md"} and the Dhanya plan first. '
            'The current user request and project plan govern scope. Claude-specific model names, '
            'slash commands and tool allowlists in the original prompt are reference material; '
            'use available Codex skills and MCP tools, and inherit the selected Codex model. '
            'Do not launch other agents unless the user or applicable instructions authorize delegation.\n\n' + body +
            '\n\nCodex adaptation: current owner decisions take precedence over historical '
            'requirements above. Version 1 is English only; defer Telugu work, tests and reader '
            'sign-off, including the Telugu portion of S0.9. Use the selected application '
            'checkout and its own docs/plan; paths beginning sandbox/ in the original prompt '
            'refer to that application root when working in a feature worktree. Follow the '
            'current review-backlog.md build-first policy rather than older completion/review '
            'classification above, retaining builder tests, UI design checks and the security '
            'gate before real users/data. Native role names use underscores instead of hyphens. '
            'Resolve routine implementation choices within the existing authorization; ask '
            'only for missing decisions that genuinely block the requested work.\n'
        )
        role = role_dir / f'{source.stem}.toml'
        role.write_text('developer_instructions = ' + q(instructions) + '\n', encoding='utf-8')
        description = str(header.get('description', name))
        roles.extend([f'[agents.{q(name)}]', f'description = {q(description)}', f'config_file = {q(role)}', ''])
    personas = {
        'mary': ('bmad-agent-analyst', 'Business analyst: discovery and requirements research.'),
        'john': ('bmad-agent-pm', 'Product manager: PRD, scope and priorities.'),
        'winston': ('bmad-agent-architect', 'Architect: system boundaries and technical decisions.'),
        'sally': ('bmad-agent-ux-designer', 'UX designer: user journeys and screen behavior.'),
        'amelia': ('bmad-agent-dev', 'Developer: story implementation and verification.'),
    }
    for name, (skill, description) in personas.items():
        role = role_dir / f'bmad-{name}.toml'
        instructions = (f'Read {WORKSPACE / "AGENTS.md"}. Use the {skill} skill at '
                        f'{TOOLS / "codex-skills" / skill / "SKILL.md"} and follow its activation '
                        f'and customization steps with project root {WORKSPACE}. '
                        'Inherit the selected Codex model. Follow the current user request '
                        'and session delegation rules. Do not start a new workflow or pause '
                        'for a menu when the user already gave a clear task. The selected application '
                        'checkout and its own docs/plan govern story state and code; shared BMad '
                        'configuration does not make another checkout authoritative. Current owner '
                        'decisions defer Telugu work/tests/sign-off and use build-first, batched reviews.')
        role.write_text('developer_instructions = ' + q(instructions) + '\n', encoding='utf-8')
        roles.extend([f'[agents.{q(name)}]', f'description = {q(description)}', f'config_file = {q(role)}', ''])
    # Roles live in project configuration, so unrelated repositories keep their own agents.
    project_config = WORKSPACE / '.codex' / 'config.toml'
    project_original = project_config.read_text(encoding='utf-8') if project_config.exists() else ''
    project_updated = managed(project_original, '# BEGIN DHANYA AGENTS', '# END DHANYA AGENTS', '\n'.join(roles))
    tomllib.loads(project_updated)
    project_config.write_text(project_updated, encoding='utf-8')
    # The IDE currently opens the parent Projects folder. Expose the same role definitions there.
    outer_config = PROJECTS / '.codex' / 'config.toml'
    outer_config.parent.mkdir(parents=True, exist_ok=True)
    outer_original = outer_config.read_text(encoding='utf-8') if outer_config.exists() else ''
    outer_updated = managed(outer_original, '# BEGIN DHANYA AGENTS', '# END DHANYA AGENTS', '\n'.join(roles))
    tomllib.loads(outer_updated)
    outer_config.write_text(outer_updated, encoding='utf-8')
    # Worktree roots are separate Git project boundaries. Give them the same role
    # catalog and an explicit path to the shared context instead of relying on a
    # parent directory outside their repository being discovered.
    configured_checkouts = []
    for checkout in checkouts:
        local_config = checkout / '.codex' / 'config.toml'
        local_config.parent.mkdir(parents=True, exist_ok=True)
        before = local_config.read_text(encoding='utf-8') if local_config.exists() else ''
        after = managed(before, '# BEGIN DHANYA AGENTS', '# END DHANYA AGENTS', '\n'.join(roles))
        context_begin, context_end = '# BEGIN DHANYA CONTEXT', '# END DHANYA CONTEXT'
        without_context = re.sub(re.escape(context_begin) + r'.*?' + re.escape(context_end) + r'\n?', '', after, flags=re.S)
        if 'developer_instructions' not in tomllib.loads(without_context):
            context = (f'Read {WORKSPACE / "AGENTS.md"} for shared tool/workflow rules and '
                       f'{TOOLS / "context" / "CLAUDE-TO-CODEX.md"} when resuming project work. '
                       f'This checkout is {checkout}. Use its own docs/plan and Git branch '
                       'as the application source, rather than assuming the shared sandbox '
                       'checkout has the same code or progress. Inherit the selected Codex model.')
            after = managed(after, context_begin, context_end, 'developer_instructions = ' + q(context), prepend=True)
        tomllib.loads(after)
        local_config.write_text(after, encoding='utf-8')
        configured_checkouts.append(str(checkout))
    # Generated machine-local role registrations should not enter application commits.
    result = subprocess.run(['git', '-C', str(WORKSPACE / 'sandbox'), 'rev-parse', '--git-path', 'info/exclude'], capture_output=True, text=True)
    if result.returncode == 0:
        exclude = Path(result.stdout.strip())
        if not exclude.is_absolute(): exclude = WORKSPACE / 'sandbox' / exclude
        current = exclude.read_text(encoding='utf-8') if exclude.exists() else ''
        if '/.codex/' not in current.splitlines():
            exclude.parent.mkdir(parents=True, exist_ok=True)
            exclude.write_text(current.rstrip() + '\n/.codex/\n', encoding='utf-8')
    manifest = {
        'mcp_servers': names, 'skill_count': len(candidates) - len(skipped),
        'builtin_skills_preserved': skipped, 'agent_count': len(roles) // 4,
        'secrets_file': str(HOME / '.dhanya' / '.env'),
        'skills_location': str(skills_root), 'workspace': str(WORKSPACE),
        'skill_projection_root': str(TOOLS / 'codex-skills'),
        'skill_sources': {name: str(folder) for name, folder in candidates.items()},
        'bmad_personas': list(personas),
        'configured_checkouts': configured_checkouts,
    }
    (TOOLS / 'codex-runtime' / 'installation.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in manifest.items() if key != 'skill_sources'}, indent=2))

if __name__ == '__main__':
    main()
