#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: format the touched file with this repo's prettier config.
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$f" ] && exit 0
bunx prettier --write "$f" 2>/dev/null || true
