#!/usr/bin/env python3
"""Local, read-only replacement for Claude's Dhanya progress pane."""
from collections import Counter
import argparse
import json
from pathlib import Path
import subprocess
import yaml

workspace = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--json', action='store_true')
parser.add_argument('--checkout', type=Path, default=workspace / 'sandbox')
args = parser.parse_args()
checkout = args.checkout.resolve()
tracker = checkout / 'docs' / 'plan' / 'sprint-status.yaml'
status = yaml.safe_load(tracker.read_text(encoding='utf-8-sig'))
stories = status.get('stories', [])
needs = json.loads((workspace / 'ai-tools' / 'progress' / 'owner-needs.json').read_text(encoding='utf-8-sig'))
items = needs if isinstance(needs, list) else needs.get('items', needs.get('needs', []))
def git(*argv):
    result = subprocess.run(['git', '-C', str(checkout), *argv], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else 'unavailable'
report = {
    'checkout': str(checkout), 'branch': git('branch', '--show-current'),
    'tracker_updated': str(status.get('updated', 'unknown')),
    'counts': dict(Counter(story.get('status', 'unknown') for story in stories)),
    'total': len(stories),
    'working': [story for story in stories if story.get('status') in ['in-progress', 'review', 'blocked']],
    'next_todo_candidates': [story for story in stories if story.get('status') == 'todo'][:5],
    'owner_needs': [item for item in items if item.get('status') != 'done'],
    'worktrees': git('worktree', 'list', '--porcelain'),
    'limits': 'Tracker status is branch-local and can lag other branches or merged PRs. Todo candidates have not been dependency-checked.',
}
if args.json:
    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))
else:
    print(f'Dhanya - {report["branch"]}')
    print(f'{report["counts"].get("done", 0)}/{report["total"]} stories marked done in this checkout')
    print('Counts: ' + ', '.join(f'{key} {value}' for key, value in report['counts'].items()))
    print('Working: ' + (', '.join(f'{story["id"]} {story["title"]} ({story["status"]})' for story in report['working']) or 'none recorded'))
    print('Next todo candidates: ' + ', '.join(story['id'] for story in report['next_todo_candidates']))
    print(f'Open owner-needs entries: {len(report["owner_needs"])}')
    print(report['limits'])
    print('\nWorking copies:\n' + git('worktree', 'list'))
