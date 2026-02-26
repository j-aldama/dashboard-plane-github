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
