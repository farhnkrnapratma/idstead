#!/usr/bin/env bash
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  echo '{}'
  exit 0
fi

out=$(bun run check 2>&1)
status=$?

if [ $status -ne 0 ]; then
  msg="bun run check found issues:

$(printf '%s' "$out" | tail -n 60)"
  jq -n --arg msg "$msg" '{"systemMessage": $msg}'
else
  echo '{}'
fi
