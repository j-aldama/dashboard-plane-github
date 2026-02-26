#!/bin/bash
# Ralph Claude - L-Thread autonomous loop
# Usage: ./ralph-claude.sh [max_iterations] [project_path]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${2:-$(dirname "$SCRIPT_DIR")}"
source "${SCRIPT_DIR}/scripts/common.sh"

MAX_ITERATIONS=${1:-10}
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/prompts/l-thread.md"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Read max iterations from config if available
if [[ -f "${PROJECT_ROOT}/.ralph.json" ]]; then
    CONFIG_MAX=$(read_config '.threads.maxIterations' "$MAX_ITERATIONS" "${PROJECT_ROOT}/.ralph.json")
    [[ -z "$1" ]] && MAX_ITERATIONS=$CONFIG_MAX
fi

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    RALPH CLAUDE AGENT                      ║"
echo "║              Autonomous Development Loop                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Validate PRD
check_prd "$PRD_FILE"

# Archive previous run if branch changed
if [[ -f "$LAST_BRANCH_FILE" ]]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [[ -n "$CURRENT_BRANCH" && -n "$LAST_BRANCH" && "$CURRENT_BRANCH" != "$LAST_BRANCH" ]]; then
        ARCHIVE_FOLDER="$ARCHIVE_DIR/$(date +%Y-%m-%d)-$(echo "$LAST_BRANCH" | sed 's|^ralph/||')"
        log_warning "RALPH" "Archiving previous run: $LAST_BRANCH"
        mkdir -p "$ARCHIVE_FOLDER"
        cp "$PRD_FILE" "$ARCHIVE_FOLDER/" 2>/dev/null || true
        cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/" 2>/dev/null || true
        echo "# Ralph Progress Log" > "$PROGRESS_FILE"
        echo "Started: $(date)" >> "$PROGRESS_FILE"
        echo "---" >> "$PROGRESS_FILE"
    fi
fi

# Track current branch
CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
[[ -n "$CURRENT_BRANCH" ]] && echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"

# Initialize progress file
if [[ ! -f "$PROGRESS_FILE" ]]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "Project: $PROJECT_ROOT" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
fi

# Show status
echo -e "${BLUE}Config:${NC} $MAX_ITERATIONS iterations | Project: $PROJECT_ROOT"
get_prd_summary "$PRD_FILE"
echo ""

# Build prompt from file + dynamic context
PROMPT=$(cat "$PROMPT_FILE")
PROMPT="$PROMPT

## Files
- PRD: $PRD_FILE
- Progress: $PROGRESS_FILE
- Project: $PROJECT_ROOT"

log_success "RALPH" "Starting loop..."

for i in $(seq 1 $MAX_ITERATIONS); do
    echo ""
    echo -e "${BLUE}═══ Ralph Iteration $i / $MAX_ITERATIONS ═══${NC}"
    echo ""

    OUTPUT=$(echo "$PROMPT" | claude -p - --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
        echo ""
        log_success "RALPH" "ALL STORIES COMPLETE! (iteration $i)"
        exit 0
    fi

    echo ""
    log_info "RALPH" "Iteration $i done. Continuing in 3s..."
    sleep 3
done

echo ""
log_error "RALPH" "Max iterations reached ($MAX_ITERATIONS)"
echo -e "${YELLOW}Pending stories:${NC}"
jq -r '.userStories[] | select(.passes == false) | "  - \(.id): \(.title)"' "$PRD_FILE" 2>/dev/null || echo "  (error reading PRD)"
exit 1
