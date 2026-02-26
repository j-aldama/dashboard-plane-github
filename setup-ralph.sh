#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# setup-ralph.sh — Bootstrap Ralph TAC Infrastructure
# ═══════════════════════════════════════════════════════════════
#
# Creates all files needed for agentic development with Claude Code.
# Run from the ROOT of your project directory.
#
# Usage:
#   bash setup-ralph.sh                     # Default setup
#   bash setup-ralph.sh --project "My App"  # With project name
#   bash setup-ralph.sh --dry-run           # Preview only
#
# What it creates:
#   ralph/           — TAC scripts, prompts, metaprompts
#   .claude/         — Hooks, commands, agent templates
#   .ralph.json      — Project configuration
#   justfile         — Command runner
#   mprocs.yaml      — Terminal multiplexer config
#   CLAUDE.md        — Project context for Claude Code
# ═══════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Defaults
PROJECT_NAME=""
DRY_RUN=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project) PROJECT_NAME="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --force) FORCE=true; shift ;;
        --help|-h)
            echo "setup-ralph.sh — Bootstrap Ralph TAC Infrastructure"
            echo ""
            echo "Usage: bash setup-ralph.sh [options]"
            echo ""
            echo "Options:"
            echo "  --project NAME    Project name (default: directory name)"
            echo "  --dry-run         Preview what would be created"
            echo "  --force           Overwrite existing files"
            echo "  --help            Show this help"
            exit 0
            ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
    esac
done

# Detect project name from directory if not set
if [[ -z "$PROJECT_NAME" ]]; then
    PROJECT_NAME=$(basename "$(pwd)")
fi

PROJECT_ROOT="$(pwd)"

echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║  ${CYAN}RALPH TAC${MAGENTA} — Bootstrap Agentic Infrastructure               ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Project:${NC}  $PROJECT_NAME"
echo -e "  ${CYAN}Root:${NC}     $PROJECT_ROOT"
echo -e "  ${CYAN}Dry run:${NC}  $DRY_RUN"
echo ""

# Helper: write file (respects dry-run and force)
write_file() {
    local file_path="$1"
    local description="$2"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "  ${CYAN}[DRY]${NC} Would create: $file_path"
        cat > /dev/null  # consume stdin
        return 0
    fi

    if [[ -f "$file_path" && "$FORCE" != "true" ]]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $file_path (exists, use --force to overwrite)"
        cat > /dev/null  # consume stdin
        return 0
    fi

    mkdir -p "$(dirname "$file_path")"
    cat > "$file_path"
    echo -e "  ${GREEN}[OK]${NC} $file_path — $description"
}

# ═══════════════════════════════════════════════════════════════
# Step 1: Directory Structure
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 1/12: Creating directory structure...${NC}"

DIRS=(
    "ralph/scripts"
    "ralph/prompts"
    "ralph/metaprompts"
    "ralph/checkpoints"
    "ralph/archive"
    "ralph/fusion"
    ".claude/hooks"
    ".claude/commands"
    ".claude/agent-templates"
    ".claude/logs"
)

for dir in "${DIRS[@]}"; do
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "  ${CYAN}[DRY]${NC} mkdir -p $dir"
    else
        mkdir -p "$dir"
        echo -e "  ${GREEN}[OK]${NC} $dir/"
    fi
done

# Initialize progress file
if [[ "$DRY_RUN" != "true" && ! -f "ralph/progress.txt" ]]; then
    echo "# Ralph Progress Log" > ralph/progress.txt
    echo "Started: $(date)" >> ralph/progress.txt
    echo "Project: $PROJECT_NAME" >> ralph/progress.txt
    echo "---" >> ralph/progress.txt
    echo -e "  ${GREEN}[OK]${NC} ralph/progress.txt — initialized"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 2: .ralph.json
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 2/12: Creating .ralph.json...${NC}"

write_file ".ralph.json" "Project configuration" << 'SETUP_EOF_RALPH_JSON'
{
  "project": {
    "name": "ADAPT: Project Name",
    "identifier": "PROJ"
  },

  "git": {
    "defaultBranch": "main",
    "stagingBranch": "develop",
    "branchPrefix": "agent/",
    "autoCommit": true,
    "prTarget": "develop",
    "prAutoMerge": false,
    "workflow": "feature/* | fix/* | agent/* -> develop (staging) -> main (production)"
  },

  "threads": {
    "default": "L",
    "maxParallel": 3,
    "maxIterations": 10,
    "parallelStrategy": "shared",
    "worktreeBase": "../ralph-worktrees"
  },

  "agents": {
    "backend": ["apps/", "src/", "lib/"],
    "frontend": ["templates/", "static/", "public/", "components/"],
    "qa": ["tests/", "**/tests/", "conftest.py"],
    "docs": ["docs/", "*.md"]
  },

  "validation": {
    "lintCommand": "",
    "testCommand": "ADAPT: your test command here",
    "buildCommand": ""
  },

  "memory": {
    "progressFile": "ralph/progress.txt",
    "prdFile": "ralph/prd.json"
  },

  "execution": {
    "mode": "local"
  },

  "stack": {
    "backend": "ADAPT: django+drf | fastapi | express | go | etc",
    "frontend": "ADAPT: templates+tailwind | react | vue | etc",
    "testing": "ADAPT: pytest | jest | go test | etc",
    "database": "ADAPT: postgresql | mysql | sqlite | mongodb | etc"
  },

  "models": {
    "router": "phase",
    "default": "opus",
    "phases": {
      "planning": "opus",
      "implementation": "opus",
      "testing": "sonnet",
      "documentation": "haiku",
      "validation": "sonnet",
      "orchestrator": "opus"
    },
    "complexity": {
      "simple": "sonnet",
      "moderate": "sonnet",
      "complex": "opus"
    },
    "providers": {
      "opus": "claude-opus-4-6",
      "sonnet": "claude-sonnet-4-5-20250929",
      "haiku": "claude-haiku-4-5-20251001"
    }
  },

  "observability": {
    "enabled": false,
    "metricsEnabled": false
  }
}
SETUP_EOF_RALPH_JSON

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 3: Ralph Scripts
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 3/12: Creating Ralph scripts...${NC}"

# --- common.sh ---
write_file "ralph/scripts/common.sh" "Shared utilities" << 'SETUP_EOF_COMMON'
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# common.sh - Shared utilities for Ralph TAC scripts
# ═══════════════════════════════════════════════════════════════

# Resolve common.sh directory (works when sourced from any context)
COMMON_SH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Logging
log_info()    { echo -e "${BLUE}[$1]${NC} $2"; }
log_success() { echo -e "${GREEN}[$1]${NC} $2"; }
log_warning() { echo -e "${YELLOW}[$1]${NC} $2"; }
log_error()   { echo -e "${RED}[$1]${NC} $2"; }

log_thread() {
    local thread_type="$1"
    local message="$2"
    case $thread_type in
        L) echo -e "${MAGENTA}[L-THREAD]${NC} $message" ;;
        P) echo -e "${CYAN}[P-THREAD]${NC} $message" ;;
        C) echo -e "${YELLOW}[C-THREAD]${NC} $message" ;;
        F) echo -e "${GREEN}[F-THREAD]${NC} $message" ;;
        B) echo -e "${BLUE}[B-THREAD]${NC} $message" ;;
    esac
}

# PRD helpers
check_prd() {
    local prd_file="$1"
    if [[ ! -f "$prd_file" ]]; then
        log_error "RALPH" "PRD file not found: $prd_file"
        echo "Create prd.json first (use /go or ralph-go)"
        exit 1
    fi
}

get_pending_stories() {
    local prd_file="$1"
    jq -r '.userStories[] | select(.passes == false or .passes == null) | .id' "$prd_file" 2>/dev/null || echo ""
}

get_story_title() {
    local prd_file="$1"
    local story_id="$2"
    jq -r --arg id "$story_id" '.userStories[] | select(.id == $id) | .title' "$prd_file" 2>/dev/null || echo "Unknown"
}

get_prd_summary() {
    local prd_file="$1"
    local total=$(jq '.userStories | length' "$prd_file" 2>/dev/null || echo "0")
    local pending=$(jq '[.userStories[] | select(.passes == false or .passes == null)] | length' "$prd_file" 2>/dev/null || echo "0")
    local complete=$((total - pending))
    echo -e "${CYAN}PRD:${NC} ${GREEN}$complete${NC}/${total} complete, ${YELLOW}$pending${NC} pending"
}

# ═══════════════════════════════════════════════════════════════
# Git Branch Management
# ═══════════════════════════════════════════════════════════════

get_prd_branch() {
    local prd_file="$1"
    jq -r '.branchName // ""' "$prd_file" 2>/dev/null || echo ""
}

ensure_branch() {
    local branch="$1"
    if [[ -z "$branch" ]]; then
        log_warning "GIT" "No branchName in PRD, staying on current branch: $(git branch --show-current)"
        return 0
    fi

    local current
    current=$(git branch --show-current)

    if [[ "$current" == "$branch" ]]; then
        log_info "GIT" "Already on branch: $branch"
        return 0
    fi

    if git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
        log_info "GIT" "Switching to existing branch: $branch"
        git checkout "$branch"
    else
        log_info "GIT" "Creating new branch: $branch"
        git checkout -b "$branch"
    fi
}

ensure_story_branch() {
    local base_branch="$1"
    local story_id="$2"
    local story_branch="${base_branch}/${story_id}"

    ensure_branch "$base_branch"

    if git show-ref --verify --quiet "refs/heads/$story_branch" 2>/dev/null; then
        log_info "GIT" "Switching to existing story branch: $story_branch"
        git checkout "$story_branch"
    else
        log_info "GIT" "Creating story branch: $story_branch (from $base_branch)"
        git checkout -b "$story_branch"
    fi
}

merge_story_branches() {
    local base_branch="$1"
    shift
    local story_ids=("$@")

    log_info "GIT" "Merging story branches into $base_branch"
    git checkout "$base_branch"

    for story_id in "${story_ids[@]}"; do
        local story_branch="${base_branch}/${story_id}"
        if git show-ref --verify --quiet "refs/heads/$story_branch" 2>/dev/null; then
            log_info "GIT" "Merging $story_branch"
            if git merge "$story_branch" --no-edit; then
                log_success "GIT" "Merged $story_branch"
            else
                log_error "GIT" "Conflict merging $story_branch — resolve manually"
                return 1
            fi
        fi
    done

    log_success "GIT" "All story branches merged into $base_branch"
}

# ═══════════════════════════════════════════════════════════════
# Worktree Management (for parallelStrategy: "worktrees")
# ═══════════════════════════════════════════════════════════════

get_parallel_strategy() {
    local config_file="${PROJECT_ROOT:-.}/.ralph.json"
    read_config '.threads.parallelStrategy' 'shared' "$config_file"
}

get_worktree_base() {
    local config_file="${PROJECT_ROOT:-.}/.ralph.json"
    local rel_path
    rel_path=$(read_config '.threads.worktreeBase' '../ralph-worktrees' "$config_file")
    echo "${PROJECT_ROOT}/${rel_path}"
}

setup_worktree() {
    local base_branch="$1"
    local story_id="$2"
    local worktree_base="$3"
    local story_branch="${base_branch}/${story_id}"
    local worktree_dir="${worktree_base}/${story_id}"

    if [[ -d "$worktree_dir" ]]; then
        log_info "WORKTREE" "Already exists: $worktree_dir"
        git -C "$worktree_dir" checkout "$story_branch" 2>/dev/null || true
        echo "$worktree_dir"
        return 0
    fi

    if ! git show-ref --verify --quiet "refs/heads/$story_branch" 2>/dev/null; then
        git branch "$story_branch" "$base_branch" 2>/dev/null || \
            git branch "$story_branch" HEAD
    fi

    mkdir -p "$worktree_base"
    git worktree add "$worktree_dir" "$story_branch"
    log_success "WORKTREE" "Created: $worktree_dir (branch: $story_branch)"
    echo "$worktree_dir"
}

setup_all_worktrees() {
    local base_branch="$1"
    local worktree_base="$2"
    shift 2
    local story_ids=("$@")
    local worktree_dirs=()

    log_info "WORKTREE" "Setting up ${#story_ids[@]} worktrees in $worktree_base"

    for story_id in "${story_ids[@]}"; do
        local dir
        dir=$(setup_worktree "$base_branch" "$story_id" "$worktree_base")
        worktree_dirs+=("$dir")
    done

    printf '%s\n' "${worktree_dirs[@]}"
}

cleanup_worktrees() {
    local worktree_base="$1"
    shift
    local story_ids=("$@")

    log_info "WORKTREE" "Cleaning up worktrees"

    for story_id in "${story_ids[@]}"; do
        local worktree_dir="${worktree_base}/${story_id}"
        if [[ -d "$worktree_dir" ]]; then
            git worktree remove "$worktree_dir" --force 2>/dev/null || \
                log_warning "WORKTREE" "Could not remove $worktree_dir"
        fi
    done

    git worktree prune 2>/dev/null
    log_success "WORKTREE" "Cleanup complete"
}

merge_worktree_branches() {
    local base_branch="$1"
    shift
    local story_ids=("$@")

    log_info "WORKTREE" "Merging story branches into $base_branch"
    git checkout "$base_branch"

    local failed=()
    for story_id in "${story_ids[@]}"; do
        local story_branch="${base_branch}/${story_id}"
        if git show-ref --verify --quiet "refs/heads/$story_branch" 2>/dev/null; then
            log_info "WORKTREE" "Merging $story_branch → $base_branch"
            if git merge "$story_branch" --no-edit; then
                log_success "WORKTREE" "Merged $story_id"
                git branch -d "$story_branch" 2>/dev/null || true
            else
                log_error "WORKTREE" "Conflict merging $story_id — aborting this merge"
                git merge --abort 2>/dev/null
                failed+=("$story_id")
            fi
        fi
    done

    if [[ ${#failed[@]} -gt 0 ]]; then
        log_error "WORKTREE" "Failed to merge: ${failed[*]}"
        log_warning "WORKTREE" "Resolve manually: git merge ${base_branch}/<story-id>"
        return 1
    fi

    log_success "WORKTREE" "All story branches merged into $base_branch"
}

# Config helpers
read_config() {
    local key="$1"
    local default="$2"
    local config_file="${3:-.ralph.json}"
    if [[ -f "$config_file" ]]; then
        jq -r "$key // \"$default\"" "$config_file" 2>/dev/null || echo "$default"
    else
        echo "$default"
    fi
}

# ═══════════════════════════════════════════════════════════════
# Model Router
# ═══════════════════════════════════════════════════════════════

resolve_model() {
    local phase="${1:-implementation}"
    local story_points="${2:-3}"
    local config_file="${PROJECT_ROOT:-.}/.ralph.json"

    local router
    router=$(read_config '.models.router' 'fixed' "$config_file")
    local default_model
    default_model=$(read_config '.models.default' 'opus' "$config_file")

    local model="$default_model"

    case "$router" in
        phase)
            model=$(read_config ".models.phases.${phase}" "$default_model" "$config_file")
            ;;
        complexity)
            if [[ $story_points -le 2 ]]; then
                model=$(read_config '.models.complexity.simple' 'sonnet' "$config_file")
            elif [[ $story_points -le 5 ]]; then
                model=$(read_config '.models.complexity.moderate' 'sonnet' "$config_file")
            else
                model=$(read_config '.models.complexity.complex' 'opus' "$config_file")
            fi
            ;;
        fixed|*)
            model="$default_model"
            ;;
    esac

    local model_id
    model_id=$(read_config ".models.providers.${model}" "$model" "$config_file")
    echo "$model_id"
}

# claude_with_model - Invoke claude -p with a specific model
claude_with_model() {
    local model_id="$1"
    shift

    if [[ "$model_id" == "codex" ]]; then
        return 1
    fi

    claude --model "$model_id" -p "$@" --dangerously-skip-permissions
}
SETUP_EOF_COMMON

# --- ralph-tac.sh ---
write_file "ralph/ralph-tac.sh" "TAC entry point (thread dispatcher)" << 'SETUP_EOF_TAC'
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
SETUP_EOF_TAC

# --- ralph-claude.sh ---
write_file "ralph/ralph-claude.sh" "L-Thread autonomous loop" << 'SETUP_EOF_CLAUDE'
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
SETUP_EOF_CLAUDE

echo ""
# --- p-thread.sh ---
write_file "ralph/scripts/p-thread.sh" "Parallel thread orchestrator" << 'SETUP_EOF_PTHREAD'
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
SETUP_EOF_PTHREAD

# --- f-thread.sh ---
write_file "ralph/scripts/f-thread.sh" "Fusion analysis thread" << 'SETUP_EOF_FTHREAD'
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
SETUP_EOF_FTHREAD

# --- ralph-go.sh ---
write_file "ralph/scripts/ralph-go.sh" "Full lifecycle: idea to shipped code" << 'SETUP_EOF_GO'
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
SETUP_EOF_GO

# --- observe.sh ---
write_file "ralph/scripts/observe.sh" "mprocs config generator" << 'SETUP_EOF_OBSERVE'
#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# observe.sh - Dynamic mprocs config generator for Ralph observability
# ═══════════════════════════════════════════════════════════════

set -e

THREAD_TYPE="${1:-L}"
AGENT_COUNT="${2:-1}"
GENERATE_ONLY=false
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="${PROJECT_ROOT}/mprocs-ralph.yaml"

for arg in "$@"; do [[ "$arg" == "--generate-only" ]] && GENERATE_ONLY=true; done

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${BLUE}[OBSERVE]${NC} Generating mprocs config for ${THREAD_TYPE}-Thread..."

generate_l_or_c_config() {
    cat > "$OUTPUT_FILE" << OBSEOF
procs:
  ralph-progress:
    shell: "tail -f ${PROJECT_ROOT}/ralph/progress.txt"
  action-log:
    shell: "tail -f ${PROJECT_ROOT}/.claude/logs/actions.log 2>/dev/null || echo 'Waiting for actions.log...' && sleep infinity"

server:
  address: 127.0.0.1:4051
OBSEOF
}

generate_p_config() {
    local count="$1"
    {
        echo "procs:"
        for i in $(seq 1 "$count"); do
            echo "  agent-${i}:"
            echo "    shell: \"tail -f ${PROJECT_ROOT}/ralph/progress.txt | grep --line-buffered -i 'agent.\\\\?${i}\\\\|P-THREAD' || tail -f ${PROJECT_ROOT}/ralph/progress.txt\""
        done
        echo ""; echo "server:"; echo "  address: 127.0.0.1:4051"
    } > "$OUTPUT_FILE"
}

case "$THREAD_TYPE" in
    L|l|C|c) generate_l_or_c_config ;;
    P|p) [[ ! "$AGENT_COUNT" =~ ^[0-9]+$ || "$AGENT_COUNT" -lt 1 ]] && AGENT_COUNT=3; generate_p_config "$AGENT_COUNT" ;;
    *) generate_l_or_c_config ;;
esac

echo -e "${GREEN}[OBSERVE]${NC} Config: ${OUTPUT_FILE}"
[[ "$GENERATE_ONLY" == "true" ]] && exit 0

echo -e "${YELLOW}Launch mprocs? [Y/n]${NC}"
read -r response
[[ "$response" =~ ^[Nn] ]] && { echo "Run manually: mprocs -c mprocs-ralph.yaml"; exit 0; }

if command -v mprocs &>/dev/null; then
    exec mprocs -c "$OUTPUT_FILE"
else
    echo -e "${YELLOW}[OBSERVE]${NC} mprocs not found. Install: brew install mprocs"; exit 1
fi
SETUP_EOF_OBSERVE

# --- parse-prd-json.py ---
write_file "ralph/scripts/parse-prd-json.py" "PRD JSON parser" << 'SETUP_EOF_PARSE'
#!/usr/bin/env python3
"""Parse Claude's PRD output into clean JSON.

Reads from stdin, strips markdown fences, extracts JSON object,
writes formatted JSON to stdout. Exit 1 on failure.
"""
import sys, json, re

text = sys.stdin.read()
text = re.sub(r'^```json?\s*', '', text.strip())
text = re.sub(r'```\s*$', '', text.strip())
try:
    obj = json.loads(text)
    print(json.dumps(obj, indent=2))
except Exception:
    match = re.search(r'\{[^{}]*"userStories".*', text, re.DOTALL)
    if match:
        candidate = match.group(0)
        depth = 0
        for i, c in enumerate(candidate):
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(candidate[:i+1])
                    print(json.dumps(obj, indent=2))
                    sys.exit(0)
                except Exception:
                    pass
                break
    print('{"error":"parse_failed"}', file=sys.stderr)
    sys.exit(1)
SETUP_EOF_PARSE

echo ""
# ═══════════════════════════════════════════════════════════════
# Step 4: Prompts for agents
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 4/12: Creating agent prompts...${NC}"

# --- l-thread.md ---
write_file "ralph/prompts/l-thread.md" "L-Thread agent instructions" << 'SETUP_EOF_LTHREAD'
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
SETUP_EOF_LTHREAD

# --- p-thread-orchestrator.md ---
write_file "ralph/prompts/p-thread-orchestrator.md" "P-Thread orchestrator prompt" << 'SETUP_EOF_PORCH'
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
SETUP_EOF_PORCH

# --- b-thread-orchestrator.md ---
write_file "ralph/prompts/b-thread-orchestrator.md" "B-Thread orchestrator prompt" << 'SETUP_EOF_BORCH'
# B-Thread Orchestrator - Multi-Agent Team

You are a B-Thread orchestrator. Your job is to analyze the PRD, create a team of specialized agents, and coordinate their work using the Task system.

## Workflow

1. **Analyze PRD**: Read `ralph/prd.json` and classify each pending story by domain (backend, frontend, qa, docs)
2. **Create Task List**: For each story, create a builder Task and a validator Task using TaskCreate
3. **Set Dependencies**: Validator tasks must be blocked by their builder task (use `addBlockedBy`)
4. **Launch Builders**: For each builder task, launch a sub-agent using the Task tool:
   - Use `subagent_type: general-purpose` for all stories
   - Set `run_in_background: true` for parallel execution
5. **Launch Validators**: After builders complete, launch validator agents
6. **Monitor**: Use TaskList to track overall progress
7. **Complete**: When all tasks are done, update `ralph/prd.json` and append to `ralph/progress.txt`

## Builder Agent Prompt Template

```
You are a builder agent for story {story_id}: {story_title}.

Acceptance criteria:
{acceptance_criteria}

Focus directories: {focus_dirs}

Instructions:
1. Read the relevant code in the focus directories
2. Implement the story requirements
3. Run tests (see .ralph.json -> validation.testCommand)
4. **Commit immediately**: git add -A && git commit -m "feat(<module>): {story_id} - {story_title}"
5. One commit per story — never batch

Do NOT work on any other stories.
```

## Validator Agent Prompt Template

```
You are a validator agent for story {story_id}: {story_title}.

Acceptance criteria:
{acceptance_criteria}

Instructions:
1. Review the code changes made by the builder agent
2. Run the test suite
3. Verify each acceptance criterion is met
4. If validation passes, update prd.json to set passes: true
5. If validation fails, document what's wrong
```

## Model Selection

- **Backend builders** (storyPoints <= 5): `model: "sonnet"`
- **Backend builders** (storyPoints >= 8): `model: "opus"`
- **Frontend builders**: `model: "sonnet"`
- **QA/docs builders**: `model: "haiku"`
- **Validators**: `model: "haiku"`

## Rules

- Never implement code directly - always delegate to sub-agents
- Each agent gets a focused context window (one story only)
- Use the agent domain mapping from .ralph.json to assign specializations
- Log orchestration decisions to ralph/progress.txt
SETUP_EOF_BORCH

# --- planning.md ---
write_file "ralph/prompts/planning.md" "C-Thread phase 1: Planning" << 'SETUP_EOF_PLANNING'
# C-Thread Phase 1: Planning

You are Ralph in PLANNING phase. Your goal is to analyze the PRD and create a detailed implementation strategy.

## Your Tasks

1. **Read and Analyze PRD**
   - Read @ralph/prd.json
   - Identify all pending user stories
   - Understand acceptance criteria for each

2. **Dependency Analysis**
   - Map dependencies between stories
   - Identify which stories can be parallelized
   - Determine critical path

3. **Technical Assessment**
   - Review existing codebase structure
   - Identify files that need modification
   - Note any technical risks or challenges

4. **Create Implementation Plan**
   - Order stories by dependency and priority
   - Estimate complexity for each story
   - Identify validation approach

## Output Requirements

Update ralph/progress.txt with:

```markdown
# Implementation Plan - [Date]

## Story Order (by dependency)
1. [Story ID] - [Title] - [Why first]
2. [Story ID] - [Title] - [Dependencies on #1]

## Parallelization Opportunities
- Stories [X] and [Y] can run in parallel
- Stories [Z] must be sequential

## Technical Notes
- [Key technical considerations]
- [Potential risks]

## Validation Strategy
- [How each story will be validated]
```

## Important
- DO NOT implement anything in this phase
- Focus only on planning and analysis
- Be thorough - this plan guides implementation phase
SETUP_EOF_PLANNING

# --- implementation.md ---
write_file "ralph/prompts/implementation.md" "C-Thread phase 2: Implementation" << 'SETUP_EOF_IMPL'
# C-Thread Phase 2: Implementation

You are Ralph in IMPLEMENTATION phase. Execute the plan created in Phase 1.

## Your Tasks

1. **Read Implementation Plan**
   - Review ralph/progress.txt for the plan
   - Understand story order and dependencies

2. **Implement Each Story**
   For each story in order:
   - Read story requirements from @ralph/prd.json
   - Implement required changes
   - Follow existing code patterns
   - Write clean, maintainable code

3. **Track Progress**
   - Update ralph/progress.txt with status
   - Note any deviations from plan

## Git Discipline
- Commit after each story: `feat(<module>): [Story ID] - [Title]`
- Keep commits atomic

## Output

For each story, update ralph/progress.txt:

```markdown
## Story [ID] - Implementation Log
- Status: [In Progress/Complete]
- Files Modified: [list]
- Key Changes: [summary]
```

## Important
- DO NOT skip stories or change order without good reason
- DO NOT refactor unrelated code
- Leave testing for Phase 3
SETUP_EOF_IMPL

# --- testing.md ---
write_file "ralph/prompts/testing.md" "C-Thread phase 3: Testing" << 'SETUP_EOF_TESTING'
# C-Thread Phase 3: Testing

You are Ralph in TESTING phase. Validate all implementations against acceptance criteria.

## Your Tasks

1. **Review Implementations**
   - Read ralph/progress.txt for implementation log
   - Identify all stories that were implemented

2. **Validate Each Story**
   For each implemented story:
   - Review acceptance criteria in @ralph/prd.json
   - Run existing tests (see .ralph.json -> validation.testCommand)
   - Write new tests if needed
   - Verify edge cases

3. **Update Story Status**
   - Mark passing stories as `passes: true` in prd.json
   - Document any failures with reasons

## Validation Checklist Per Story

```markdown
### Story [ID] Validation

**Acceptance Criteria:**
- [ ] Criterion 1: [Pass/Fail] - [Notes]
- [ ] Criterion 2: [Pass/Fail] - [Notes]

**Tests Run:**
- [Test name]: [Result]

**Status:** [PASS/FAIL]
```

## Important
- Be thorough - don't mark stories as passing if they don't fully meet criteria
- Document WHY something fails
- If fixes are simple, note them but don't implement
SETUP_EOF_TESTING

# --- documentation.md ---
write_file "ralph/prompts/documentation.md" "C-Thread phase 4: Documentation" << 'SETUP_EOF_DOCS'
# C-Thread Phase 4: Documentation

You are Ralph in DOCUMENTATION phase. Document changes and learnings from this development cycle.

## Your Tasks

1. **Review What Was Built**
   - Read ralph/progress.txt for full history
   - Review implemented stories in @ralph/prd.json

2. **Update Code Documentation**
   - Add/update docstrings for new code
   - Update API documentation if endpoints were added
   - Ensure complex logic has comments

3. **Create Summary**
   - Summarize changes for this cycle
   - Document any architectural decisions
   - Note technical debt introduced

## Progress Summary
```markdown
## Cycle Summary - [Date]

### Stories Completed
- [ID]: [Title] - [Brief description]

### Key Decisions
- [Decision]: [Rationale]

### Technical Debt
- [Item]: [Priority and plan]

### Learnings
- [Learning that should inform future work]
```

## Important
- Don't over-document
- Be concise but complete
- Document decisions, not just changes
SETUP_EOF_DOCS

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 5: Metaprompts
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 5/12: Creating metaprompts...${NC}"

# --- builder-template.md ---
write_file "ralph/metaprompts/builder-template.md" "Builder agent template" << 'SETUP_EOF_BUILDER'
# Builder Agent Template

You are a builder agent for story **{story_id}**: {story_title}.

## Acceptance Criteria

{acceptance_criteria}

## Focus

- Directories: {focus_dirs}
- Domain: {domain}

## Instructions

1. Read the relevant code in the focus directories
2. Implement the story requirements fully — no stubs, no TODOs
3. Run validation (see .ralph.json -> validation.testCommand)
4. Fix any failures before proceeding
5. Commit all changes: `feat({module}): {story_id} - {story_title}`
6. Update the task status via TaskUpdate when done

## Rules

- Work on THIS story ONLY — do not touch other stories
- Do not modify `ralph/prd.json` — the validator handles that
- If blocked by missing dependencies, document what's needed and stop
- Commit frequently — small, focused commits are better than one large commit

## Self-Validation Checklist

Before marking complete, verify:
- [ ] All acceptance criteria are addressed in the code
- [ ] Tests pass
- [ ] Changes are committed
SETUP_EOF_BUILDER

# --- validator-template.md ---
write_file "ralph/metaprompts/validator-template.md" "Validator agent template" << 'SETUP_EOF_VALIDATOR'
# Validator Agent Template

You are a validator agent for story **{story_id}**: {story_title}.

## Acceptance Criteria

{acceptance_criteria}

## Instructions

1. **Review Changes**: Read the code changes made by the builder agent
   - Check `git diff main...HEAD` or `git log --oneline -5` to find relevant commits
2. **Run Tests**: Execute the test suite (see .ralph.json -> validation.testCommand)
3. **Verify Acceptance Criteria**: Check each criterion one by one
4. **Report Results**:
   - If ALL criteria pass: Update `ralph/prd.json` to set `passes: true` for this story
   - If ANY criterion fails: Document what failed and why

## Output Format

```
## Validation Report: {story_id}

### Acceptance Criteria Results
- [PASS/FAIL] Criterion 1: {description}
- [PASS/FAIL] Criterion 2: {description}

### Test Results
- Tests run: {count}
- Tests passed: {count}
- Tests failed: {count}

### Decision: PASS / FAIL
{reason if fail}
```

## Rules

- Do NOT implement code — only validate what the builder produced
- Do NOT modify source files — only update `ralph/prd.json` on pass
- Be strict: partial implementations should FAIL
- Append validation summary to `ralph/progress.txt`
SETUP_EOF_VALIDATOR

# --- prd-to-tasks.md ---
write_file "ralph/metaprompts/prd-to-tasks.md" "PRD to TaskCreate converter" << 'SETUP_EOF_PRDTASKS'
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
SETUP_EOF_PRDTASKS

echo ""
# ═══════════════════════════════════════════════════════════════
# Step 6: Hooks
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 6/12: Creating Claude Code hooks...${NC}"

# --- ralph_stop.py ---
write_file ".claude/hooks/ralph_stop.py" "Loop control + story validation" << 'SETUP_EOF_STOP'
#!/usr/bin/env python3
"""
Ralph Stop Hook - Validates story completion and controls loop continuation.

Checks if all stories in prd.json have passes: true.
Logs completion status to progress.txt.
Returns JSON status for loop control.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.parent.parent  # project root
RALPH_DIR = SCRIPT_DIR / "ralph"
PRD_FILE = RALPH_DIR / "prd.json"
PROGRESS_FILE = RALPH_DIR / "progress.txt"
LOG_FILE = SCRIPT_DIR / ".claude" / "logs" / "ralph_stop.log"


def log_message(message: str, level: str = "INFO"):
    timestamp = datetime.now().isoformat()
    log_line = f"[{timestamp}] [{level}] {message}"
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(log_line + "\n")
    print(log_line, file=sys.stderr)


def read_prd():
    if not PRD_FILE.exists():
        log_message(f"PRD file not found: {PRD_FILE}", "WARNING")
        return None
    try:
        with open(PRD_FILE) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        log_message(f"Invalid JSON in PRD: {e}", "ERROR")
        return None


def get_story_status(prd):
    stories = prd.get("userStories", [])
    total = len(stories)
    pending = []
    completed = 0
    for story in stories:
        if story.get("passes", False):
            completed += 1
        else:
            pending.append({
                "id": story.get("id", "unknown"),
                "title": story.get("title", "No title")
            })
    return total, completed, pending


def append_progress(message: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(PROGRESS_FILE, "a") as f:
        f.write(f"\n## [{timestamp}] Stop Hook Check\n")
        f.write(message + "\n")
        f.write("---\n")


def save_checkpoint(story_id: str, story_data: dict, outcome: str):
    checkpoint = {
        "type": "story_completion",
        "story_id": story_id,
        "title": story_data.get("title", ""),
        "outcome": outcome,
        "timestamp": datetime.now().isoformat()
    }
    checkpoint_dir = RALPH_DIR / "checkpoints"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_file = checkpoint_dir / f"{story_id}.json"
    with open(checkpoint_file, "w") as f:
        json.dump(checkpoint, f, indent=2)
    log_message(f"Checkpoint saved: {checkpoint_file}", "INFO")


def check_completion():
    prd = read_prd()

    if prd is None:
        result = {"status": "no_prd", "message": "No PRD file found", "continue": False}
        print(json.dumps(result))
        return 0

    total, completed, pending = get_story_status(prd)

    if total == 0:
        result = {"status": "empty_prd", "message": "PRD has no stories", "continue": False}
        print(json.dumps(result))
        return 0

    if not pending:
        log_message(f"All {total} stories completed!", "SUCCESS")
        append_progress(f"All {total} stories completed successfully.")
        save_checkpoint("final", {"title": "All stories completed"}, "success")
        result = {"status": "complete", "message": f"All {total} stories passed", "continue": False, "total": total, "completed": completed}
        print(json.dumps(result))
        return 0
    else:
        pending_count = len(pending)
        next_story = pending[0]
        log_message(f"{pending_count} stories remaining. Next: {next_story['id']}")
        append_progress(f"Stories remaining: {pending_count}\nNext: {next_story['id']} - {next_story['title']}")

        for story in prd.get("userStories", []):
            if story.get("passes", False):
                save_checkpoint(story.get("id", "unknown"), story, "completed")

        result = {"status": "in_progress", "message": f"{pending_count} stories remaining", "continue": True, "total": total, "completed": completed, "pending": pending_count, "next_story": next_story}
        print(json.dumps(result))
        return 0


if __name__ == "__main__":
    try:
        sys.exit(check_completion())
    except Exception as e:
        log_message(f"Hook error: {e}", "ERROR")
        print(json.dumps({"status": "error", "message": str(e), "continue": False}))
        sys.exit(1)
SETUP_EOF_STOP

# --- log_action.py ---
write_file ".claude/hooks/log_action.py" "Action logger (PostToolUse + progress.txt)" << 'SETUP_EOF_LOG'
#!/usr/bin/env python3
"""
Action Logger Hook - Logs tool usage for observability.

Captures PostToolUse events to track agent activity.
Logs to .claude/logs/ for debugging AND to ralph/progress.txt
for real-time visibility of what agents are doing.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.parent.parent
LOG_DIR = SCRIPT_DIR / ".claude" / "logs"
ACTIONS_LOG = LOG_DIR / "actions.log"
ACTIONS_JSON = LOG_DIR / "actions.jsonl"
PROGRESS_FILE = SCRIPT_DIR / "ralph" / "progress.txt"

# Patterns that indicate significant Bash commands (stack-agnostic)
SIGNIFICANT_BASH_PATTERNS = {
    "pytest": "Test",
    "jest": "Test",
    "vitest": "Test",
    "mocha": "Test",
    "npm test": "Test",
    "npm run test": "Test",
    "cargo test": "Test",
    "go test": "Test",
    "migration": "Migration",
    "migrate": "Migration",
    "git commit": "Commit",
    "git add": "Stage",
    "lint": "Lint",
    "build": "Build",
}


def ensure_log_dir():
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def get_event_data():
    try:
        if not sys.stdin.isatty():
            input_data = sys.stdin.read()
            if input_data.strip():
                return json.loads(input_data)
    except (json.JSONDecodeError, IOError):
        pass
    return {
        "tool": os.environ.get("CLAUDE_TOOL", "unknown"),
        "event_type": os.environ.get("CLAUDE_EVENT_TYPE", "unknown"),
        "timestamp": datetime.now().isoformat()
    }


def make_relative(file_path):
    """Convert absolute path to relative from project root."""
    project_str = str(SCRIPT_DIR) + "/"
    if file_path.startswith(project_str):
        return file_path[len(project_str):]
    return file_path


def append_progress(message):
    """Append a progress line to ralph/progress.txt."""
    if not PROGRESS_FILE.exists():
        return
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(PROGRESS_FILE, "a") as f:
            f.write(f"[{timestamp}] AGENT: {message}\n")
    except IOError:
        pass


def log_progress(event):
    """Log significant actions to progress.txt for real-time visibility."""
    tool = event.get("tool_name", event.get("tool", ""))
    tool_input = event.get("tool_input", {})

    if not isinstance(tool_input, dict):
        return

    # File modifications
    if tool in ("Write", "Edit", "MultiEdit"):
        file_path = tool_input.get("file_path", "")
        if file_path:
            rel = make_relative(file_path)
            if "progress.txt" in rel or ".claude/logs" in rel:
                return
            action = "Edit" if tool in ("Edit", "MultiEdit") else "Write"
            append_progress(f"{action} {rel}")

    # Significant bash commands
    elif tool == "Bash":
        command = tool_input.get("command", "")
        for pattern, label in SIGNIFICANT_BASH_PATTERNS.items():
            if pattern in command:
                cmd_short = command[:100].replace("\n", " ")
                append_progress(f"{label}: {cmd_short}")
                break


def log_action(event):
    ensure_log_dir()
    timestamp = datetime.now().isoformat()
    tool = event.get("tool_name", event.get("tool", "unknown"))
    event_type = event.get("event_type", "PostToolUse")
    log_line = f"[{timestamp}] {event_type}: {tool}"

    with open(ACTIONS_LOG, "a") as f:
        f.write(log_line + "\n")

    event["logged_at"] = timestamp
    with open(ACTIONS_JSON, "a") as f:
        f.write(json.dumps(event) + "\n")

    print(log_line, file=sys.stderr)

    # Log significant actions to progress.txt
    log_progress(event)


def main():
    try:
        event = get_event_data()
        log_action(event)
        return 0
    except Exception as e:
        print(f"Log hook error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
SETUP_EOF_LOG

# --- validate_work.py ---
write_file ".claude/hooks/validate_work.py" "Self-validation hook" << 'SETUP_EOF_VALIDATE'
#!/usr/bin/env python3
"""
validate_work.py - PostToolUse self-validation hook

Detects file type after Write/Edit operations and suggests
running the appropriate linter/checker.
"""

import json
import os
import sys


def get_tool_input():
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "")
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "{}")
    try:
        input_data = json.loads(tool_input)
    except json.JSONDecodeError:
        input_data = {}
    return tool_name, input_data


def detect_file_type(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    type_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".tsx": "typescript", ".jsx": "javascript", ".html": "html",
        ".go": "go", ".rs": "rust",
    }
    return type_map.get(ext)


def get_validation_command(file_type, project_root):
    if file_type == "python":
        if os.path.exists(os.path.join(project_root, "pyproject.toml")):
            return "pytest --tb=short -q"
        if os.path.exists(os.path.join(project_root, "manage.py")):
            return "python manage.py check"
        return None
    if file_type in ("javascript", "typescript"):
        pkg_json = os.path.join(project_root, "package.json")
        if os.path.exists(pkg_json):
            try:
                with open(pkg_json) as f:
                    pkg = json.load(f)
                scripts = pkg.get("scripts", {})
                if "lint" in scripts:
                    return "npm run lint"
            except (json.JSONDecodeError, IOError):
                pass
        return None
    if file_type == "go":
        return "go vet ./..."
    return None


def main():
    tool_name, input_data = get_tool_input()
    if tool_name not in ("Write", "Edit", "MultiEdit"):
        return

    file_path = input_data.get("file_path", "")
    if not file_path:
        file_path = input_data.get("edits", [{}])[0].get("file_path", "") if isinstance(input_data.get("edits"), list) else ""
    if not file_path:
        return

    file_type = detect_file_type(file_path)
    if not file_type:
        return

    project_root = os.path.dirname(file_path)
    markers = ["pyproject.toml", "manage.py", "package.json", "go.mod", "Cargo.toml", ".git"]
    for _ in range(10):
        if any(os.path.exists(os.path.join(project_root, m)) for m in markers):
            break
        parent = os.path.dirname(project_root)
        if parent == project_root:
            break
        project_root = parent

    validation_cmd = get_validation_command(file_type, project_root)
    if validation_cmd:
        result = {"decision": "ALLOW", "reason": f"Consider running `{validation_cmd}` to validate {file_type} changes"}
        print(json.dumps(result))
    else:
        print(json.dumps({"decision": "ALLOW"}))


if __name__ == "__main__":
    main()
SETUP_EOF_VALIDATE

# --- .claude/settings.json ---
write_file ".claude/settings.json" "Hook configuration" << 'SETUP_EOF_SETTINGS'
{
  "hooks": {
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/ralph_stop.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/log_action.py"
          }
        ]
      },
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/hooks/validate_work.py"
          }
        ]
      }
    ]
  }
}
SETUP_EOF_SETTINGS

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 7: Slash Commands
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 7/12: Creating slash commands...${NC}"

# --- go.md ---
write_file ".claude/commands/go.md" "/go command - Development Lifecycle Wizard" << 'SETUP_EOF_GOCMD'
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
SETUP_EOF_GOCMD

# --- plan.md ---
write_file ".claude/commands/plan.md" "/plan command - Planning Mode" << 'SETUP_EOF_PLANCMD'
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
SETUP_EOF_PLANCMD

# --- setup.md ---
write_file ".claude/commands/setup.md" "/setup command - Post-Bootstrap Configuration Wizard" << 'SETUP_EOF_SETUPCMD'
# /setup — Post-Bootstrap Configuration Wizard

Configure all `ADAPT:` markers in the project after running `setup-ralph.sh`.

## Arguments
- `$ARGUMENTS` — Optional: project description (e.g., "Django REST API for e-commerce")

## Instructions

You are the Ralph setup wizard. The bootstrap script (`setup-ralph.sh`) already created all files. Your job is to detect the stack, ask the user a few questions, and fill in the `ADAPT:` markers.

**Be fast and direct. No long explanations.**

---

### Step 1: Detect Environment

Run this diagnostic silently (don't show the user raw output, just summarize):

```bash
echo "=== Stack Detection ==="
[ -f "manage.py" ] && echo "DETECTED: Django (manage.py)"
[ -f "requirements.txt" ] && echo "DETECTED: Python requirements"
[ -f "pyproject.toml" ] && echo "DETECTED: Python pyproject.toml"
[ -f "package.json" ] && echo "DETECTED: Node.js (package.json)"
[ -f "go.mod" ] && echo "DETECTED: Go (go.mod)"
[ -f "Cargo.toml" ] && echo "DETECTED: Rust (Cargo.toml)"
[ -f "pom.xml" ] && echo "DETECTED: Java (pom.xml)"
[ -f "tsconfig.json" ] && echo "DETECTED: TypeScript"
[ -d "venv" ] || [ -d ".venv" ] && echo "DETECTED: Python venv"
[ -d "node_modules" ] && echo "DETECTED: node_modules"
[ -d ".git" ] && echo "DETECTED: Git repo"
[ -f ".ralph.json" ] && echo "DETECTED: .ralph.json exists"
[ -f "CLAUDE.md" ] && echo "DETECTED: CLAUDE.md exists"
echo "=== Directory Contents ==="
ls -la
```

Present a brief summary to the user: "Detected: [stack], [tools found]"

---

### Step 2: Ask Questions

Use **AskUserQuestion** to ask the following (skip questions you can infer from detection or `$ARGUMENTS`):

**Question 1: Stack confirmation**
- header: "Stack"
- question: "Which stack is this project using?"
- Options based on detection. Always include these:
  - "Django + DRF" (if manage.py detected, mark as recommended)
  - "FastAPI"
  - "Next.js / React"
  - "Node.js / Express"
- If nothing detected, also include: "Go", "Other"

**Question 2: Project info**
- header: "Project"
- question: "What's the project name and a one-line description?"
- This can be free text (use "Other" option flow or infer from `$ARGUMENTS`)
- If `$ARGUMENTS` provided, skip this and use it directly

**Question 3: Git setup** (only if `.git` does NOT exist)
- header: "Git"
- question: "How should we set up git?"
- Options:
  - "Initialize git + create develop branch (Recommended)"
  - "Initialize git only"
  - "Skip git setup"

**Question 4: Repository location** (only if user chose to initialize git in Q3)
- header: "Repo"
- question: "Where should the remote repository live?"
- Options:
  - "Organization repo (Recommended)" — `gh repo create ORG/project-name --private`. Ask for org name if not obvious.
  - "Personal repo" — `gh repo create project-name --private`
  - "Local only (no remote)" — just git init, no push

**Question 5: Testing** (only if not obvious from stack)
- header: "Testing"
- question: "What test command should Ralph use?"
- Options based on stack:
  - Django: "pytest" / "python manage.py test"
  - Node: "npm test" / "jest"
  - Go: "go test ./..."
  - Python: "pytest"

---

### Step 3: Configure Files

Based on the answers, edit these files using the Edit tool. Replace ALL `ADAPT:` markers.

#### .ralph.json

Replace:
- `"ADAPT: Project Name"` → actual project name
- `"PROJ"` → project identifier (uppercase abbreviation, e.g., "NHUB", "ECOM", "API")
- `"ADAPT: your test command here"` → actual test command
- `"ADAPT: django+drf | fastapi | express | go | etc"` → actual backend
- `"ADAPT: templates+tailwind | react | vue | etc"` → actual frontend
- `"ADAPT: pytest | jest | go test | etc"` → actual testing framework
- `"ADAPT: postgresql | mysql | sqlite | mongodb | etc"` → actual database
- Update `agents.backend` and `agents.frontend` paths to match actual project structure

#### CLAUDE.md

Replace all `ADAPT:` sections with real project info:
- Project description
- Stack details (backend, frontend, DB, testing)
- Development commands (serve, test, migrate, etc.)

#### justfile

Replace the `serve` and `test` recipes with actual commands:

**Django:**
```just
serve:
  source venv/bin/activate && python manage.py runserver 0.0.0.0:8000
test *args:
  source venv/bin/activate && pytest {{args}}
migrate:
  source venv/bin/activate && python manage.py migrate
makemigrations app="":
  source venv/bin/activate && python manage.py makemigrations {{app}}
```

**FastAPI:**
```just
serve:
  source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000
test *args:
  source venv/bin/activate && pytest {{args}}
```

**Next.js / Node:**
```just
serve:
  npm run dev
test *args:
  npm test {{args}}
build:
  npm run build
```

**Go:**
```just
serve:
  go run .
test *args:
  go test ./... {{args}}
build:
  go build -o bin/app .
```

#### mprocs.yaml

Update the `dev-server` shell command and `test-watch` to match the stack.

---

### Step 4: Git Setup (if requested)

If user chose to initialize git:

```bash
git init
git add -A
git commit -m "feat: initial project setup with Ralph TAC"
git checkout -b develop
```

If user chose a remote repository:

**Organization repo:**
```bash
# Ask for org name if not inferred (e.g., "Gebesa-Office-Furniture")
gh repo create ORG_NAME/PROJECT_NAME --private --source=. --push
git push -u origin develop
```

**Personal repo:**
```bash
gh repo create PROJECT_NAME --private --source=. --push
git push -u origin develop
```

**Local only:** No remote setup needed.

If `gh` is not installed, inform the user:
```
gh CLI not found. Install it with: brew install gh
Then authenticate: gh auth login
After that, you can create the remote repo manually:
  gh repo create ORG/project-name --private --source=. --push
```

---

### Step 5: Verification

Run:
```bash
bash -n ralph/ralph-tac.sh && echo "ralph-tac.sh OK"
bash -n ralph/ralph-claude.sh && echo "ralph-claude.sh OK"
bash -n ralph/scripts/common.sh && echo "common.sh OK"
bash -n ralph/scripts/p-thread.sh && echo "p-thread.sh OK"
python3 -m py_compile .claude/hooks/ralph_stop.py && echo "ralph_stop.py OK"
just --list 2>/dev/null && echo "justfile OK"
```

Check that no `ADAPT:` markers remain:
```bash
grep -r "ADAPT:" .ralph.json CLAUDE.md justfile mprocs.yaml 2>/dev/null || echo "No ADAPT markers remaining"
```

---

### Step 6: Show Summary

Show the user a clean summary:

```
Setup complete!

  Project:  [name]
  Stack:    [backend] + [frontend] + [testing]
  Git:      [initialized / already existed]
  Remote:   [org/repo-name | user/repo-name | local only | N/A]

  Next steps:
  1. Start developing:  just ralph-go "feature description"
  2. Or use wizard:     /go
  3. Dashboard:         just observe
  4. Interactive:       claude (CLAUDE.md gives context)
```
SETUP_EOF_SETUPCMD

# --- ux.md ---
write_file ".claude/commands/ux.md" "/ux command - UI/UX Design Guide & Review" << 'SETUP_EOF_UXCMD'
# UI/UX Guide - Modern Minimal

Guia de UI/UX para interfaces modernas y limpias. Dos modos de uso:

- `guide`: Reglas concretas "hacer / no hacer" para una superficie especifica
- `review`: Evaluar una interfaz existente y generar lista de fixes P0/P1/P2

Salida siempre en espanol. Preferir bullets, no parrafos largos.

## Cuando usar esta skill

- Disenar o implementar una nueva pantalla/componente
- Revisar UI existente antes de entregar
- Evaluar screenshots o mocks
- Code review de frontend (JSX/TSX, CSS, Tailwind)

---

## Flujo `guide`

1. Identificar la superficie: dashboard / settings / formulario / lista-detalle / flujo de creacion / landing
2. Identificar la tarea principal del usuario y el CTA primario
3. Aplicar principios de sistema (seccion A)
4. Aplicar principios de UI (seccion B)
5. Si hay iconos: aplicar reglas de iconos (seccion F)

## Flujo `review`

1. Declarar supuestos (plataforma, usuario objetivo, tarea principal)
2. Listar hallazgos como P0 (blocker) / P1 (importante) / P2 (pulir) con evidencia corta
3. Para cada problema mayor, diagnosticar: brecha de ejecucion vs evaluacion; slip vs mistake
4. Proponer fixes implementables (layout, jerarquia, componentes, copy, estados)
5. Cerrar con checklist de verificacion

### Template de review

```
## Contexto
- Superficie: [web/app] + tipo de pagina
- Tarea principal del usuario:
- CTA primario:
- Supuestos:

## Hallazgos

### P0 (blocker)
- Problema:
  - Evidencia:
  - Diagnostico: brecha de ejecucion / evaluacion; slip / mistake
  - Fix:
  - Verificacion:

### P1 (importante)
- Problema:
  - Evidencia:
  - Fix:
  - Verificacion:

### P2 (pulir)
- Problema:
  - Fix:

## Checklist de verificacion
- [ ] CTA primario obvio y unico por seccion
- [ ] Agrupacion y encabezados reflejan modelo mental del usuario
- [ ] Estados cubiertos: carga, vacio, error, exito, permisos
- [ ] Componentes y textos consistentes entre pantallas
- [ ] Elementos clickeables se ven clickeables
- [ ] Prevencion de errores + recuperacion + mensajes accionables
- [ ] Defaults y progressive disclosure reducen carga cognitiva
- [ ] Jerarquia visual, alineacion, espaciado intencional (CRAP)
- [ ] Estilo minimal: colores restringidos, espacioso, poco copy
- [ ] Iconos: sin emoji, set consistente, labels donde hay ambiguedad
```

---

## A) Principios de sistema (primera prioridad)

### Constancia conceptual
- El mismo concepto de negocio mantiene el mismo nombre, significado y comportamiento en todo el sistema
- Pregunta: si el usuario aprende esto en un lugar, lo entiende en todos los demas?

### Foco en tarea principal
- Cada pantalla tiene un objetivo dominante con la mayor prioridad visual
- El usuario debe identificar la accion mas importante en <3 segundos

### Disciplina de copy
- El copy visible viene del contenido de negocio, NO de restricciones tecnicas
- Fuentes validas: tarea del usuario, estado del sistema, resultado + siguiente paso, contexto de riesgo/confianza
- Fuentes internas (NO mostrar al usuario): restricciones de estilo, notas tecnicas, instrucciones de prompt

### Perceptibilidad de estado
- Los estados importantes deben ser visibles (modo, seleccion, cambios sin guardar, permisos)
- Senal preferida (de menor a mayor ruido): cambio estructural > estado del control > indicador inline > feedback post-accion > banner persistente
- Evitar labels de estado que repitan lo que la estructura ya hace obvio

### Capas de texto de ayuda (evitar "muro de hints")
- L0 (siempre visible): solo info necesaria para completar la tarea
- L1 (cerca): guia corta para inputs de alto riesgo/ambiguedad
- L2 (bajo demanda): ejemplos, detalles avanzados, "saber mas"
- L3 (post-accion): resultado, error, recuperacion, siguiente paso
- Si una pagina necesita muchos hints permanentes, mejorar la IA o los defaults primero

### Cierre del loop de feedback
- Toda accion del usuario completa el ciclo: recibida > en progreso > resultado > siguiente paso
- En cualquier momento el usuario debe saber que esta haciendo el sistema y que hacer despues

### Prevencion + recuperabilidad
- Reducir probabilidad de error ANTES del submit
- Proveer caminos de recuperacion para resultados de alto riesgo

### Complejidad progresiva
- Mostrar controles minimos por defecto; revelar avanzados cuando el contexto lo requiera
- Novatos completan la tarea rapido sin limitar a expertos

### Presupuesto cognitivo
- Limitar nuevas reglas, terminos y modos por pantalla
- Priorizar reutilizacion sobre novedad

---

## B) Principios de UI (conjunto minimo)

### Task-first UX
- Tarea principal obvia en <3 segundos
- Exactamente un CTA primario por pantalla/seccion
- Optimizar el happy path; ocultar controles avanzados con progressive disclosure

### Arquitectura de informacion
- Agrupar por modelo mental del usuario (meta/objeto/tiempo/estado), NO por campos del backend
- Titulos de seccion claros; patrones de navegacion estables entre pantallas similares
- Cuando crecen los items: agregar busqueda/filtro/orden temprano

### Feedback y estado del sistema
- Cubrir TODOS los estados: carga, vacio, error, exito, permisos
- Despues de cualquier accion responder: funciono? + que cambio? + que puedo hacer ahora?
- Preferir feedback inline y contextual sobre toasts globales

### Consistencia y predictibilidad
- Misma interaccion = mismo componente + mismo texto + misma ubicacion
- Set pequeno y estable de variantes de componentes

### Affordance + Signifiers
- Lo clickeable debe verse clickeable (estilo de boton/link + hover/focus + cursor pointer)
- Acciones primarias necesitan label; icon-only solo para acciones universales
- Mostrar restricciones ANTES del submit (formato, unidades, requerido)

### Prevencion y recuperacion de errores
- Prevenir con constraints, defaults, validacion inline
- Acciones destructivas reversibles cuando sea posible; si no, confirmacion deliberada
- Mensajes de error accionables: que paso + como arreglarlo

### Control de carga cognitiva
- Defaults inteligentes, presets, progressive disclosure
- Dividir tareas largas en pasos solo cuando reduce pensamiento
- Ruido visual bajo: menos bordes, menos colores, menos highlights compitiendo

### CRAP (jerarquia visual)
- **Contraste**: enfatizar las pocas cosas que importan (CTA, estado actual, numeros clave)
- **Repeticion**: tokens/componentes/espaciado siguen una escala; evitar estilos "casi iguales"
- **Alineacion**: alinear a un grid claro; corregir drift de 2px; alinear baselines
- **Proximidad**: apretado dentro de un grupo, suelto entre grupos; el espaciado es la herramienta principal de agrupacion

---

## C) Espaciado y layout

- Unidad base: 4px
- Escala permitida: 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48
- Valores fuera de escala necesitan justificacion
- Mismo tipo de componente mantiene el mismo espaciado interno
- Alinear a un grid y corregir drift de 1-2px
- Tight dentro del grupo, loose entre grupos
- Wrappers extra deben agregar funcion real (agrupacion, estado, scroll, affordance). Si solo agrega borde/fondo, quitar y agrupar con espaciado

---

## D) Estilo moderno minimal

- Whitespace + tipografia para crear jerarquia; evitar diseno decoration-first
- Superficies sutiles (elevacion ligera, bordes de bajo contraste). Evitar sombras pesadas
- Paleta de color reducida; un color de acento para acciones primarias y estados clave
- Copy: labels cortos y directos; helper text solo cuando reduce errores o aumenta confianza

### Anti-AI Self-Check (correr despues de generar UI)
- **Gradientes**: deben comunicar significado (progreso, profundidad, estado). Maximo 1 decorativo por pagina
- **Sin emoji como UI**: re-verificar que no se colaron como iconos, indicadores de estado, o labels
- **Necesidad del copy**: si quito este texto, el usuario entiende por layout, iconos y posicion? Si si, quitarlo
- **Justificacion de decoracion**: cada efecto visual (blur, glow, animacion, sombras) debe responder "que ayuda a entender al usuario?" Sin respuesta = quitar

---

## E) Motion (animaciones)

- Motion explica **jerarquia** (que es panel/overlay) y **cambio de estado** (que acaba de pasar). Evitar motion decorativo
- Vocabulario default: fade > translate+fade > scale+fade para overlays. Evitar bounce/elastic
- Canvas/area de contenido estable. Paneles/overlays se mueven; la superficie de trabajo no "flota"
- Mismo tipo de componente usa el mismo patron de motion
- Evitar saltos de layout. Usar skeletons/placeholders para mantener layout estable

---

## F) Iconos

### Reglas duras
- NO usar emoji como iconos ni decoracion
- UN set de iconos para todo el producto. No mezclar outlined/filled/3D/emoji
- Preferir significados obvios sobre metaforas creativas. Si puede malinterpretarse, agregar label

### Checklist
- Consistencia de estilo: mismo stroke weight o mismo fill style
- Tamanos estandar: 16/20/24 (o los del sistema)
- Alineacion optica (los bounding boxes mienten; ajustar visualmente)
- Targets tactiles: area minima de click adecuada, no reducir al glifo
- Acciones primarias: texto o texto+icono; icon-only solo para acciones universales
- Tooltips son soporte, no la forma primaria de entender una accion

### Cuando preferir texto sobre iconos
- La accion es poco comun en el producto
- El icono es especifico del dominio
- La accion es destructiva o de alto riesgo

### Sets recomendados (elegir uno, no mezclar)
- Lucide / Feather (web)
- Material Symbols outlined o rounded (elegir uno)
- SF Symbols (Apple)

---

## G) Psicologia de interaccion (referencia rapida)

### Leyes de HCI
- **Fitts**: targets mas grandes y cercanos son mas rapidos. CTA primario = mas grande. Acciones destructivas = pequenas y separadas. Targets minimos: 44x44 CSS px
- **Hick**: mas opciones = decisiones mas lentas. Limitar opciones visibles a ~7; usar agrupacion, busqueda, defaults
- **Miller**: memoria de trabajo ~7 items. Chunking en formularios (<=5-7 campos por grupo). No forzar al usuario a recordar info entre pantallas

### Sesgos cognitivos relevantes
- **Anclaje**: el primer valor/opcion que el usuario ve se vuelve referencia. Elegir defaults con cuidado
- **Efecto default**: usuarios se quedan con la opcion predeterminada. Defaults deben ser la opcion mas segura y comun
- **Peak-End**: la experiencia se juzga por el momento mas intenso y el final. Invertir en pantallas de exito/completado
- **Aversion a la perdida**: el dolor de perder es ~2x mas fuerte que el placer de ganar. En confirmaciones destructivas: mostrar que se va a perder
- **Ceguera por inattencion**: info fuera del foco de atencion es invisible. Feedback critico cerca del punto de accion, no en banners lejanos

### Flujo de interaccion
- **Costo de interrupcion**: cada modal/redirect tiene costo de recuperacion cognitiva. Preferir inline > modal > redirect
- **Momentum de accion**: en flujos secuenciales, no interrumpir con confirmaciones en cada paso. Tab order natural
- **Reversibilidad**: usuarios exploran con mas confianza cuando saben que pueden deshacer. Undo para acciones comunes; para irreversibles, confirmacion explicita

### Economia de atencion
- **Presupuesto de peso visual**: una pagina tiene atencion finita. Enfatizar demasiado = enfatizar nada. Un foco visual por seccion
- **Patrones de escaneo**: F-shape (contenido), Z-shape (landing). Info critica arriba-izquierda y en headings. Front-load labels: la palabra diferenciadora primero

---

## H) Psicologia de diseno (Norman)

- **Affordances**: lo que un objeto permite hacer. Si una accion es importante, debe ser descubrible sin hover/tooltip
- **Signifiers**: las pistas que indican acciones posibles (forma de boton, estilo de link, iconos+labels, hover/focus, cursor)
- **Mapping**: la relacion entre controles y sus efectos. Poner controles cerca de lo que controlan
- **Constraints**: limitar acciones posibles previene errores. Preferir constraints+defaults sobre warnings
- **Modelo conceptual**: el UI debe hacer obvio el modelo correcto. Nouns/labels consistentes, verbos consistentes, causa-efecto claros
- **Feedback**: siempre feedback inmediato para interaccion. Si toma tiempo, mostrar progreso. Despues de exito/fallo, outcome claro + siguiente paso
- **Brecha de ejecucion**: usuario no sabe como hacer lo que quiere → CTA mas claro, signifiers, menos opciones
- **Brecha de evaluacion**: usuario no sabe que paso → loading, disabled, progreso, resultados claros
- **Slip vs Mistake**: slip = accion incorrecta, meta correcta (→ undo, targets mas grandes). Mistake = modelo mental incorrecto (→ mejorar labels, mapping, explicacion)

---

## I) Checklists expandidos

### Estados universales
- **Carga**: skeleton/placeholder con altura estable, prevenir doble-submit, mostrar progreso
- **Vacio**: explicar que significa "vacio", proveer siguiente paso (crear/importar/cambiar filtros)
- **Error**: que paso + por que + que hacer. Preservar input del usuario
- **Exito**: confirmar resultado + siguiente accion (ver, deshacer, compartir)
- **Permisos**: explicar por que esta bloqueado + donde solicitar acceso

### Listas (tabla / cards)
- Una columna/campo primario; detalles secundarios visualmente reducidos
- Altura de fila y alineacion consistentes
- Search/filter/sort ANTES de la lista
- Acciones de alta frecuencia visibles; long-tail bajo menu "mas"

### Formularios
- Defaults y prefill razonables, presets para opciones complejas
- Validacion inline; hints de formato antes del submit
- Agrupar campos por significado con headings
- Labels consistentes en posicion y estilo
- Un submit primario; estado disabled claro

### Settings
- Agrupar por modelo mental (cuenta, seguridad, notificaciones, integraciones, apariencia)
- Label claro + explicacion corta del valor solo si es necesario
- Acciones destructivas separadas y claramente etiquetadas

### Dashboards
- Definir la "historia": que decision debe tomar el usuario aqui?
- KPIs top reducidos; evitar muro de numeros
- Rango de tiempo y filtros obvios y persistentes
- Drill-down para cada metrica clave

### Copy
- Labels cortos sobre parrafos de ayuda
- Helper text solo cuando: previene error, clarifica termino no obvio, explica consecuencias, genera confianza
- Reemplazar verbos vagos ("Aceptar", "OK") con acciones concretas ("Crear", "Guardar", "Publicar")
SETUP_EOF_UXCMD

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 8: Agent Templates
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 8/12: Creating agent templates...${NC}"

# --- backend-agent.md ---
write_file ".claude/agent-templates/backend-agent.md" "Backend agent template" << 'SETUP_EOF_BACKEND'
# Backend Agent Template

You are a backend development agent.

## Your Focus
- Backend models, views, controllers, serializers
- API endpoints
- Database migrations and schema
- Business logic

## Key Paths
Read .ralph.json -> agents.backend for focus directories.

## Guidelines
- Follow existing code patterns in the codebase
- Always run tests after changes (see .ralph.json -> validation.testCommand)
- Create migrations when modifying models

## Task: {task_description}

## Acceptance Criteria
{acceptance_criteria}

## Instructions
1. Read the current module code
2. Plan the implementation
3. Implement changes following existing conventions
4. Run tests
5. Commit: `feat({module}): {description}`
SETUP_EOF_BACKEND

# --- frontend-agent.md ---
write_file ".claude/agent-templates/frontend-agent.md" "Frontend agent template" << 'SETUP_EOF_FRONTEND'
# Frontend Agent Template

You are a frontend development agent.

## Your Focus
- Templates/components
- Styling
- Client-side interactivity
- Static assets

## Key Paths
Read .ralph.json -> agents.frontend for focus directories.

## Guidelines
- Follow existing template/component patterns
- Ensure responsive design
- Use existing styling conventions (Tailwind, CSS modules, etc.)

## Task: {task_description}

## Acceptance Criteria
{acceptance_criteria}

## Instructions
1. Read the current templates/components in the module
2. Identify the base layout and patterns used
3. Implement the UI changes
4. Verify the build pipeline processes assets correctly
5. Test the UI
SETUP_EOF_FRONTEND

# --- testing-agent.md ---
write_file ".claude/agent-templates/testing-agent.md" "Testing agent template" << 'SETUP_EOF_TESTINGAGENT'
# Testing Agent Template

You are a QA/testing agent.

## Your Focus
- Writing and running tests
- Validating acceptance criteria
- Checking for regressions

## Key Paths
Read .ralph.json -> agents.qa for test directories.

## Guidelines
- Use the project's testing framework (see .ralph.json -> validation.testCommand)
- Test models, views/controllers, API endpoints, and permissions
- Test edge cases and error conditions
- Follow existing test patterns in the codebase

## Task: {task_description}

## Acceptance Criteria
{acceptance_criteria}

## Instructions
1. Read the module code to understand what to test
2. Read existing tests for patterns
3. Write comprehensive tests
4. Run tests and ensure all pass
5. Commit: `test({module}): {description}`
SETUP_EOF_TESTINGAGENT

echo ""
# ═══════════════════════════════════════════════════════════════
# Step 9: justfile
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 9/12: Creating justfile...${NC}"

write_file "justfile" "Command runner" << 'SETUP_EOF_JUSTFILE'
set dotenv-load := true

# List all recipes
default:
  @just --list

# === Development ===

# Start development server (ADAPT command to your stack)
serve:
  echo "ADAPT: Add your dev server command here (e.g., python manage.py runserver, npm run dev, go run .)"

# Run tests (ADAPT command to your stack)
test *args:
  echo "ADAPT: Add your test command here (e.g., pytest {{args}}, npm test, go test ./...)"

# === Ralph TAC Threads ===

# L-Thread: Long-running autonomous loop
ralph-l iterations="10":
  ./ralph/ralph-tac.sh L {{iterations}}

# P-Thread: Parallel agents
ralph-p count="3" *args="":
  ./ralph/ralph-tac.sh P {{count}} {{args}}

# C-Thread: Chained phases with checkpoints
ralph-c:
  ./ralph/ralph-tac.sh C

# F-Thread: Fusion analysis
ralph-f prompt:
  ./ralph/ralph-tac.sh F "{{prompt}}"

# B-Thread: Orchestrator with sub-agents
ralph-b:
  ./ralph/ralph-tac.sh B

# Full lifecycle: idea -> PRD -> branch -> plan -> build -> validate -> ship -> track
ralph-go description *args:
  ./ralph/scripts/ralph-go.sh "{{description}}" {{args}}

# === Observability ===

# Launch mprocs dashboard
observe:
  mprocs

# Show PRD status summary
prd-status:
  @jq -r '.userStories[] | "\(.id) - \(.title) - \(if .passes then "DONE" else "PENDING" end)"' ralph/prd.json

# Show only pending stories
prd-pending:
  @jq -r '.userStories[] | select(.passes == false) | "\(.id) - \(.title)"' ralph/prd.json

# Show PRD summary with counts
prd-summary:
  #!/usr/bin/env bash
  TOTAL=$(jq '.userStories | length' ralph/prd.json)
  DONE=$(jq '[.userStories[] | select(.passes == true)] | length' ralph/prd.json)
  PENDING=$(jq '[.userStories[] | select(.passes == false)] | length' ralph/prd.json)
  echo "PRD Summary:"
  echo "  Total:   $TOTAL stories"
  echo "  Done:    $DONE"
  echo "  Pending: $PENDING"
  echo ""
  echo "Progress: $(echo "scale=1; $DONE * 100 / $TOTAL" | bc)%"

# View progress log (last 50 lines)
progress:
  @tail -n 50 ralph/progress.txt

# Follow progress log live
progress-live:
  @tail -f ralph/progress.txt

# === Utilities ===

# Reset project artifacts
reset:
  rm -rf ralph/checkpoints/*
  rm -f .claude/hooks/*.log
  rm -f .claude/logs/*.log
  rm -f .claude/logs/*.jsonl
SETUP_EOF_JUSTFILE

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 10: mprocs.yaml
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 10/12: Creating mprocs.yaml...${NC}"

write_file "mprocs.yaml" "Terminal multiplexer config" << 'SETUP_EOF_MPROCS'
server: 127.0.0.1:4050

procs:
  # === CORE: Claude Code Interactive ===
  claude-primary:
    shell: claude
    autostart: true
    autorestart: false

  # === DEV SERVER ===
  # ADAPT: Change the shell command to your stack's dev server
  dev-server:
    shell: "echo 'ADAPT: Add your dev server command here (e.g., python manage.py runserver, npm run dev)'"
    autostart: false
    autorestart: true

  # === MONITORING ===
  progress-watch:
    shell: |
      if [ -f ralph/progress.txt ]; then
        tail -f ralph/progress.txt
      else
        echo "Waiting for ralph/progress.txt..."
        while [ ! -f ralph/progress.txt ]; do sleep 5; done
        tail -f ralph/progress.txt
      fi
    autostart: false
    autorestart: true

  logs:
    shell: "tail -f .claude/logs/actions.log 2>/dev/null || echo 'No logs yet. Waiting...' && sleep infinity"
    autostart: false

  # === TEST WATCHER ===
  # ADAPT: Change to your stack's test watcher
  test-watch:
    shell: "echo 'ADAPT: Add your test watcher command here'"
    autostart: false

  # === RALPH THREADS ===
  ralph-l:
    shell: "bash ralph/ralph-tac.sh L"
    autostart: false
    autorestart: false

  ralph-p:
    shell: "echo '=== Ralph P-Thread ===' && echo 'Strategies: shared (default) | worktrees (branch per story)' && read -p 'Number of agents (default 4): ' count && read -p 'Strategy [shared/worktrees] (default: config): ' strat && bash ralph/ralph-tac.sh P ${count:-4} ${strat:+--$strat}"
    autostart: false
    autorestart: false

  ralph-go:
    shell: "echo '=== Ralph Go ===' && read -p 'Feature description: ' desc && just ralph-go \"$desc\""
    autostart: false
    autorestart: false

  # === MANUAL TERMINAL ===
  shell:
    shell: "zsh"

keymap_procs:
  <C-s>: { c: start-proc }
  <C-x>: { c: term-proc }
  <C-r>: { c: restart-proc }
SETUP_EOF_MPROCS

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 11: CLAUDE.md
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 11/12: Creating CLAUDE.md...${NC}"

# Use unquoted heredoc here so $PROJECT_NAME gets expanded
write_file "CLAUDE.md" "Project context for Claude Code" << SETUP_EOF_CLAUDEMD
# CLAUDE.md - ${PROJECT_NAME}

Agentic development system based on TAC (Tactical Agentic Coding), integrated with Thread-based Engineering and Claude Code.

## Project
ADAPT: Brief project description here.

## Stack
ADAPT: Fill in your actual stack here:
- Backend: (e.g., Django 5.x + DRF, FastAPI, Express, Go)
- Frontend: (e.g., Django Templates + Tailwind + Alpine.js, React, Vue)
- DB: (e.g., PostgreSQL, MySQL, MongoDB)
- Testing: (e.g., pytest, jest, go test)

## Configuration
- \`.ralph.json\` — Project config
- \`justfile\` — Command launchpad (\`just\` to list all recipes)
- \`mprocs.yaml\` — Dev services + agent orchestration

## Commands

### Full Lifecycle (one command)
\`\`\`
just ralph-go "description"            # Full cycle: PRD -> branch -> build -> ship
just ralph-go "desc" --agents 5        # Custom agent count
just ralph-go "desc" --dry-run         # Preview phases without executing
\`\`\`

### Individual Threads
\`\`\`
just ralph-l [iterations]   # L-Thread: long-running loop
just ralph-p [count]         # P-Thread: parallel agents
just ralph-c                 # C-Thread: chained phases
just ralph-f "prompt"        # F-Thread: fusion analysis
just ralph-b                 # B-Thread: orchestrator
\`\`\`

### Development
ADAPT: Fill in your actual dev commands:
\`\`\`
just serve                   # Start dev server
just test [args]             # Run tests
\`\`\`

### Observability
\`\`\`
just observe                 # Launch mprocs dashboard
just prd-status              # PRD story status
just progress                # View progress log
\`\`\`

## Architecture

\`\`\`
CLAUDE.md                   # This file
.ralph.json                 # Project configuration
justfile                    # Command launchpad
mprocs.yaml                # Process orchestration

ralph/
  ralph-tac.sh              # TAC entry point (thread dispatcher)
  ralph-claude.sh           # L-Thread autonomous loop
  prd.json                  # Product Requirements Document
  progress.txt              # Session progress log
  scripts/
    ralph-go.sh             # Full lifecycle: idea -> shipped code
    common.sh               # Shared utilities (colors, PRD helpers)
    p-thread.sh             # P-Thread orchestrator
    f-thread.sh             # Fusion analysis runner
    observe.sh              # mprocs config generator
  prompts/                  # Agent instruction prompts
  metaprompts/              # Agent template prompts

.claude/
  settings.json             # Hook configuration
  hooks/                    # Python hooks (stop, log, validate)
  commands/                 # Slash commands (/go, /plan)
  agent-templates/          # Agent specialization templates
\`\`\`

## Thread Types

| Thread | Pattern | Use Case |
|--------|---------|----------|
| **L** | Loop | Single agent iterating PRD stories |
| **P** | Parallel | Multiple agents, independent stories |
| **C** | Chain | Sequential phases with human checkpoints |
| **F** | Fusion | Same problem, multiple perspectives |
| **B** | Big | Orchestrator spawning specialist agents |

## Critical Rules

### Development
- ALWAYS run tests after changes
- Commit format: \`feat|fix|test|docs(module): description\`

### PRD Management
- NEVER modify prd.json structure without updating ralph-claude.sh parser
- Stories marked \`passes: true\` should NOT be modified

### Progress Tracking
- ALWAYS append to progress.txt, never replace
- Log git commit hashes when completing stories

### Git Workflow
- **NEVER push directly to \`main\`** — main is production
- **NEVER push directly to \`develop\`** — develop is staging
- All changes go in a branch: \`feature/*\`, \`fix/*\`, or \`agent/*\`
- PRs always target **\`develop\`** (staging), NEVER main
- PRs require **team approval** — never auto-approve
- Branch naming: \`feature/[name]\`, \`fix/[name]\`, \`agent/[name]\`
- Flow: \`feature/* -> PR -> develop (staging) -> PR -> main (production)\`

### Ralph Loop
- Stop signal: \`<promise>COMPLETE</promise>\` in agent output
- Progress file must exist for loop continuity
- Max iterations configurable in .ralph.json (default: 10)
SETUP_EOF_CLAUDEMD

echo ""

# ═══════════════════════════════════════════════════════════════
# Step 12: Permissions + Verification
# ═══════════════════════════════════════════════════════════════

echo -e "${BLUE}Step 12/12: Setting permissions and verifying...${NC}"

if [[ "$DRY_RUN" != "true" ]]; then
    # Make all bash scripts executable
    SCRIPTS=(
        "ralph/ralph-tac.sh"
        "ralph/ralph-claude.sh"
        "ralph/scripts/common.sh"
        "ralph/scripts/p-thread.sh"
        "ralph/scripts/f-thread.sh"
        "ralph/scripts/ralph-go.sh"
        "ralph/scripts/observe.sh"
        "ralph/scripts/parse-prd-json.py"
        ".claude/hooks/ralph_stop.py"
        ".claude/hooks/log_action.py"
        ".claude/hooks/validate_work.py"
    )

    for script in "${SCRIPTS[@]}"; do
        if [[ -f "$script" ]]; then
            chmod +x "$script"
            echo -e "  ${GREEN}[OK]${NC} chmod +x $script"
        fi
    done

    echo ""

    # Verification
    echo -e "${BLUE}Verification:${NC}"
    echo ""

    ERRORS=0

    # Check critical files exist
    CRITICAL_FILES=(
        "ralph/ralph-tac.sh"
        "ralph/ralph-claude.sh"
        "ralph/scripts/common.sh"
        "ralph/scripts/p-thread.sh"
        "ralph/scripts/ralph-go.sh"
        "ralph/scripts/parse-prd-json.py"
        "ralph/prompts/l-thread.md"
        "ralph/prompts/p-thread-orchestrator.md"
        "ralph/prompts/b-thread-orchestrator.md"
        "ralph/prompts/planning.md"
        "ralph/prompts/implementation.md"
        "ralph/prompts/testing.md"
        "ralph/prompts/documentation.md"
        "ralph/metaprompts/builder-template.md"
        "ralph/metaprompts/validator-template.md"
        "ralph/metaprompts/prd-to-tasks.md"
        ".claude/hooks/ralph_stop.py"
        ".claude/hooks/log_action.py"
        ".claude/hooks/validate_work.py"
        ".claude/settings.json"
        ".claude/commands/go.md"
        ".claude/commands/plan.md"
        ".claude/commands/setup.md"
        ".claude/commands/ux.md"
        ".claude/agent-templates/backend-agent.md"
        ".claude/agent-templates/frontend-agent.md"
        ".claude/agent-templates/testing-agent.md"
        ".ralph.json"
        "justfile"
        "mprocs.yaml"
        "CLAUDE.md"
        "ralph/progress.txt"
    )

    for f in "${CRITICAL_FILES[@]}"; do
        if [[ -f "$f" ]]; then
            echo -e "  ${GREEN}✓${NC} $f"
        else
            echo -e "  ${RED}✗${NC} $f — MISSING"
            ((ERRORS++))
        fi
    done

    echo ""

    # Check scripts are executable
    for script in "${SCRIPTS[@]}"; do
        if [[ -f "$script" && -x "$script" ]]; then
            echo -e "  ${GREEN}✓${NC} $script is executable"
        elif [[ -f "$script" ]]; then
            echo -e "  ${RED}✗${NC} $script is NOT executable"
            ((ERRORS++))
        fi
    done

    echo ""

    # Check bash syntax
    BASH_SCRIPTS=(
        "ralph/ralph-tac.sh"
        "ralph/ralph-claude.sh"
        "ralph/scripts/common.sh"
        "ralph/scripts/p-thread.sh"
        "ralph/scripts/f-thread.sh"
        "ralph/scripts/ralph-go.sh"
        "ralph/scripts/observe.sh"
    )

    echo -e "${BLUE}Syntax check:${NC}"
    for script in "${BASH_SCRIPTS[@]}"; do
        if [[ -f "$script" ]]; then
            if bash -n "$script" 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} $script — syntax OK"
            else
                echo -e "  ${RED}✗${NC} $script — SYNTAX ERROR"
                ((ERRORS++))
            fi
        fi
    done

    echo ""

    # Python syntax check
    PYTHON_SCRIPTS=(
        "ralph/scripts/parse-prd-json.py"
        ".claude/hooks/ralph_stop.py"
        ".claude/hooks/log_action.py"
        ".claude/hooks/validate_work.py"
    )

    for script in "${PYTHON_SCRIPTS[@]}"; do
        if [[ -f "$script" ]]; then
            if python3 -m py_compile "$script" 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} $script — syntax OK"
            else
                echo -e "  ${RED}✗${NC} $script — SYNTAX ERROR"
                ((ERRORS++))
            fi
        fi
    done

    echo ""

    # Check external tools
    echo -e "${BLUE}External tools:${NC}"
    for tool in just jq mprocs claude python3; do
        if command -v "$tool" &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} $tool found"
        else
            echo -e "  ${YELLOW}!${NC} $tool not found (install before using)"
        fi
    done

    echo ""

    # Summary
    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  Ralph TAC infrastructure created successfully!              ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "  ${CYAN}Next step:${NC}"
        echo ""
        echo "  Open Claude Code and run /setup to configure your project:"
        echo ""
        echo "    claude"
        echo "    # inside Claude: /setup"
        echo ""
        echo "  This will detect your stack, ask a few questions, and fill in"
        echo "  all ADAPT: markers automatically."
    else
        echo -e "${RED}Setup completed with $ERRORS error(s). Review above.${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}DRY RUN complete. No files were created.${NC}"
    echo "Run without --dry-run to create all files."
fi
