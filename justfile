set dotenv-load := true

# List all recipes
default:
  @just --list

# === Development ===

# Start both FastAPI backend and Next.js frontend
serve:
  mprocs --config mprocs.yaml

# Start FastAPI backend only
serve-api:
  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Start Next.js frontend only
serve-ui:
  cd frontend && npm run dev

# Run all tests (backend + frontend)
test *args:
  just test-api {{args}} && just test-ui {{args}}

# Run backend tests
test-api *args:
  pytest {{args}}

# Run frontend tests
test-ui *args:
  cd frontend && npm test {{args}}

# === Ralph TAC Threads ===

# L-Thread: Long-running autonomous loop
ralph-l iterations="10":
  ./ralph/ralph-tac.sh L {{iterations}}

# P-Thread: Parallel agents
ralph-p count="3" *args="":
  ./ralph/ralph-tac.sh P {{count}} {{args}}

# C-Thread: Chained phases with checkpoints
ralph-c:
  ./ralph/ralph-tac.sh C

# F-Thread: Fusion analysis
ralph-f prompt:
  ./ralph/ralph-tac.sh F "{{prompt}}"

# B-Thread: Orchestrator with sub-agents
ralph-b:
  ./ralph/ralph-tac.sh B

# Full lifecycle: idea -> PRD -> branch -> plan -> build -> validate -> ship -> track
ralph-go description *args:
  ./ralph/scripts/ralph-go.sh "{{description}}" {{args}}

# === Observability ===

# Launch mprocs dashboard
observe:
  mprocs

# Show PRD status summary
prd-status:
  @jq -r '.userStories[] | "\(.id) - \(.title) - \(if .passes then "DONE" else "PENDING" end)"' ralph/prd.json

# Show only pending stories
prd-pending:
  @jq -r '.userStories[] | select(.passes == false) | "\(.id) - \(.title)"' ralph/prd.json

# Show PRD summary with counts
prd-summary:
  #!/usr/bin/env bash
  TOTAL=$(jq '.userStories | length' ralph/prd.json)
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' ralph/prd.json)
  PENDING=$(jq '[.userStories[] | select(.passes == false)] | length' ralph/prd.json)
  echo "PRD Summary:"
  echo "  Total:   $TOTAL stories"
  echo "  Done:    $DONE"
  echo "  Pending: $PENDING"
  echo ""
  echo "Progress: $(echo "scale=1; $DONE * 100 / $TOTAL" | bc)%"

# View progress log (last 50 lines)
progress:
  @tail -n 50 ralph/progress.txt

# Follow progress log live
progress-live:
  @tail -f ralph/progress.txt

# === Utilities ===

# Reset project artifacts
reset:
  rm -rf ralph/checkpoints/*
  rm -f .claude/hooks/*.log
  rm -f .claude/logs/*.log
  rm -f .claude/logs/*.jsonl
