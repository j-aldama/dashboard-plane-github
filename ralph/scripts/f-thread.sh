#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# f-thread.sh - Fusion Thread for Multi-Model Analysis
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$RALPH_DIR")"
FUSION_DIR="${RALPH_DIR}/fusion"
PROGRESS_FILE="${RALPH_DIR}/progress.txt"

DEFAULT_APPROACHES=("standard" "creative" "analytical")

source "${SCRIPT_DIR}/common.sh"

flog_info()    { log_info    "F-THREAD" "$1"; }
flog_success() { log_success "F-THREAD" "$1"; }
flog_warning() { log_warning "F-THREAD" "$1"; }
flog_error()   { log_error   "F-THREAD" "$1"; }

get_approach_prompt() {
    local approach="$1"
    local base_prompt="$2"
    case $approach in
        standard)    echo "Analyze the following with a balanced, practical perspective: $base_prompt" ;;
        creative)    echo "Think creatively and consider unconventional approaches: $base_prompt. What alternatives exist?" ;;
        analytical)  echo "Perform a deep, systematic analysis with structured reasoning: $base_prompt. Break down into components." ;;
        security)    echo "Analyze from a security perspective, identifying vulnerabilities: $base_prompt. Consider OWASP top 10." ;;
        performance) echo "Analyze from a performance perspective: $base_prompt. Consider complexity, caching, scalability." ;;
        *)           echo "$base_prompt" ;;
    esac
}

setup_fusion_dir() {
    mkdir -p "$FUSION_DIR"
    rm -f "$FUSION_DIR"/approach_*.md 2>/dev/null || true
}

run_approach() {
    local approach="$1" prompt="$2" context="$3" output_file="$4" timeout="$5"
    local full_prompt=$(get_approach_prompt "$approach" "$prompt")
    [[ -n "$context" ]] && full_prompt="$full_prompt

Context: $context"

    flog_info "Running $approach approach..."
    cd "$PROJECT_ROOT"

    if timeout "$timeout" claude -p "$full_prompt" --output-format text > "$output_file" 2>&1; then
        flog_success "$approach approach completed"
    else
        flog_warning "$approach approach timed out or failed"
        echo "# $approach approach - TIMEOUT/ERROR" > "$output_file"
        return 1
    fi
}

run_all_approaches() {
    local prompt="$1" context="$2" timeout="$3"
    shift 3
    local approaches=("$@") results=()

    for approach in "${approaches[@]}"; do
        local output_file="${FUSION_DIR}/approach_${approach}.md"
        if [[ "$DRY_RUN" == "true" ]]; then
            echo -e "${CYAN}  Would run:${NC} $approach -> $output_file"
        else
            run_approach "$approach" "$prompt" "$context" "$output_file" "$timeout" &
            results+=($!)
        fi
    done

    if [[ "$DRY_RUN" != "true" ]]; then
        flog_info "Waiting for all approaches to complete..."
        for pid in "${results[@]}"; do wait "$pid" 2>/dev/null || true; done
    fi
}

fuse_synthesis() {
    local output_file="$1"; shift; local approaches=("$@")
    flog_info "Synthesizing results..."
    local fusion_prompt="You are combining multiple analysis perspectives into a comprehensive result.

## Analysis Results from Different Approaches:

"
    for approach in "${approaches[@]}"; do
        local f="${FUSION_DIR}/approach_${approach}.md"
        [[ -f "$f" ]] && fusion_prompt+="### $approach Approach:
$(cat "$f")

"
    done
    fusion_prompt+="
## Your Task:
Synthesize these perspectives into a single, comprehensive analysis that:
1. Identifies areas of consensus across approaches
2. Highlights unique valuable insights from each
3. Resolves any contradictions with reasoned judgment
4. Provides a clear, actionable conclusion

Output a well-structured markdown document."

    cd "$PROJECT_ROOT"
    claude -p "$fusion_prompt" --output-format text > "$output_file"
    flog_success "Synthesis complete: $output_file"
}

fuse_vote() {
    local output_file="$1"; shift; local approaches=("$@")
    flog_info "Creating vote summary..."
    {
        echo "# F-Thread Analysis: Vote Mode"; echo ""
        for approach in "${approaches[@]}"; do
            local f="${FUSION_DIR}/approach_${approach}.md"
            [[ -f "$f" ]] && { echo "### $approach Approach"; echo ""; cat "$f"; echo ""; echo "---"; echo ""; }
        done
    } > "$output_file"
    flog_success "Vote summary created: $output_file"
}

fuse_best() {
    local output_file="$1"; shift; local approaches=("$@")
    flog_info "Selecting best result..."
    local prompt="You are evaluating multiple analysis results to select the best one.

## Analysis Results:

"
    for approach in "${approaches[@]}"; do
        local f="${FUSION_DIR}/approach_${approach}.md"
        [[ -f "$f" ]] && prompt+="### $approach Approach:
$(cat "$f")

"
    done
    prompt+="
Select the BEST single response. Explain briefly why it's the best choice."
    cd "$PROJECT_ROOT"
    claude -p "$prompt" --output-format text > "$output_file"
    flog_success "Best result selected: $output_file"
}

main() {
    local approaches=("${DEFAULT_APPROACHES[@]}")
    local fusion_mode="synthesis" output_file="${FUSION_DIR}/result.md" timeout=120 prompt="" context=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --approaches) IFS=',' read -ra approaches <<< "$2"; shift 2 ;;
            --fusion-mode) fusion_mode="$2"; shift 2 ;;
            --output) output_file="$2"; shift 2 ;;
            --timeout) timeout="$2"; shift 2 ;;
            --dry-run) DRY_RUN="true"; shift ;;
            --help|-h) echo "F-Thread: Fusion Analysis. Usage: ./f-thread.sh [options] \"prompt\""; exit 0 ;;
            @*) context="${1#@}"; shift ;;
            *) if [[ -z "$prompt" ]]; then prompt="$1"; else prompt="$prompt $1"; fi; shift ;;
        esac
    done

    [[ -z "$prompt" ]] && { flog_error "No prompt provided"; exit 1; }

    echo ""; echo -e "${MAGENTA}═══ F-THREAD - Fusion Analysis ═══${NC}"; echo ""
    echo -e "${CYAN}Prompt:${NC} $prompt"
    echo -e "${CYAN}Approaches:${NC} ${approaches[*]}"
    echo -e "${CYAN}Fusion Mode:${NC} $fusion_mode"; echo ""

    setup_fusion_dir

    [[ "$DRY_RUN" != "true" ]] && echo "[$(date '+%Y-%m-%d %H:%M:%S')] F-THREAD: Starting fusion (${#approaches[@]} approaches, mode: $fusion_mode)" >> "$PROGRESS_FILE"

    flog_info "Running ${#approaches[@]} parallel approaches..."
    run_all_approaches "$prompt" "$context" "$timeout" "${approaches[@]}"
    echo ""

    if [[ "$DRY_RUN" != "true" ]]; then
        case $fusion_mode in
            synthesis) fuse_synthesis "$output_file" "${approaches[@]}" ;;
            vote) fuse_vote "$output_file" "${approaches[@]}" ;;
            best) fuse_best "$output_file" "${approaches[@]}" ;;
            *) flog_error "Unknown fusion mode: $fusion_mode"; exit 1 ;;
        esac
        echo ""; echo -e "${GREEN}Fusion Complete! Result: ${CYAN}$output_file${NC}"; echo ""
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] F-THREAD: Fusion complete -> $output_file" >> "$PROGRESS_FILE"
    fi
}

main "$@"
