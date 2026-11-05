#!/usr/bin/env python3
"""Extract usage evidence from local Claude transcripts without exporting conversation text."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

tools_root = Path(__file__).resolve().parent
workspace = tools_root.parent
session_root = Path.home() / '.claude' / 'projects' / 'c--Users-rupen-OneDrive-Documents-Staffing-Personal-Projects'
counts = {key: Counter() for key in ['tools', 'skills_invoked', 'skills_read', 'agent_types', 'agent_models', 'message_models', 'npm_scripts', 'subagent_roles']}
files = sorted(session_root.rglob('*.jsonl'))
records = 0
invalid = 0
timestamps = []
read_paths = Counter()

for path in files:
    with path.open(encoding='utf-8') as handle:
        for line in handle:
            try: record = json.loads(line)
            except (ValueError, TypeError):
                invalid += 1
                continue
            records += 1
            timestamp = record.get('timestamp')
            if isinstance(timestamp, str): timestamps.append(timestamp)
            message = record.get('message', {})
            if not isinstance(message, dict): continue
            model = message.get('model')
            if isinstance(model, str) and re.fullmatch(r'[A-Za-z0-9_.:-]+', model):
                counts['message_models'][model] += 1
            content = message.get('content', [])
            if not isinstance(content, list): continue
            for item in content:
                if not isinstance(item, dict) or item.get('type') != 'tool_use': continue
                tool = item.get('name', '')
                if not re.fullmatch(r'[A-Za-z0-9_:.-]+', tool): continue
                counts['tools'][tool] += 1
                args = item.get('input', {})
                if not isinstance(args, dict): continue
                if tool in ['Skill', 'skill']:
                    name = args.get('skill', args.get('name', ''))
                    if isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9_:/.-]+', name): counts['skills_invoked'][name] += 1
                if tool in ['Agent', 'Task']:
                    for source, target in [('subagent_type', 'agent_types'), ('model', 'agent_models')]:
                        value = args.get(source, '')
                        if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_:.-]+', value): counts[target][value] += 1
                if tool in ['Read', 'read_file']:
                    filepath = args.get('file_path', args.get('path', ''))
                    if isinstance(filepath, str):
                        portable = filepath.replace('\\', '/')
                        match = re.search(r'/skills/([A-Za-z0-9_.-]+)/SKILL\.md$', portable)
                        if match: counts['skills_read'][match.group(1)] += 1
                        if '/docs/' in portable and portable.endswith(('.md', '.yaml', '.html')):
                            read_paths[portable.split('/docs/', 1)[1]] += 1
                if tool in ['Bash', 'exec_command']:
                    command = args.get('command', args.get('cmd', ''))
                    if isinstance(command, str):
                        for script in re.findall(r'\bnpm\s+run\s+([A-Za-z0-9_:.-]+)', command):
                            counts['npm_scripts'][script] += 1

for path in session_root.rglob('*.meta.json'):
    try: metadata = json.loads(path.read_text(encoding='utf-8'))
    except (ValueError, OSError): continue
    for key in ['agentType', 'agent_type', 'subagentType', 'subagent_type']:
        value = metadata.get(key)
        if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_:.-]+', value):
            counts['subagent_roles'][value] += 1

settings = {}
for label, path in [('user', Path.home() / '.claude' / 'settings.json'), ('project', workspace / '.claude' / 'settings.json')]:
    if not path.exists(): continue
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    # Select harmless metadata only. No credentials, arbitrary environment values or commands.
    settings[label] = {
        'keys': sorted(value),
        'model': value.get('model'),
        'configured_hook_events': sorted(value.get('hooks', {})),
        'enabled_plugin_names': sorted(name for name, enabled in value.get('enabledPlugins', {}).items() if enabled),
    }

skills_metadata = Counter()
substitutions = {}
import yaml
for folder in (Path.home() / '.agents' / 'skills').iterdir():
    path = folder / 'SKILL.md'
    if not path.is_file(): continue
    text = path.read_text(encoding='utf-8-sig')
    match = re.match(r'^---\s*\n(.*?)\n---', text, re.S)
    if match:
        header = yaml.safe_load(match.group(1))
        for key in header: skills_metadata[key] += 1
    found = sorted(set(re.findall(r'\$\{?(?:CLAUDE_(?:SESSION_ID|SKILL_DIR|PLUGIN_ROOT|PROJECT_DIR)|ARGUMENTS)\}?', text)))
    if found: substitutions[folder.name] = found

report = {
    'observed_at': datetime.now(timezone.utc).isoformat(),
    'source_directory': str(session_root),
    'transcript_files': len(files), 'records_read': records, 'invalid_records': invalid,
    'first_event': min(timestamps) if timestamps else None,
    'last_event': max(timestamps) if timestamps else None,
    **{name: dict(counter.most_common()) for name, counter in counts.items()},
    'docs_read_via_read_tool': dict(read_paths.most_common()),
    'settings': settings,
    'installed_skill_frontmatter_fields': dict(skills_metadata),
    'skills_with_claude_substitutions': substitutions,
    'limits': ['Counts are tool-call evidence, not proof of completion.', 'Shell reads and compacted/deleted transcript content can make skill-read counts incomplete.', 'Raw messages, tool arguments, outputs and credential values are not exported.'],
}
output = tools_root / 'context' / 'claude-session-audit.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2, ensure_ascii=False))
