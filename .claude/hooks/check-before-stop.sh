#!/usr/bin/env bash
out=$(bun run --parallel --no-exit-on-error format check lint 2>&1)
status=$?

if [ $status -ne 0 ]; then
  msg="bun run --parallel format/check/lint found issues:

$(printf '%s' "$out" | tail -n 60)"
  jq -n --arg msg "$msg" '{"systemMessage": $msg}'
else
  echo '{}'
fi
