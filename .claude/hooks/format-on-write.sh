#!/usr/bin/env bash
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$f" ] && exit 0
bunx biome format --write --no-errors-on-unmatched --files-ignore-unknown=true "$f" >/dev/null 2>&1 || true
