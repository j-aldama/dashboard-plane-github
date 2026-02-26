#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ralph-tac.sh - TAC-Enhanced Ralph with Thread Types
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./ralph-tac.sh              # Default L-Thread
#   ./ralph-tac.sh L 20         # L-Thread, 20 iterations
#   ./ralph-tac.sh P 5          # P-Thread, 5 parallel agents
#   ./ralph-tac.sh C            # C-Thread, chained phases
#   ./ralph-tac.sh F "prompt"   # F-Thread, fusion analysis
#   ./ralph-tac.sh B            # B-Thread, orchestrator
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="${SCRIPT_DIR}/scripts"
PROMPTS_DIR="${SCRIPT_DIR}/prompts"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRD_FILE="${SCRIPT_DIR}/prd.json"
PROGRESS_FILE="${SCRIPT_DIR}/progress.txt"

source "${SCRIPTS_DIR}/common.sh"

DEFAULT_THREAD="L"
DEFAULT_ITERATIONS=10
DEFAULT_PARALLEL=3

show_usage() {
    cat << 'EOF'
Ralph TAC - Thread-based Autonomous Coding

Usage: ./ralph-tac.sh [THREAD_TYPE] [OPTIONS]

Thread Types:
  L [iterations]    Long-running autonomous loop (default)
  P [count]         Parallel agents via Task system
  C                 Chained phases with human checkpoints
  F "prompt"        Fusion analysis with multiple approaches
  B                 Orchestrator spawning specialist agents

Options:
  --dry-run         Show what would be executed
  --help            Show this help message
EOF
}

show_banner() {
    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  ${CYAN}RALPH TAC${MAGENTA} - Thread-based Autonomous Coding  ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════╝${NC}"
    echo ""
}

run_l_thread() {
    local iterations="${1:-$DEFAULT_ITERATIONS}"

    log_thread "L" "Long-running autonomous loop ($iterations iterations)"
    echo ""

    local branch
    branch=$(get_prd_branch "$PRD_FILE")
    if [[ -n "$branch" ]]; then
        cd "$PROJECT_ROOT"
        ensure_branch "$branch"
    fi

    if [[ -f "${SCRIPT_DIR}/ralph-claude.sh" ]]; then
        "${SCRIPT_DIR}/ralph-claude.sh" "$iterations" "$PROJECT_ROOT"
    else
        log_error "RALPH" "ralph-claude.sh not found"
        exit 1
    fi
}

run_p_thread() {
    local count="${1:-$DEFAULT_PARALLEL}"
    shift 2>/dev/null || true
    local extra=("$@")

    log_thread "P" "Parallel agents ($count)"
    echo ""

    "${SCRIPTS_DIR}/p-thread.sh" "$count" "${extra[@]}"
}

run_c_thread() {
    log_thread "C" "Chained execution with checkpoints"
    echo ""

    local phases=("planning" "implementation" "testing" "documentation")

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] C-THREAD: Starting phased execution" >> "$PROGRESS_FILE"

    for i in "${!phases[@]}"; do
        local phase="${phases[$i]}"
        local phase_num=$((i + 1))
        local phase_upper
        phase_upper=$(echo "$phase" | tr '[:lower:]' '[:upper:]')

        echo ""
        echo -e "${YELLOW}═══ Phase $phase_num: ${phase_upper} ═══${NC}"
        echo ""

        local phase_prompt="${PROMPTS_DIR}/${phase}.md"
        cd "$PROJECT_ROOT"

        if [[ -f "$phase_prompt" ]]; then
            local model_id
            model_id=$(resolve_model "$phase")
            log_info "C-THREAD" "Model: $model_id"
            claude_with_model "$model_id" "@${phase_prompt}" || \
                claude -p "@${phase_prompt}" --dangerously-skip-permissions
        else
            case $phase in
                planning)
                    claude -p "Read @ralph/prd.json and create a detailed implementation plan. Output to ralph/progress.txt" --dangerously-skip-permissions ;;
                implementation)
                    claude -p "Execute the plan from ralph/progress.txt. Implement pending stories from @ralph/prd.json" --dangerously-skip-permissions ;;
                testing)
                    claude -p "Review implementations and run tests. Validate acceptance criteria. Update story status in @ralph/prd.json" --dangerously-skip-permissions ;;
                documentation)
                    claude -p "Document changes made. Update relevant docs. Ensure code is well-commented." --dangerously-skip-permissions ;;
            esac
        fi

        echo -e "${GREEN}Phase $phase_num complete.${NC}"

        if [[ $phase_num -lt ${#phases[@]} ]]; then
            echo ""
            echo -e "${CYAN}CHECKPOINT: Review phase $phase_num results${NC}"
            echo "Press Enter to continue, or Ctrl+C to stop..."
            read -r
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] C-THREAD: Checkpoint passed for $phase" >> "$PROGRESS_FILE"
        fi
    done

    log_success "C-THREAD" "All phases complete"
}

run_f_thread() {
    local prompt="$1"
    log_thread "F" "Fusion analysis"
    echo -e "  Prompt: ${CYAN}$prompt${NC}"
    echo ""

    if [[ -f "${SCRIPTS_DIR}/f-thread.sh" ]]; then
        "${SCRIPTS_DIR}/f-thread.sh" "$prompt"
    else
        log_error "RALPH" "f-thread.sh not found"
        exit 1
    fi
}

run_b_thread() {
    log_thread "B" "Orchestrator with specialist agents"
    echo ""

    check_prd "$PRD_FILE"
    get_prd_summary "$PRD_FILE"
    echo ""

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] B-THREAD: Starting orchestrator" >> "$PROGRESS_FILE"

    local prompt_file="${PROMPTS_DIR}/b-thread-orchestrator.md"
    local orch_model
    orch_model=$(resolve_model "orchestrator")
    log_info "B-THREAD" "Orchestrator model: $orch_model"

    cd "$PROJECT_ROOT"

    if [[ -f "$prompt_file" ]]; then
        claude_with_model "$orch_model" "$(cat "$prompt_file")

## Context
- PRD: $PRD_FILE
- Progress: $PROGRESS_FILE
- Project: $PROJECT_ROOT" || \
        claude -p "$(cat "$prompt_file")

## Context
- PRD: $PRD_FILE
- Progress: $PROGRESS_FILE
- Project: $PROJECT_ROOT" --dangerously-skip-permissions
    else
        claude -p "You are a B-Thread orchestrator. Read ralph/prd.json.
Create a team of builder+validator agent pairs using the Task system.
Delegate each story to a specialized agent. Monitor progress via TaskList.
When all stories pass, reply with <promise>COMPLETE</promise>." --dangerously-skip-permissions
    fi

    log_success "B-THREAD" "Orchestrator complete"
}

main() {
    local thread_type="$DEFAULT_THREAD"
    local thread_arg=""
    local extra_args=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            L|l) thread_type="L"; [[ "$2" =~ ^[0-9]+$ ]] && { thread_arg="$2"; shift; }; shift ;;
            P|p) thread_type="P"; [[ "$2" =~ ^[0-9]+$ ]] && { thread_arg="$2"; shift; }; shift ;;
            C|c) thread_type="C"; shift ;;
            F|f) thread_type="F"; shift; thread_arg="$*"; break ;;
            B|b) thread_type="B"; shift ;;
            --dry-run) DRY_RUN="true"; shift ;;
            --worktrees|--shared) extra_args+=("$1"); shift ;;
            --help|-h) show_usage; exit 0 ;;
            [0-9]*) thread_arg="$1"; shift ;;
            *) log_error "RALPH" "Unknown: $1"; show_usage; exit 1 ;;
        esac
    done

    show_banner

    if [[ "$thread_type" != "F" ]]; then
        check_prd "$PRD_FILE"
        get_prd_summary "$PRD_FILE"
        echo ""
    fi

    [[ "$DRY_RUN" == "true" ]] && log_warning "RALPH" "DRY RUN MODE"

    case $thread_type in
        L) run_l_thread "$thread_arg" ;;
        P) run_p_thread "$thread_arg" "${extra_args[@]}" ;;
        C) run_c_thread ;;
        F) run_f_thread "$thread_arg" ;;
        B) run_b_thread ;;
        *) log_error "RALPH" "Unknown thread: $thread_type"; exit 1 ;;
    esac
}

main "$@"
