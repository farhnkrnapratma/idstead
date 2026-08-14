#!/usr/bin/env bash
# PreToolUse hook for Edit|Write: block direct edits to bun.lock (must go
# through `bun install`/`bun add`) and .env (holds live secrets; edit
# .env.example instead, or set values outside Claude Code).
jq -r '.tool_input.file_path // empty' | {
  read -r f
  [ -z "$f" ] && { echo '{}'; exit 0; }
  base=$(basename "$f")
  if [ "$base" = "bun.lock" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"bun.lock must only change via `bun install`/`bun add`, never a direct edit."}}'
  elif [ "$base" = ".env" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":".env holds live secrets (Supabase service-role key, R2, Sentry, Turnstile). Edit .env.example for structure, or set real values outside Claude Code."}}'
  else
    echo '{}'
  fi
}
