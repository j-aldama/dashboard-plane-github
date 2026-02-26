# /setup — Post-Bootstrap Configuration Wizard

Configure all `ADAPT:` markers in the project after running `setup-ralph.sh`.

## Arguments
- `$ARGUMENTS` — Optional: project description (e.g., "Django REST API for e-commerce")

## Instructions

You are the Ralph setup wizard. The bootstrap script (`setup-ralph.sh`) already created all files. Your job is to detect the stack, ask the user a few questions, and fill in the `ADAPT:` markers.

**Be fast and direct. No long explanations.**

---

### Step 1: Detect Environment

Run this diagnostic silently (don't show the user raw output, just summarize):

```bash
echo "=== Stack Detection ==="
[ -f "manage.py" ] && echo "DETECTED: Django (manage.py)"
[ -f "requirements.txt" ] && echo "DETECTED: Python requirements"
[ -f "pyproject.toml" ] && echo "DETECTED: Python pyproject.toml"
[ -f "package.json" ] && echo "DETECTED: Node.js (package.json)"
[ -f "go.mod" ] && echo "DETECTED: Go (go.mod)"
[ -f "Cargo.toml" ] && echo "DETECTED: Rust (Cargo.toml)"
[ -f "pom.xml" ] && echo "DETECTED: Java (pom.xml)"
[ -f "tsconfig.json" ] && echo "DETECTED: TypeScript"
[ -d "venv" ] || [ -d ".venv" ] && echo "DETECTED: Python venv"
[ -d "node_modules" ] && echo "DETECTED: node_modules"
[ -d ".git" ] && echo "DETECTED: Git repo"
[ -f ".ralph.json" ] && echo "DETECTED: .ralph.json exists"
[ -f "CLAUDE.md" ] && echo "DETECTED: CLAUDE.md exists"
echo "=== Directory Contents ==="
ls -la
```

Present a brief summary to the user: "Detected: [stack], [tools found]"

---

### Step 2: Ask Questions

Use **AskUserQuestion** to ask the following (skip questions you can infer from detection or `$ARGUMENTS`):

**Question 1: Stack confirmation**
- header: "Stack"
- question: "Which stack is this project using?"
- Options based on detection. Always include these:
  - "Django + DRF" (if manage.py detected, mark as recommended)
  - "FastAPI"
  - "Next.js / React"
  - "Node.js / Express"
- If nothing detected, also include: "Go", "Other"

**Question 2: Project info**
- header: "Project"
- question: "What's the project name and a one-line description?"
- This can be free text (use "Other" option flow or infer from `$ARGUMENTS`)
- If `$ARGUMENTS` provided, skip this and use it directly

**Question 3: Git setup** (only if `.git` does NOT exist)
- header: "Git"
- question: "How should we set up git?"
- Options:
  - "Initialize git + create develop branch (Recommended)"
  - "Initialize git only"
  - "Skip git setup"

**Question 4: Repository location** (only if user chose to initialize git in Q3)
- header: "Repo"
- question: "Where should the remote repository live?"
- Options:
  - "Organization repo (Recommended)" — `gh repo create ORG/project-name --private`. Ask for org name if not obvious.
  - "Personal repo" — `gh repo create project-name --private`
  - "Local only (no remote)" — just git init, no push

**Question 5: Testing** (only if not obvious from stack)
- header: "Testing"
- question: "What test command should Ralph use?"
- Options based on stack:
  - Django: "pytest" / "python manage.py test"
  - Node: "npm test" / "jest"
  - Go: "go test ./..."
  - Python: "pytest"

---

### Step 3: Configure Files

Based on the answers, edit these files using the Edit tool. Replace ALL `ADAPT:` markers.

#### .ralph.json

Replace:
- `"ADAPT: Project Name"` → actual project name
- `"PROJ"` → project identifier (uppercase abbreviation, e.g., "NHUB", "ECOM", "API")
- `"ADAPT: your test command here"` → actual test command
- `"ADAPT: django+drf | fastapi | express | go | etc"` → actual backend
- `"ADAPT: templates+tailwind | react | vue | etc"` → actual frontend
- `"ADAPT: pytest | jest | go test | etc"` → actual testing framework
- `"ADAPT: postgresql | mysql | sqlite | mongodb | etc"` → actual database
- Update `agents.backend` and `agents.frontend` paths to match actual project structure

#### CLAUDE.md

Replace all `ADAPT:` sections with real project info:
- Project description
- Stack details (backend, frontend, DB, testing)
- Development commands (serve, test, migrate, etc.)

#### justfile

Replace the `serve` and `test` recipes with actual commands:

**Django:**
```just
serve:
  source venv/bin/activate && python manage.py runserver 0.0.0.0:8000
test *args:
  source venv/bin/activate && pytest {{args}}
migrate:
  source venv/bin/activate && python manage.py migrate
makemigrations app="":
  source venv/bin/activate && python manage.py makemigrations {{app}}
```

**FastAPI:**
```just
serve:
  source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000
test *args:
  source venv/bin/activate && pytest {{args}}
```

**Next.js / Node:**
```just
serve:
  npm run dev
test *args:
  npm test {{args}}
build:
  npm run build
```

**Go:**
```just
serve:
  go run .
test *args:
  go test ./... {{args}}
build:
  go build -o bin/app .
```

#### mprocs.yaml

Update the `dev-server` shell command and `test-watch` to match the stack.

---

### Step 4: Git Setup (if requested)

If user chose to initialize git:

```bash
git init
git add -A
git commit -m "feat: initial project setup with Ralph TAC"
git checkout -b develop
```

If user chose a remote repository:

**Organization repo:**
```bash
# Ask for org name if not inferred (e.g., "Gebesa-Office-Furniture")
gh repo create ORG_NAME/PROJECT_NAME --private --source=. --push
git push -u origin develop
```

**Personal repo:**
```bash
gh repo create PROJECT_NAME --private --source=. --push
git push -u origin develop
```

**Local only:** No remote setup needed.

If `gh` is not installed, inform the user:
```
gh CLI not found. Install it with: brew install gh
Then authenticate: gh auth login
After that, you can create the remote repo manually:
  gh repo create ORG/project-name --private --source=. --push
```

---

### Step 5: Verification

Run:
```bash
bash -n ralph/ralph-tac.sh && echo "ralph-tac.sh OK"
bash -n ralph/ralph-claude.sh && echo "ralph-claude.sh OK"
bash -n ralph/scripts/common.sh && echo "common.sh OK"
bash -n ralph/scripts/p-thread.sh && echo "p-thread.sh OK"
python3 -m py_compile .claude/hooks/ralph_stop.py && echo "ralph_stop.py OK"
just --list 2>/dev/null && echo "justfile OK"
```

Check that no `ADAPT:` markers remain:
```bash
grep -r "ADAPT:" .ralph.json CLAUDE.md justfile mprocs.yaml 2>/dev/null || echo "No ADAPT markers remaining"
```

---

### Step 6: Show Summary

Show the user a clean summary:

```
Setup complete!

  Project:  [name]
  Stack:    [backend] + [frontend] + [testing]
  Git:      [initialized / already existed]
  Remote:   [org/repo-name | user/repo-name | local only | N/A]

  Next steps:
  1. Start developing:  just ralph-go "feature description"
  2. Or use wizard:     /go
  3. Dashboard:         just observe
  4. Interactive:       claude (CLAUDE.md gives context)
```
