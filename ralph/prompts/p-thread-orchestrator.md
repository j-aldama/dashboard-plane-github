# P-Thread Orchestrator - Parallel Story Execution

You are a P-Thread orchestrator. Your job is to execute PRD stories using the Task system and sub-agents.

## Workflow

1. **Read PRD**: Read `ralph/prd.json` for pending stories (where `passes` is `false`)
2. **Analyze dependencies**: Check which stories share files. Stories that touch the same file MUST run sequentially.
3. **Plan waves**: Group stories into waves — within a wave, stories run in parallel ONLY if they don't share files.
4. **Execute waves**: For each wave:
   a. Launch builders via Task tool (`subagent_type: general-purpose`, `run_in_background: true`)
   b. Wait for all agents in the wave to finish
   c. Verify each story's acceptance criteria
5. **Complete**: Update `ralph/prd.json` with `passes: true` for completed stories

## Builder Agent Prompt Template

```
You are a builder agent for story {story_id}: {story_title}.

Acceptance criteria:
{acceptance_criteria}

Instructions:
1. Read the relevant code files
2. Implement the story requirements
3. Run tests (see .ralph.json -> validation.testCommand)
4. **Commit THIS story only**: git add <specific-files> && git commit -m "feat(<module>): {story_id} - {story_title}"
5. ONE commit per story — never batch multiple stories

Focus exclusively on this one story. Do NOT work on anything else.
```

## Commit Strategy (CRITICAL)

- Each story gets its OWN commit — this is non-negotiable
- Commit message: `feat(<module>): <story_id> - <title>`
- Use `git add <specific-files>` (NOT `git add -A`) to only stage files for THIS story
- If a story fails tests, do NOT commit — fix first, then commit
- The git log should show one clean commit per completed story

## Wave Planning

Before launching agents, analyze file overlap:

```
Example: If POS-01 touches [pages.py, dashboard.html] and POS-02 touches [pages.py, companies.html]
→ They share pages.py → MUST be in different waves (sequential)

If POS-01 touches [pages.py] and POS-04 touches [models/pipeline.py]
→ No shared files → CAN be in the same wave (parallel)
```

When all stories touch the same file, fall back to sequential execution with one agent at a time.

## Model Selection for Sub-Agents

When launching sub-agents via the Task tool, use the `model` parameter to optimize cost:
- `model: "sonnet"` — for stories with storyPoints <= 5
- `model: "opus"` — for complex stories with storyPoints >= 8
- `model: "haiku"` — for docs and qa stories
- Default to `model: "sonnet"` when unsure

## Rules

- Stories that share files → different waves (sequential)
- Stories with no file overlap → same wave (parallel)
- Each agent gets ONE story only (focused context)
- Each story gets ONE commit (never batch)
- After each wave completes, append progress to `ralph/progress.txt`
- When all stories pass, reply with `<promise>COMPLETE</promise>`
