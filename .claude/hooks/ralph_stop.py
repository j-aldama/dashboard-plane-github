#!/usr/bin/env python3
"""
Ralph Stop Hook - Validates story completion and controls loop continuation.

Checks if all stories in prd.json have passes: true.
Logs completion status to progress.txt.
Returns JSON status for loop control.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.parent.parent  # project root
RALPH_DIR = SCRIPT_DIR / "ralph"
PRD_FILE = RALPH_DIR / "prd.json"
PROGRESS_FILE = RALPH_DIR / "progress.txt"
LOG_FILE = SCRIPT_DIR / ".claude" / "logs" / "ralph_stop.log"


def log_message(message: str, level: str = "INFO"):
    timestamp = datetime.now().isoformat()
    log_line = f"[{timestamp}] [{level}] {message}"
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(log_line + "\n")
    print(log_line, file=sys.stderr)


def read_prd():
    if not PRD_FILE.exists():
        log_message(f"PRD file not found: {PRD_FILE}", "WARNING")
        return None
    try:
        with open(PRD_FILE) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        log_message(f"Invalid JSON in PRD: {e}", "ERROR")
        return None


def get_story_status(prd):
    stories = prd.get("userStories", [])
    total = len(stories)
    pending = []
    completed = 0
    for story in stories:
        if story.get("passes", False):
            completed += 1
        else:
            pending.append({
                "id": story.get("id", "unknown"),
                "title": story.get("title", "No title")
            })
    return total, completed, pending


def append_progress(message: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(PROGRESS_FILE, "a") as f:
        f.write(f"\n## [{timestamp}] Stop Hook Check\n")
        f.write(message + "\n")
        f.write("---\n")


def save_checkpoint(story_id: str, story_data: dict, outcome: str):
    checkpoint = {
        "type": "story_completion",
        "story_id": story_id,
        "title": story_data.get("title", ""),
        "outcome": outcome,
        "timestamp": datetime.now().isoformat()
    }
    checkpoint_dir = RALPH_DIR / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_file = checkpoint_dir / f"{story_id}.json"
    with open(checkpoint_file, "w") as f:
        json.dump(checkpoint, f, indent=2)
    log_message(f"Checkpoint saved: {checkpoint_file}", "INFO")


def check_completion():
    prd = read_prd()

    if prd is None:
        result = {"status": "no_prd", "message": "No PRD file found", "continue": False}
        print(json.dumps(result))
        return 0

    total, completed, pending = get_story_status(prd)

    if total == 0:
        result = {"status": "empty_prd", "message": "PRD has no stories", "continue": False}
        print(json.dumps(result))
        return 0

    if not pending:
        log_message(f"All {total} stories completed!", "SUCCESS")
        append_progress(f"All {total} stories completed successfully.")
        save_checkpoint("final", {"title": "All stories completed"}, "success")
        result = {"status": "complete", "message": f"All {total} stories passed", "continue": False, "total": total, "completed": completed}
        print(json.dumps(result))
        return 0
    else:
        pending_count = len(pending)
        next_story = pending[0]
        log_message(f"{pending_count} stories remaining. Next: {next_story['id']}")
        append_progress(f"Stories remaining: {pending_count}\nNext: {next_story['id']} - {next_story['title']}")

        for story in prd.get("userStories", []):
            if story.get("passes", False):
                save_checkpoint(story.get("id", "unknown"), story, "completed")

        result = {"status": "in_progress", "message": f"{pending_count} stories remaining", "continue": True, "total": total, "completed": completed, "pending": pending_count, "next_story": next_story}
        print(json.dumps(result))
        return 0


if __name__ == "__main__":
    try:
        sys.exit(check_completion())
    except Exception as e:
        log_message(f"Hook error: {e}", "ERROR")
        print(json.dumps({"status": "error", "message": str(e), "continue": False}))
        sys.exit(1)
