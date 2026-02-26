#!/usr/bin/env python3
"""
Action Logger Hook - Logs tool usage for observability.

Captures PostToolUse events to track agent activity.
Logs to .claude/logs/ for debugging AND to ralph/progress.txt
for real-time visibility of what agents are doing.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.parent.parent
LOG_DIR = SCRIPT_DIR / ".claude" / "logs"
ACTIONS_LOG = LOG_DIR / "actions.log"
ACTIONS_JSON = LOG_DIR / "actions.jsonl"
PROGRESS_FILE = SCRIPT_DIR / "ralph" / "progress.txt"

# Patterns that indicate significant Bash commands (stack-agnostic)
SIGNIFICANT_BASH_PATTERNS = {
    "pytest": "Test",
    "jest": "Test",
    "vitest": "Test",
    "mocha": "Test",
    "npm test": "Test",
    "npm run test": "Test",
    "cargo test": "Test",
    "go test": "Test",
    "migration": "Migration",
    "migrate": "Migration",
    "git commit": "Commit",
    "git add": "Stage",
    "lint": "Lint",
    "build": "Build",
}


def ensure_log_dir():
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def get_event_data():
    try:
        if not sys.stdin.isatty():
            input_data = sys.stdin.read()
            if input_data.strip():
                return json.loads(input_data)
    except (json.JSONDecodeError, IOError):
        pass
    return {
        "tool": os.environ.get("CLAUDE_TOOL", "unknown"),
        "event_type": os.environ.get("CLAUDE_EVENT_TYPE", "unknown"),
        "timestamp": datetime.now().isoformat()
    }


def make_relative(file_path):
    """Convert absolute path to relative from project root."""
    project_str = str(SCRIPT_DIR) + "/"
    if file_path.startswith(project_str):
        return file_path[len(project_str):]
    return file_path


def append_progress(message):
    """Append a progress line to ralph/progress.txt."""
    if not PROGRESS_FILE.exists():
        return
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(PROGRESS_FILE, "a") as f:
            f.write(f"[{timestamp}] AGENT: {message}\n")
    except IOError:
        pass


def log_progress(event):
    """Log significant actions to progress.txt for real-time visibility."""
    tool = event.get("tool_name", event.get("tool", ""))
    tool_input = event.get("tool_input", {})

    if not isinstance(tool_input, dict):
        return

    # File modifications
    if tool in ("Write", "Edit", "MultiEdit"):
        file_path = tool_input.get("file_path", "")
        if file_path:
            rel = make_relative(file_path)
            if "progress.txt" in rel or ".claude/logs" in rel:
                return
            action = "Edit" if tool in ("Edit", "MultiEdit") else "Write"
            append_progress(f"{action} {rel}")

    # Significant bash commands
    elif tool == "Bash":
        command = tool_input.get("command", "")
        for pattern, label in SIGNIFICANT_BASH_PATTERNS.items():
            if pattern in command:
                cmd_short = command[:100].replace("\n", " ")
                append_progress(f"{label}: {cmd_short}")
                break


def log_action(event):
    ensure_log_dir()
    timestamp = datetime.now().isoformat()
    tool = event.get("tool_name", event.get("tool", "unknown"))
    event_type = event.get("event_type", "PostToolUse")
    log_line = f"[{timestamp}] {event_type}: {tool}"

    with open(ACTIONS_LOG, "a") as f:
        f.write(log_line + "\n")

    event["logged_at"] = timestamp
    with open(ACTIONS_JSON, "a") as f:
        f.write(json.dumps(event) + "\n")

    print(log_line, file=sys.stderr)

    # Log significant actions to progress.txt
    log_progress(event)


def main():
    try:
        event = get_event_data()
        log_action(event)
        return 0
    except Exception as e:
        print(f"Log hook error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
