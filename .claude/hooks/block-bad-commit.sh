#!/usr/bin/env bash
# PreToolUse hook, filtered to Bash(git commit:*): block the commit if the repo's
# correctness gates (bun run check/lint) are currently failing. Complements
# check-before-stop.sh, which only warns after the fact.
check_out=$(bun run check 2>&1)
check_status=$?
lint_out=$(bun run lint 2>&1)
lint_status=$?

if [ $check_status -ne 0 ] || [ $lint_status -ne 0 ]; then
  msg="Commit blocked: bun run check/lint found issues."
  if [ $check_status -ne 0 ]; then
    msg="$msg

check (bun run check):
$(printf '%s' "$check_out" | tail -n 40)"
  fi
  if [ $lint_status -ne 0 ]; then
    msg="$msg

lint (bun run lint):
$(printf '%s' "$lint_out" | tail -n 40)"
  fi
  jq -n --arg msg "$msg" '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": $msg}}'
else
  echo '{}'
fi
