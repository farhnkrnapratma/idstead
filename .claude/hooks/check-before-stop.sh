#!/usr/bin/env bash
out=$({ bun run --parallel --no-exit-on-error fmt:check check && bunx eslint .; } 2>&1)
status=$?

if [ $status -ne 0 ]; then
  msg="fmt:check, check or eslint found issues:

$(printf '%s' "$out" | tail -n 60)"
  jq -n --arg msg "$msg" '{"systemMessage": $msg}'
else
  echo '{}'
fi
