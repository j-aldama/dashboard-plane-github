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
