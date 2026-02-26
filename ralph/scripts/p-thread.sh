#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# p-thread.sh - Parallel Thread via Native Task System
# ═══════════════════════════════════════════════════════════════
# Strategies (configured in .ralph.json -> threads.parallelStrategy):
#   "shared"    - One orchestrator, sub-agents share same directory (default)
#   "worktrees" - Each agent gets its own git worktree + branch
#
# Usage:
#   ./p-thread.sh                  # Auto-detect from prd.json (max 3)
#   ./p-thread.sh 5                # Up to 5 parallel stories
#   ./p-thread.sh --worktrees      # Force worktree strategy
#   ./p-thread.sh --shared         # Force shared strategy
#   ./p-thread.sh --dry-run        # Preview without executing
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$RALPH_DIR")"
source "${SCRIPT_DIR}/common.sh"

PRD_FILE="${RALPH_DIR}/prd.json"
PROGRESS_FILE="${RALPH_DIR}/progress.txt"
PROMPT_FILE="${RALPH_DIR}/prompts/p-thread-orchestrator.md"
MAX_PARALLEL=${MAX_PARALLEL:-5}

run_shared() {
    local count="$1"
    local base_branch="$2"

    if [[ -n "$base_branch" ]]; then
        cd "$PROJECT_ROOT"
        ensure_branch "$base_branch"
        log_info "P-THREAD" "Base branch: $base_branch"
    fi

    local branch_context=""
    if [[ -n "$base_branch" ]]; then
        branch_context="
## Git Branch Strategy
- Base branch: \`$base_branch\` (already checked out)
- All agents work on this SAME branch (shared working directory)
- CRITICAL: Each agent must commit its own story BEFORE the next agent starts on a shared file
- Commit format: git add <story-files> && git commit -m \"feat(\$module): \$story_id - \$title\"
- ONE commit per story — never batch multiple stories into one commit
- If two stories touch the same file, run them SEQUENTIALLY (not in parallel)
- Stories that do NOT share files CAN run in parallel"
    fi

    local full_prompt=""
    if [[ -f "$PROMPT_FILE" ]]; then
        full_prompt="$(cat "$PROMPT_FILE")

## Context
- PRD: $PRD_FILE
- Max parallel stories: $count
- Progress file: $PROGRESS_FILE${branch_context}"
    else
        full_prompt="You are a P-Thread orchestrator. Read ralph/prd.json and work on up to $count pending stories in parallel using the Task tool.

For each pending story:
1. Create a Task (TaskCreate) with the story details
2. Launch a sub-agent (Task tool, subagent_type: general-purpose) to implement it
3. After the builder finishes, launch a validator agent to verify the work

Use TaskList to monitor progress. When all stories are complete, update prd.json and reply with <promise>COMPLETE</promise>.
${branch_context}
Read ralph/prd.json now and begin."
    fi

    local orch_model
    orch_model=$(resolve_model "orchestrator")
    log_info "P-THREAD" "Orchestrator model: $orch_model"

    cd "$PROJECT_ROOT"
    claude_with_model "$orch_model" "$full_prompt" || \
        claude -p "$full_prompt" --dangerously-skip-permissions
}

run_worktrees() {
    local count="$1"
    local base_branch="$2"
    shift 2
    local story_ids=("$@")

    if [[ -z "$base_branch" ]]; then
        log_error "P-THREAD" "Worktree strategy requires branchName in PRD"
        exit 1
    fi

    local worktree_base
    worktree_base=$(get_worktree_base)

    cd "$PROJECT_ROOT"
    ensure_branch "$base_branch"

    local selected_stories=()
    local i=0
    for sid in "${story_ids[@]}"; do
        [[ $i -ge $count ]] && break
        selected_stories+=("$sid")
        ((i++))
    done

    log_info "P-THREAD" "Creating ${#selected_stories[@]} worktrees in $worktree_base"
    local worktree_dirs=()
    for story_id in "${selected_stories[@]}"; do
        local dir
        dir=$(setup_worktree "$base_branch" "$story_id" "$worktree_base")
        worktree_dirs+=("$dir")

        cp -r "$PROJECT_ROOT/ralph" "$dir/ralph" 2>/dev/null || true
        cp -r "$PROJECT_ROOT/.claude" "$dir/.claude" 2>/dev/null || true
        cp "$PROJECT_ROOT/.ralph.json" "$dir/.ralph.json" 2>/dev/null || true
        cp "$PROJECT_ROOT/CLAUDE.md" "$dir/CLAUDE.md" 2>/dev/null || true
    done

    echo ""
    log_info "P-THREAD" "Launching ${#selected_stories[@]} parallel agents"
    echo ""

    local agent_model
    agent_model=$(resolve_model "implementation")

    local prompt_template=""
    if [[ -f "$PROMPT_FILE" ]]; then
        prompt_template=$(cat "$PROMPT_FILE")
    fi

    local pids=()
    local log_dir="${worktree_base}/.logs"
    mkdir -p "$log_dir"

    for i in "${!selected_stories[@]}"; do
        local story_id="${selected_stories[$i]}"
        local worktree_dir="${worktree_dirs[$i]}"
        local title
        title=$(get_story_title "$PRD_FILE" "$story_id")
        local log_file="${log_dir}/${story_id}.log"

        local story_json
        story_json=$(jq --arg id "$story_id" '.userStories[] | select(.id == $id)' "$PRD_FILE")

        local story_prompt="You are a builder agent working on story $story_id: $title

## Story Details
$story_json

## Instructions
1. You are in a git worktree on branch \`${base_branch}/${story_id}\`
2. Implement ONLY this story — do not touch other stories
3. Read the relevant files, implement the changes, and write tests
4. Run tests to validate
5. Git commit your changes with: git add -A && git commit -m \"feat($story_id): $title\"
6. Update ralph/prd.json to set passes: true for story $story_id
7. When done, reply with: <promise>COMPLETE</promise>

## Project Context
$(cat "$PROJECT_ROOT/CLAUDE.md" 2>/dev/null | head -50)"

        log_info "P-THREAD" "[$story_id] Starting in $worktree_dir"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] P-THREAD: Agent $story_id starting in worktree" >> "$PROGRESS_FILE"

        (
            cd "$worktree_dir"
            if claude --model "$agent_model" -p "$story_prompt" --dangerously-skip-permissions > "$log_file" 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] P-THREAD: Agent $story_id COMPLETED" >> "$PROGRESS_FILE"
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] P-THREAD: Agent $story_id FAILED (exit $?)" >> "$PROGRESS_FILE"
            fi
        ) &
        pids+=($!)

        log_info "P-THREAD" "[$story_id] PID: ${pids[-1]} | Log: $log_file"
    done

    echo ""
    log_info "P-THREAD" "All agents launched. Waiting for completion..."
    log_info "P-THREAD" "Monitor logs: tail -f ${log_dir}/*.log"
    log_info "P-THREAD" "Monitor progress: tail -f $PROGRESS_FILE"
    echo ""

    local failed=0
    for i in "${!pids[@]}"; do
        local pid="${pids[$i]}"
        local story_id="${selected_stories[$i]}"
        if wait "$pid"; then
            log_success "P-THREAD" "[$story_id] Completed (PID $pid)"
        else
            log_error "P-THREAD" "[$story_id] Failed (PID $pid)"
            ((failed++))
        fi
    done

    echo ""

    if [[ $failed -eq 0 ]]; then
        log_info "P-THREAD" "All agents complete. Starting merge phase..."
        cd "$PROJECT_ROOT"

        for i in "${!selected_stories[@]}"; do
            local story_id="${selected_stories[$i]}"
            local worktree_dir="${worktree_dirs[$i]}"
            local wt_prd="${worktree_dir}/ralph/prd.json"
            if [[ -f "$wt_prd" ]]; then
                local passed
                passed=$(jq --arg id "$story_id" '.userStories[] | select(.id == $id) | .passes' "$wt_prd" 2>/dev/null)
                if [[ "$passed" == "true" ]]; then
                    local tmp
                    tmp=$(jq --arg id "$story_id" '(.userStories[] | select(.id == $id)).passes = true' "$PRD_FILE")
                    echo "$tmp" > "$PRD_FILE"
                    log_success "P-THREAD" "[$story_id] Marked as passed in main PRD"
                fi
            fi
        done

        merge_worktree_branches "$base_branch" "${selected_stories[@]}"
        cleanup_worktrees "$worktree_base" "${selected_stories[@]}"
    else
        log_warning "P-THREAD" "$failed agents failed. Worktrees preserved for debugging."
        log_warning "P-THREAD" "Inspect: ls $worktree_base/"
        log_warning "P-THREAD" "Logs: ls ${log_dir}/"
        log_warning "P-THREAD" "After fixing, merge manually:"
        for story_id in "${selected_stories[@]}"; do
            echo "  git merge ${base_branch}/${story_id}"
        done
    fi
}

main() {
    local count=3
    local dry_run=false
    local force_strategy=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run) dry_run=true; shift ;;
            --worktrees) force_strategy="worktrees"; shift ;;
            --shared) force_strategy="shared"; shift ;;
            --help|-h)
                echo "P-Thread: Parallel Agent Orchestrator"
                echo ""
                echo "Usage: ./p-thread.sh [count] [--dry-run] [--worktrees|--shared]"
                echo ""
                echo "  count        Max parallel stories (default: 3, max: $MAX_PARALLEL)"
                echo "  --dry-run    Preview stories without executing"
                echo "  --worktrees  Force worktree strategy (each agent = own branch + directory)"
                echo "  --shared     Force shared strategy (one orchestrator, same directory)"
                exit 0
                ;;
            [0-9]*) count=$1; shift ;;
            *) log_error "P-THREAD" "Unknown: $1"; exit 1 ;;
        esac
    done

    [[ $count -gt $MAX_PARALLEL ]] && count=$MAX_PARALLEL

    echo ""
    log_thread "P" "Parallel Agent Orchestrator"
    echo ""

    check_prd "$PRD_FILE"
    get_prd_summary "$PRD_FILE"
    echo ""

    local strategy="${force_strategy:-$(get_parallel_strategy)}"
    log_info "P-THREAD" "Strategy: $strategy"

    local stories_str
    stories_str=$(get_pending_stories "$PRD_FILE")
    if [[ -z "$stories_str" ]]; then
        log_warning "P-THREAD" "No pending stories"
        exit 0
    fi

    local story_ids=()
    local story_count=0
    while IFS= read -r story_id; do
        [[ $story_count -ge $count ]] && break
        story_ids+=("$story_id")
        local title
        title=$(get_story_title "$PRD_FILE" "$story_id")
        echo -e "  ${CYAN}$story_id${NC} - $title"
        ((story_count++))
    done <<< "$stories_str"
    echo ""

    if [[ "$dry_run" == "true" ]]; then
        log_warning "P-THREAD" "DRY RUN - $story_count stories, strategy: $strategy"
        if [[ "$strategy" == "worktrees" ]]; then
            local wt_base
            wt_base=$(get_worktree_base)
            log_info "P-THREAD" "Worktrees would be created in: $wt_base"
            for sid in "${story_ids[@]}"; do
                echo -e "  ${CYAN}$wt_base/$sid${NC} -> branch: $(get_prd_branch "$PRD_FILE")/$sid"
            done
        fi
        exit 0
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] P-THREAD: Launching $story_count agents (strategy: $strategy)" >> "$PROGRESS_FILE"

    local base_branch
    base_branch=$(get_prd_branch "$PRD_FILE")

    case "$strategy" in
        worktrees)
            run_worktrees "$count" "$base_branch" "${story_ids[@]}"
            ;;
        shared|*)
            run_shared "$count" "$base_branch"
            ;;
    esac

    log_success "P-THREAD" "Complete"
}

main "$@"
