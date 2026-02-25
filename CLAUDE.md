# CLAUDE.md - dashboardRalph

Agentic development system based on TAC (Tactical Agentic Coding), integrated with Thread-based Engineering and Claude Code.

## Project
Business dashboard — Next.js frontend + FastAPI backend.

## Stack
- Backend: FastAPI (Python)
- Frontend: Next.js + React
- DB: PostgreSQL
- Testing: pytest (backend) + jest/vitest (frontend)

## Configuration
- `.ralph.json` — Project config
- `justfile` — Command launchpad (`just` to list all recipes)
- `mprocs.yaml` — Dev services + agent orchestration

## Commands

### Full Lifecycle (one command)
```
just ralph-go "description"            # Full cycle: PRD -> branch -> build -> ship
just ralph-go "desc" --agents 5        # Custom agent count
just ralph-go "desc" --dry-run         # Preview phases without executing
```

### Individual Threads
```
just ralph-l [iterations]   # L-Thread: long-running loop
just ralph-p [count]         # P-Thread: parallel agents
just ralph-c                 # C-Thread: chained phases
just ralph-f "prompt"        # F-Thread: fusion analysis
just ralph-b                 # B-Thread: orchestrator
```

### Development
```
just serve                   # Start dev server (FastAPI + Next.js)
just serve-api               # Start FastAPI backend only
just serve-ui                # Start Next.js frontend only
just test [args]             # Run all tests (pytest + jest)
just test-api [args]         # Run backend tests (pytest)
just test-ui [args]          # Run frontend tests (jest/vitest)
```

### Observability
```
just observe                 # Launch mprocs dashboard
just prd-status              # PRD story status
just progress                # View progress log
```

## Architecture

```
CLAUDE.md                   # This file
.ralph.json                 # Project configuration
justfile                    # Command launchpad
mprocs.yaml                # Process orchestration

ralph/
  ralph-tac.sh              # TAC entry point (thread dispatcher)
  ralph-claude.sh           # L-Thread autonomous loop
  prd.json                  # Product Requirements Document
  progress.txt              # Session progress log
  scripts/
    ralph-go.sh             # Full lifecycle: idea -> shipped code
    common.sh               # Shared utilities (colors, PRD helpers)
    p-thread.sh             # P-Thread orchestrator
    f-thread.sh             # Fusion analysis runner
    observe.sh              # mprocs config generator
  prompts/                  # Agent instruction prompts
  metaprompts/              # Agent template prompts

.claude/
  settings.json             # Hook configuration
  hooks/                    # Python hooks (stop, log, validate)
  commands/                 # Slash commands (/go, /plan)
  agent-templates/          # Agent specialization templates
```

## Thread Types

| Thread | Pattern | Use Case |
|--------|---------|----------|
| **L** | Loop | Single agent iterating PRD stories |
| **P** | Parallel | Multiple agents, independent stories |
| **C** | Chain | Sequential phases with human checkpoints |
| **F** | Fusion | Same problem, multiple perspectives |
| **B** | Big | Orchestrator spawning specialist agents |

## Critical Rules

### Development
- ALWAYS run tests after changes
- Commit format: `feat|fix|test|docs(module): description`

### PRD Management
- NEVER modify prd.json structure without updating ralph-claude.sh parser
- Stories marked `passes: true` should NOT be modified

### Progress Tracking
- ALWAYS append to progress.txt, never replace
- Log git commit hashes when completing stories

### Git Workflow
- **NEVER push directly to `main`** — main is production
- **NEVER push directly to `develop`** — develop is staging
- All changes go in a branch: `feature/*`, `fix/*`, or `agent/*`
- PRs always target **`develop`** (staging), NEVER main
- PRs require **team approval** — never auto-approve
- Branch naming: `feature/[name]`, `fix/[name]`, `agent/[name]`
- Flow: `feature/* -> PR -> develop (staging) -> PR -> main (production)`

### Ralph Loop
- Stop signal: `<promise>COMPLETE</promise>` in agent output
- Progress file must exist for loop continuity
- Max iterations configurable in .ralph.json (default: 10)
