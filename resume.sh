#!/usr/bin/env bash
# resume.sh — find the latest handoff file and launch aider with it pre-loaded

AIDER="$HOME/.local/bin/aider"
export OLLAMA_API_BASE="http://localhost:11434"
PROJECT_DIR="${1:-$(pwd)}"

cd "$PROJECT_DIR"

HANDOFF=$(ls -t handoff-*.txt 2>/dev/null | head -1)

if [ -z "$HANDOFF" ]; then
  echo "No handoff file found. Starting fresh aider session..."
  "$AIDER" --no-pretty --no-show-release-notes
else
  echo "Resuming from: $HANDOFF"
  echo "---"
  cat "$HANDOFF"
  echo "---"
  "$AIDER" --no-pretty --no-show-release-notes --message "$(cat "$HANDOFF")"
fi
