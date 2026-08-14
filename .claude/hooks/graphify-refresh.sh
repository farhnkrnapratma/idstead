#!/usr/bin/env bash
# Stop hook: refresh the graphify code graph once at the end of the session
# so it doesn't go stale between sessions (CLAUDE.md documents `graphify
# update .` as a manual post-edit step, easy to forget). Backgrounded and
# best-effort - never blocks Stop, and only runs once per session instead of
# once per edit (would be wasteful/racy as a PostToolUse hook on a repo this
# size).
command -v graphify >/dev/null 2>&1 && (graphify update . >/dev/null 2>&1 &)
echo '{}'
