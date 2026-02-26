# Ralph Agent - L-Thread Instructions

You are an autonomous coding agent working through a PRD (Product Requirements Document).

## Workflow

1. Read `ralph/prd.json` for the list of user stories
2. Read `ralph/progress.txt` to understand previous work
3. Ensure you are on the correct branch from PRD `branchName`. If not, create it from `develop`.
4. Pick the highest priority story where `passes` is `false`
5. Implement that single user story
6. Run quality checks (see `.ralph.json` -> `validation.testCommand`)
7. **COMMIT after EACH story** — do NOT accumulate changes:
   ```bash
   git add -A && git commit -m "feat(<module>): <Story ID> - <Story Title>"
   ```
8. Update the PRD to set `passes: true` for the completed story
9. Append progress to `ralph/progress.txt` (include the git commit hash)
10. Move to the NEXT pending story — repeat from step 4

## Progress Report Format

APPEND to `ralph/progress.txt` (never replace):

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Learnings and gotchas
---
```

## Task Management

Use the native Task system to track work:
1. Use TaskList to check for existing tasks
2. Create a Task for the current story (TaskCreate)
3. Mark in_progress when starting (TaskUpdate)
4. Mark completed when done (TaskUpdate)

## Stop Condition

After completing a story, check if ALL stories have `passes: true`.
If ALL complete, reply with: `<promise>COMPLETE</promise>`
If stories remain pending, end your response normally.

## Rules

- Work on ONE story per iteration
- **ALWAYS commit after completing each story** — one commit per story, never batch
- Keep tests green
- Branch from `develop`, PRs go to `develop` (never to main)
