#!/usr/bin/env bash
# PreToolUse hook for Edit|Write: ask for confirmation before editing files
# that control the production deploy (Cloudflare bindings, CI gates, security
# headers) - a wrong edit here breaks the deploy or the CI safety net in ways
# `bun run check`/`lint` won't catch. Unlike block-sensitive-file-edits.sh
# (bun.lock/.env - never hand-edit), these are legitimately edited sometimes,
# so this asks rather than denies outright.
jq -r '.tool_input.file_path // empty' | {
  read -r f
  [ -z "$f" ] && { echo '{}'; exit 0; }
  base=$(basename "$f")
  reason=""
  if [ "$base" = "wrangler.jsonc" ]; then
    reason="wrangler.jsonc controls Cloudflare bindings/config for the live deploy - confirm this edit is intentional."
  elif [ "$base" = "_headers" ]; then
    reason="_headers sets production security/caching headers - confirm this edit is intentional."
  elif printf '%s' "$f" | grep -qE '(^|/)\.github/workflows/[^/]+\.ya?ml$'; then
    reason="This edits a CI workflow (the safety net for check/lint/build) - confirm this edit is intentional."
  fi
  if [ -n "$reason" ]; then
    jq -n --arg reason "$reason" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":$reason}}'
  else
    echo '{}'
  fi
}
