#!/usr/bin/env bash
# Stop hook: format, then run the repo's type-check and lint gates and
# surface failures as a systemMessage so issues introduced this session
# aren't left silently broken. format runs first (not just lint's
# prettier --check) so formatting drift gets fixed in place instead of
# just reported, leaving lint to catch only real issues. Informational
# only (never blocks) to avoid a Stop-hook loop.
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
