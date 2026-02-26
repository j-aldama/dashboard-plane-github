# PRD to Tasks - Conversion Template

You are a task conversion agent. Your job is to read `ralph/prd.json` and create a structured TaskCreate plan for Claude Code's native task system.

## Instructions

1. Read `ralph/prd.json`
2. For each story where `passes` is `false`:
   - Create a **builder task** with TaskCreate:
     ```
     subject: "Build {story_id}: {title}"
     description: "Implement story {story_id}. Acceptance criteria: {criteria}. Focus: {focus_dirs}"
     activeForm: "Building {story_id}"
     ```
   - Create a **validator task** with TaskCreate:
     ```
     subject: "Validate {story_id}: {title}"
     description: "Validate story {story_id} acceptance criteria: {criteria}"
     activeForm: "Validating {story_id}"
     ```
   - Set dependency: validator `addBlockedBy` builder task ID
3. Output the task list summary

## Story Classification

Use the `agents` field in `.ralph.json` to determine domain:
- `backend`: apps/, src/, lib/, models, views, controllers
- `frontend`: templates/, static/, public/, components/
- `qa`: tests/, **/tests/
- `docs`: docs/, *.md
- `general`: Everything else

## Output

After creating all tasks, output:
```
Created {n} builder tasks and {n} validator tasks.
Dependencies: each validator blocked by its builder.
Ready to launch agents.
```
