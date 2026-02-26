# /plan — Planning Mode

Generate an implementation plan for PRD stories, then hand off for execution.

## Arguments
- `$ARGUMENTS` — Optional: story ID to plan a specific story. If empty, plans all pending stories.

## Instructions

1. **Read the PRD** at `ralph/prd.json`. Show a summary of pending stories.

2. **Enter plan mode** with `EnterPlanMode`. Analyze the codebase and write a structured plan.

3. **Present the plan** to the user in a clear format:
   - Summary of what will be built
   - Files to create/modify
   - Implementation steps with acceptance criteria
   - Testing strategy

4. **Ask for approval**: Use `AskUserQuestion`:
   - "Approve plan and start implementation"
   - "Modify the plan" (let user give feedback, re-generate)
   - "Save plan only" (write to ralph/plan.md, don't implement)

5. **If approved for implementation**: Execute the plan step by step. For each story:
   - Implement the code changes
   - Run validation (see .ralph.json -> validation.testCommand)
   - Update `ralph/prd.json` story status to `passes: true`
   - Log progress to `ralph/progress.txt`
   - Commit: `feat(<module>): [Story ID] - [title]`

6. **On completion**: Show a summary of what was implemented.
