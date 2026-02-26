#!/usr/bin/env python3
"""Parse Claude's PRD output into clean JSON.

Reads from stdin, strips markdown fences, extracts JSON object,
writes formatted JSON to stdout. Exit 1 on failure.
"""
import sys, json, re

text = sys.stdin.read()
text = re.sub(r'^```json?\s*', '', text.strip())
text = re.sub(r'```\s*$', '', text.strip())
try:
    obj = json.loads(text)
    print(json.dumps(obj, indent=2))
except Exception:
    match = re.search(r'\{[^{}]*"userStories".*', text, re.DOTALL)
    if match:
        candidate = match.group(0)
        depth = 0
        for i, c in enumerate(candidate):
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(candidate[:i+1])
                    print(json.dumps(obj, indent=2))
                    sys.exit(0)
                except Exception:
                    pass
                break
    print('{"error":"parse_failed"}', file=sys.stderr)
    sys.exit(1)
