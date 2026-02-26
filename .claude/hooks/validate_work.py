#!/usr/bin/env python3
"""
validate_work.py - PostToolUse self-validation hook

Detects file type after Write/Edit operations and suggests
running the appropriate linter/checker.
"""

import json
import os
import sys


def get_tool_input():
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "")
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "{}")
    try:
        input_data = json.loads(tool_input)
    except json.JSONDecodeError:
        input_data = {}
    return tool_name, input_data


def detect_file_type(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    type_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".tsx": "typescript", ".jsx": "javascript", ".html": "html",
        ".go": "go", ".rs": "rust",
    }
    return type_map.get(ext)


def get_validation_command(file_type, project_root):
    if file_type == "python":
        if os.path.exists(os.path.join(project_root, "pyproject.toml")):
            return "pytest --tb=short -q"
        if os.path.exists(os.path.join(project_root, "manage.py")):
            return "python manage.py check"
        return None
    if file_type in ("javascript", "typescript"):
        pkg_json = os.path.join(project_root, "package.json")
        if os.path.exists(pkg_json):
            try:
                with open(pkg_json) as f:
                    pkg = json.load(f)
                scripts = pkg.get("scripts", {})
                if "lint" in scripts:
                    return "npm run lint"
            except (json.JSONDecodeError, IOError):
                pass
        return None
    if file_type == "go":
        return "go vet ./..."
    return None


def main():
    tool_name, input_data = get_tool_input()
    if tool_name not in ("Write", "Edit", "MultiEdit"):
        return

    file_path = input_data.get("file_path", "")
    if not file_path:
        file_path = input_data.get("edits", [{}])[0].get("file_path", "") if isinstance(input_data.get("edits"), list) else ""
    if not file_path:
        return

    file_type = detect_file_type(file_path)
    if not file_type:
        return

    project_root = os.path.dirname(file_path)
    markers = ["pyproject.toml", "manage.py", "package.json", "go.mod", "Cargo.toml", ".git"]
    for _ in range(10):
        if any(os.path.exists(os.path.join(project_root, m)) for m in markers):
            break
        parent = os.path.dirname(project_root)
        if parent == project_root:
            break
        project_root = parent

    validation_cmd = get_validation_command(file_type, project_root)
    if validation_cmd:
        result = {"decision": "ALLOW", "reason": f"Consider running `{validation_cmd}` to validate {file_type} changes"}
        print(json.dumps(result))
    else:
        print(json.dumps({"decision": "ALLOW"}))


if __name__ == "__main__":
    main()
