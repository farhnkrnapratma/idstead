#!/usr/bin/env bash
jq -r '.tool_input.file_path // empty' | {
  read -r f
  [ -z "$f" ] && { echo '{}'; exit 0; }
  base=$(basename "$f")
  deny() {
    jq -n --arg reason "$1" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
    exit 0
  }
  case "$base" in
    bun.lock) deny "bun.lock must only change through bun install, bun add or bun remove, never a direct edit." ;;
    .env.example) ;;
    .env | .env.* | .dev.vars | .dev.vars.*) deny "$base would hold secrets. This repo takes them from Phase (see .claude/rules/phase.md): edit .env.example for the list of keys, and ask the user to set values with phase secrets." ;;
  esac
  echo '{}'
}
