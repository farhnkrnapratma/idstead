#!/usr/bin/env bash
branch=$(git branch --show-current 2>/dev/null)
if [ "$branch" = "main" ]; then
  jq -n '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Direct commits to main are not allowed - this repo uses git-flow-next (see CLAUDE.md); main only receives merges from release/* or hotfix/* branches. Commit to develop/feature/bugfix instead, or use git-flow release/hotfix start."}}'
  exit 0
fi

pre_unstaged=$(git diff --name-only)
bun run fmt >/dev/null 2>&1
post_unstaged=$(git diff --name-only)
newly_dirtied=$(comm -13 <(printf '%s\n' "$pre_unstaged" | sort) <(printf '%s\n' "$post_unstaged" | sort))

if [ -n "$newly_dirtied" ]; then
  jq -n --arg files "$newly_dirtied" '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": ("bun run fmt rewrote files that are staged but weren'"'"'t re-added, so the commit would miss the formatting:\n" + $files + "\n\nRun `git add` on these and retry the commit.")}}'
  exit 0
fi

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
