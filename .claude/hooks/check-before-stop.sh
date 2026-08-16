#!/usr/bin/env bash
bun run format >/dev/null 2>&1
check_out=$(bun run check 2>&1)
check_status=$?
lint_out=$(bun run lint 2>&1)
lint_status=$?

if [ $check_status -ne 0 ] || [ $lint_status -ne 0 ]; then
  msg="bun run check/lint found issues:"
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
  jq -n --arg msg "$msg" '{"systemMessage": $msg}'
else
  echo '{}'
fi
