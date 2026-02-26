#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ralph-go.sh - Full Development Lifecycle in One Command
# ═══════════════════════════════════════════════════════════════
#
# From idea to shipped code:
#   ralph-go "description" -> PRD -> branch -> plan -> build -> validate -> ship -> track
#
# Usage:
#   ./ralph-go.sh "Add notifications module"
#   ./ralph-go.sh "description" --agents 5
#   ./ralph-go.sh "description" --dry-run
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$RALPH_DIR")"
source "${SCRIPT_DIR}/common.sh"

PRD_FILE="${RALPH_DIR}/prd.json"
PROGRESS_FILE="${RALPH_DIR}/progress.txt"

DESCRIPTION=""
EXEC_MODE=""
AGENT_COUNT=3
THREAD_TYPE="P"
SKIP_GENERATE=false
SKIP_PLAN=false
SKIP_PR=false
SKIP_PLANE=false
PRD_ONLY=false
DRY_RUN=false

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local) EXEC_MODE="local"; shift ;;
            --agents) AGENT_COUNT="$2"; shift 2 ;;
            --thread) THREAD_TYPE="$2"; shift 2 ;;
            --skip-generate) SKIP_GENERATE=true; shift ;;
            --skip-plan) SKIP_PLAN=true; shift ;;
            --skip-pr) SKIP_PR=true; shift ;;
            --skip-plane) SKIP_PLANE=true; shift ;;
            --prd-only) PRD_ONLY=true; shift ;;
            --dry-run) DRY_RUN=true; shift ;;
            --help|-h)
                echo "ralph-go: Full Development Lifecycle"
                echo ""
                echo "Usage: ralph-go.sh \"description\" [options]"
                echo ""
                echo "Options:"
                echo "  --agents N        Number of parallel agents (default: 3)"
                echo "  --thread T        Thread type: P|L|C|B (default: P)"
                echo "  --skip-generate   Skip PRD generation (use existing)"
                echo "  --skip-plan       Skip planning phase"
                echo "  --skip-pr         Skip PR creation"
                echo "  --skip-plane      Skip Plane sync"
                echo "  --prd-only        Generate PRD + branch only (phases 1-3), then stop"
                echo "  --dry-run         Show phases without executing"
                exit 0
                ;;
            *)
                if [[ -z "$DESCRIPTION" ]]; then DESCRIPTION="$1"
                else log_error "RALPH-GO" "Unexpected argument: $1"; exit 1
                fi
                shift ;;
        esac
    done

    if [[ -z "$DESCRIPTION" && "$SKIP_GENERATE" != "true" ]]; then
        log_error "RALPH-GO" "Usage: ralph-go.sh \"project description\" [--agents N]"
        exit 1
    fi

    if [[ -z "$EXEC_MODE" ]]; then
        EXEC_MODE=$(read_config '.execution.mode' 'local' "${PROJECT_ROOT}/.ralph.json")
    fi
}

phase_generate() {
    echo ""; echo -e "${YELLOW}═══ Phase 1/7: GENERATE ═══${NC}"; echo ""

    if [[ "$SKIP_GENERATE" == "true" ]]; then
        if ! jq -e '.userStories | length > 0' "$PRD_FILE" &>/dev/null; then
            log_error "RALPH-GO" "PRD file invalid or empty: $PRD_FILE"; exit 1
        fi
        log_info "RALPH-GO" "Using existing PRD"
    else
        log_info "RALPH-GO" "Generating PRD from description..."

        local gen_model
        gen_model=$(resolve_model "planning")
        local gen_model_flag=""
        [[ "$gen_model" != "codex" ]] && gen_model_flag="--model $gen_model"

        claude $gen_model_flag -p "Generate a Product Requirements Document as ONLY valid JSON (no markdown wrapping, no explanation before or after). Project: ${DESCRIPTION}

Use this exact structure:
{\"project\":\"Name\",\"identifier\":\"PROJ\",\"branchName\":\"ralph/feature-name\",\"description\":\"...\",\"userStories\":[{\"id\":\"PROJ-001\",\"title\":\"...\",\"description\":\"...\",\"acceptanceCriteria\":[\"...\"],\"storyPoints\":3,\"priority\":1,\"domain\":\"backend|frontend|qa|docs\",\"passes\":false,\"dependencies\":[]}]}

Rules: Create 5-7 stories. Detailed descriptions for AI agents. All passes: false. Output RAW JSON only." --dangerously-skip-permissions 2>/dev/null | \
        python3 "${SCRIPT_DIR}/parse-prd-json.py" > "$PRD_FILE"

        if ! jq -e '.userStories | length > 0' "$PRD_FILE" &>/dev/null; then
            log_error "RALPH-GO" "PRD generation failed"; exit 1
        fi
    fi

    STORY_COUNT=$(jq '.userStories | length' "$PRD_FILE")
    PROJECT_NAME=$(jq -r '.project' "$PRD_FILE")
    IDENTIFIER=$(jq -r '.identifier' "$PRD_FILE")
    BRANCH_NAME=$(jq -r '.branchName' "$PRD_FILE")

    log_success "RALPH-GO" "PRD: $STORY_COUNT stories for \"$PROJECT_NAME\" [$IDENTIFIER]"
    get_prd_summary "$PRD_FILE"
}

phase_setup() {
    echo ""; echo -e "${YELLOW}═══ Phase 2/7: SETUP ═══${NC}"; echo ""
    cd "$PROJECT_ROOT"

    local staging_branch
    staging_branch=$(read_config '.git.stagingBranch' 'develop' "${PROJECT_ROOT}/.ralph.json")

    local current_branch
    current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "$BRANCH_NAME" ]]; then
        if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
            log_warning "RALPH-GO" "Branch $BRANCH_NAME exists, switching to it"
            git checkout "$BRANCH_NAME"
        else
            git fetch origin "$staging_branch" 2>/dev/null || true
            git checkout "$staging_branch" 2>/dev/null || true
            git pull origin "$staging_branch" 2>/dev/null || true
            git checkout -b "$BRANCH_NAME"
            log_success "RALPH-GO" "Branch created: $BRANCH_NAME (from $staging_branch)"
        fi
    else
        log_info "RALPH-GO" "Already on branch: $BRANCH_NAME"
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] RALPH-GO: Lifecycle started for $PROJECT_NAME" >> "$PROGRESS_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] RALPH-GO: Description: $DESCRIPTION" >> "$PROGRESS_FILE"
}

phase_plan() {
    echo ""; echo -e "${YELLOW}═══ Phase 3/7: PLAN ═══${NC}"; echo ""
    if [[ "$SKIP_PLAN" == "true" ]]; then
        log_warning "RALPH-GO" "Planning skipped (--skip-plan)"; return 0
    fi
    local plan_model
    plan_model=$(resolve_model "planning")
    claude_with_model "$plan_model" "Read ralph/prd.json and create a detailed implementation plan. Output to ralph/plan.md" || \
        log_info "RALPH-GO" "Planning: agents will self-plan during build phase"
}

phase_build() {
    echo ""; echo -e "${YELLOW}═══ Phase 4/7: BUILD ($THREAD_TYPE-Thread) ═══${NC}"; echo ""
    cd "$PROJECT_ROOT"
    local thread_arg=""
    case $THREAD_TYPE in P) thread_arg="$AGENT_COUNT" ;; L) thread_arg="$AGENT_COUNT" ;; C|B) thread_arg="" ;; esac

    log_info "RALPH-GO" "Building ($THREAD_TYPE-Thread, $AGENT_COUNT agents)..."
    "${RALPH_DIR}/ralph-tac.sh" "$THREAD_TYPE" $thread_arg

    echo ""
    get_prd_summary "$PRD_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] RALPH-GO: Build phase complete ($THREAD_TYPE-Thread)" >> "$PROGRESS_FILE"
}

phase_validate() {
    echo ""; echo -e "${YELLOW}═══ Phase 5/7: VALIDATE ═══${NC}"; echo ""
    cd "$PROJECT_ROOT"
    local test_cmd
    test_cmd=$(read_config '.validation.testCommand' '' "${PROJECT_ROOT}/.ralph.json")
    if [[ -n "$test_cmd" && "$test_cmd" != "null" && "$test_cmd" != *"ADAPT"* ]]; then
        log_info "RALPH-GO" "Running tests: $test_cmd"
        if eval "$test_cmd" 2>&1; then
            log_success "RALPH-GO" "Tests passed"
        else
            log_warning "RALPH-GO" "Tests failed (non-fatal)"
        fi
    else
        log_info "RALPH-GO" "No validation commands configured"
    fi
    get_prd_summary "$PRD_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] RALPH-GO: Validation complete" >> "$PROGRESS_FILE"
}

phase_ship() {
    echo ""; echo -e "${YELLOW}═══ Phase 6/7: SHIP ═══${NC}"; echo ""
    cd "$PROJECT_ROOT"

    local completed
    completed=$(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0")
    local id_lower
    id_lower=$(echo "$IDENTIFIER" | tr '[:upper:]' '[:lower:]')

    # Check if agents already committed per-story
    local agent_commits
    agent_commits=$(git log --oneline --since="1 hour ago" 2>/dev/null | wc -l | tr -d ' ')

    if [[ -z "$(git status --porcelain)" ]]; then
        if [[ "$agent_commits" -gt 0 ]]; then
            log_success "RALPH-GO" "Agents committed $agent_commits stories individually — no residual changes"
        else
            log_warning "RALPH-GO" "No changes to commit"
        fi
        return 0
    fi

    # Only commit residual/leftover files (PRD updates, progress, etc.)
    git add -A
    if [[ "$agent_commits" -gt 0 ]]; then
        git commit -m "chore(${id_lower}): update PRD and progress after ralph-go"
        log_success "RALPH-GO" "Residual changes committed (agents made $agent_commits story commits)"
    else
        git commit -m "feat(${id_lower}): implement ${PROJECT_NAME}

${completed}/${STORY_COUNT} stories completed via ralph-go ${THREAD_TYPE}-Thread"
        log_success "RALPH-GO" "Committed: feat(${id_lower}): implement ${PROJECT_NAME}"
    fi

    if [[ "$SKIP_PR" != "true" ]] && git remote get-url origin &>/dev/null; then
        git push -u origin "$BRANCH_NAME" 2>/dev/null || git push origin "$BRANCH_NAME"
        local pr_target
        pr_target=$(read_config '.git.prTarget' 'develop' "${PROJECT_ROOT}/.ralph.json")

        local pr_url
        pr_url=$(gh pr create --base "$pr_target" --title "feat: ${PROJECT_NAME}" --body "## Summary
- **Project**: ${PROJECT_NAME}
- **Description**: ${DESCRIPTION}
- **Stories**: ${completed}/${STORY_COUNT} completed

## Generated by
Ralph TAC \`ralph-go\`" 2>/dev/null || echo "")
        if [[ -n "$pr_url" ]]; then
            log_success "RALPH-GO" "PR created: $pr_url"
        else
            log_warning "RALPH-GO" "PR creation failed (code was pushed)"
        fi
    elif ! git remote get-url origin &>/dev/null; then
        log_info "RALPH-GO" "No remote configured — skipping push/PR (local only)"
    else
        log_warning "RALPH-GO" "PR skipped (--skip-pr)"
    fi
}

phase_track() {
    echo ""; echo -e "${YELLOW}═══ Phase 7/7: TRACK ═══${NC}"; echo ""
    log_info "RALPH-GO" "Lifecycle tracking complete"
}

main() {
    parse_args "$@"

    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  ${CYAN}RALPH GO${MAGENTA} — Full Development Lifecycle                       ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}Description:${NC} $DESCRIPTION"
    echo -e "  ${CYAN}Execution:${NC}   $EXEC_MODE ($AGENT_COUNT agents)"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "RALPH-GO" "DRY RUN"
        echo "  Phase 1/7: GENERATE  -> PRD from description"
        echo "  Phase 2/7: SETUP     -> Git branch"
        echo "  Phase 3/7: PLAN      -> Implementation plan"
        echo "  Phase 4/7: BUILD     -> ${THREAD_TYPE}-Thread (${AGENT_COUNT} agents)"
        echo "  Phase 5/7: VALIDATE  -> Tests"
        echo "  Phase 6/7: SHIP      -> Git commit + PR"
        echo "  Phase 7/7: TRACK     -> Progress tracking"
        exit 0
    fi

    LIFECYCLE_START=$(date +%s)
    phase_generate; phase_setup; phase_plan

    if [[ "$PRD_ONLY" == "true" ]]; then
        echo ""
        log_success "RALPH-GO" "PRD ready! Stopped after planning (--prd-only)"
        echo ""
        echo -e "  Next steps:"
        echo -e "    ${CYAN}just ralph-p ${AGENT_COUNT}${NC}   — parallel agents"
        echo -e "    ${CYAN}just ralph-l${NC}         — sequential loop"
        echo -e "    ${CYAN}just ralph-p ${AGENT_COUNT} --worktrees${NC} — parallel with per-story branches"
        echo ""
        get_prd_summary "$PRD_FILE"
        exit 0
    fi

    phase_build; phase_validate; phase_ship; phase_track

    local elapsed=$(( $(date +%s) - LIFECYCLE_START ))
    echo ""
    echo -e "${GREEN}Lifecycle complete in $((elapsed / 60))m $((elapsed % 60))s${NC}"
    get_prd_summary "$PRD_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] RALPH-GO: Lifecycle complete ($((elapsed / 60))m $((elapsed % 60))s)" >> "$PROGRESS_FILE"
}

main "$@"
