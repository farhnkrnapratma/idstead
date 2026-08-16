#!/usr/bin/env bash
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
base=$(basename -- "$f")

case "$base" in
  CLAUDE.md) src="$f"; dst="$(dirname -- "$f")/AGENTS.md"; direction=to_agents ;;
  AGENTS.md) src="$f"; dst="$(dirname -- "$f")/CLAUDE.md"; direction=to_claude ;;
  *) exit 0 ;;
esac

[ -f "$src" ] || exit 0

if [ "$direction" = to_agents ]; then
  translated=$(sed \
    -e '1,5s/^# CLAUDE\.md$/# Repository Guidelines/' \
    -e 's/This file provides guidance to Claude Code (claude\.ai\/code) when/This file provides guidance to Codex CLI, Claude Code, Antigravity, and other AI coding agents when/' \
    -e 's/^Claude Code can use the Svelte MCP server,/The agent can use the Svelte MCP server,/' \
    "$src")
else
  translated=$(sed \
    -e '1,5s/^# Repository Guidelines$/# CLAUDE.md/' \
    -e 's/This file provides guidance to Codex CLI, Claude Code, Antigravity, and other AI coding agents when/This file provides guidance to Claude Code (claude.ai\/code) when/' \
    -e 's/^The agent can use the Svelte MCP server,/Claude Code can use the Svelte MCP server,/' \
    "$src")
fi

current=$(cat "$dst" 2>/dev/null || true)

if [ "$translated" != "$current" ]; then
  printf '%s\n' "$translated" >"$dst"
  jq -n --arg dst "$(basename -- "$dst")" --arg src "$base" \
    '{"systemMessage": ("Synced " + $dst + " from " + $src + ".")}'
fi
