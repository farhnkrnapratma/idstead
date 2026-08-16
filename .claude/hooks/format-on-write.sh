#!/usr/bin/env bash
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$f" ] && exit 0
bunx prettier --write "$f" 2>/dev/null || true
