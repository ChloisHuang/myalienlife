#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
GAME_URL='http://127.0.0.1:5173'
LOG_FILE="$SCRIPT_DIR/game-server.log"
ERROR_LOG_FILE="$SCRIPT_DIR/game-server-error.log"

cd "$SCRIPT_DIR"

game_is_ready() {
    local page
    page="$(curl --fail --silent --show-error --max-time 2 "$GAME_URL" 2>/dev/null)" || return 1
    [[ "$page" == *'Orbit Life'* ]]
}

if game_is_ready; then
    open "$GAME_URL"
    exit 0
fi

if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
    print -u2 'Port 5173 is already used by another application.'
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    print -u2 'npm was not found. Install Node.js 20.19+ or 22.12+ and try again.'
    exit 1
fi

if [[ ! -f "$SCRIPT_DIR/node_modules/vite/bin/vite.js" ]]; then
    npm ci
fi

nohup npm run dev -- --port 5173 --strictPort >"$LOG_FILE" 2>"$ERROR_LOG_FILE" &
server_pid=$!

for attempt in {1..40}; do
    if game_is_ready; then
        open "$GAME_URL"
        exit 0
    fi
    if ! kill -0 "$server_pid" 2>/dev/null; then
        print -u2 "Game did not start. Check $ERROR_LOG_FILE."
        exit 1
    fi
    sleep 0.25
done

print -u2 "Game did not start within 10 seconds. Check $ERROR_LOG_FILE."
exit 1
