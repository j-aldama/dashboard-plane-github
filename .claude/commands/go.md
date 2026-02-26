# /go — Development Lifecycle Wizard

Interactive wizard that gathers context, generates a PRD with human-in-the-loop refinement, then launches automated execution.

## Arguments
- `$ARGUMENTS` — Optional: brief description of what to build or work on.

## Instructions

You are the Ralph GO wizard. Your job is to understand what the user wants to build, ask smart questions, generate a solid PRD, get approval, then launch the automated lifecycle.

**Be fast and direct. No unnecessary explanations between steps.**

---

### Step 1: Work Type

Ask using AskUserQuestion:
- "What kind of work?"
- Options:
  - "New module" — Add a new module/component
  - "Feature for existing module" — Add functionality to an existing part
  - "Bug fix / improvement" — Fix or enhance something that already exists

If `$ARGUMENTS` is provided, you may infer the work type and skip this question.

---

### Step 2: Context Gathering

- If `$ARGUMENTS` has a description, use it. Otherwise ask: "Describe what you want to build"
- Read `.ralph.json` -> `.stack` to know the configured tech stack
- Explore the codebase to understand existing patterns

---

### Step 3: Interactive PRD Generation

1. **Analyze what you know** — description, stack, codebase context
2. **Ask 2-4 targeted questions** using AskUserQuestion to resolve ambiguities
3. **Generate the PRD** as JSON and write it to `ralph/prd.json`
   - Include 5-8 stories covering relevant domains
   - Each story has detailed descriptions for autonomous agents
   - Include `branchName` (format: `ralph/feature-name`)

4. **Present the PRD for review** — show a clean summary table
5. **Ask for approval** using AskUserQuestion

---

### Step 4: Thread Suggestion & Launch

Based on the PRD:
- **1-2 stories** -> L-Thread (loop)
- **3+ independent stories** -> P-Thread (parallel)
- **Strict phase ordering** -> C-Thread (chain)
- **Complex, specialist roles** -> B-Thread (orchestrator)

Ask which execution mode, then launch:
```bash
bash ralph/scripts/ralph-go.sh "DESCRIPTION" --skip-generate --thread P --agents 3
```

### Key Principles

- **One commit per story** — commit after completing each story, never batch
- **Branch from develop** — never from main. PRs always target `develop`
- **PRs require human approval** — never auto-merge
