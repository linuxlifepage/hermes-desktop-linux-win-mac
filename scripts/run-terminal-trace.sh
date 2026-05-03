#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${1:-"$ROOT_DIR/dist/HermesDesktop.app"}"
TRACE_DIR="${HERMES_TERMINAL_TRACE_DIR:-/tmp/hermes-terminal-traces}"
EXECUTABLE="$APP_PATH/Contents/MacOS/HermesDesktop"

if [[ ! -x "$EXECUTABLE" ]]; then
    echo "Hermes Desktop executable not found at: $EXECUTABLE" >&2
    echo "Run scripts/package-github-release.sh first, or pass a .app path." >&2
    exit 1
fi

mkdir -p "$TRACE_DIR"

echo "Launching Hermes Desktop with terminal tracing enabled."
echo "Trace root: $TRACE_DIR"
echo "Quit Hermes Desktop to end this traced run."

HERMES_TERMINAL_TRACE_DIR="$TRACE_DIR" "$EXECUTABLE"
