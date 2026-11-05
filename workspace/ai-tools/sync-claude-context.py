#!/usr/bin/env python3
"""Copy reviewed project memory notes for cross-harness recall; never copy raw transcripts."""
from pathlib import Path
import re

tools = Path(__file__).resolve().parent
source = Path.home() / '.claude' / 'projects' / 'c--Users-rupen-OneDrive-Documents-Staffing-Personal-Projects' / 'memory'
target = tools / 'context' / 'claude-memory'
target.mkdir(parents=True, exist_ok=True)
secret_pattern = re.compile(r'(?:ghp_|github_pat_|xkeysib-|npg_|napi_|sbp_)[A-Za-z0-9_-]{12,}')
secret_values = []
secret_file = Path.home() / '.dhanya' / '.env'
if secret_file.exists():
    for line in secret_file.read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=(.*)$', line)
        if match and re.search(r'TOKEN|SECRET|API_KEY|DATABASE_URL', match.group(1)):
            value = match.group(2).strip().strip('\"\'')
            if len(value) >= 8: secret_values.append(value)
count = 0
for path in sorted(source.glob('*.md')):
    text = path.read_text(encoding='utf-8-sig')
    for value in sorted(secret_values, key=len, reverse=True): text = text.replace(value, '[REDACTED]')
    text = secret_pattern.sub('[REDACTED]', text)
    # These are the small memory notes only. Transcript files, credentials and tool-output
    # captures may contain historical secrets and are deliberately not copied.
    (target / path.name).write_text(text, encoding='utf-8')
    count += 1
print(f'Copied {count} project memory notes; no transcripts or authentication files copied.')
