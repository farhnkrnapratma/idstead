#!/usr/bin/env bash
cmd=$(jq -r '.tool_input.command // empty')

commit_re='(^|[;&|(]|[[:space:]])git([[:space:]]+-[cC][[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)'
if [[ ! "$cmd" =~ $commit_re ]]; then
  echo '{}'
  exit 0
fi

deny() {
  jq -n --arg msg "$1" '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": $msg}}'
  exit 0
}

branch=$(git branch --show-current 2>/dev/null)
if [ "$branch" = "main" ]; then
  deny "Direct commits to main are not allowed - this repo uses git-flow-next (see CLAUDE.md); main only receives merges from release/* or hotfix/* branches. Commit to develop/feature/bugfix instead, or use git-flow release/hotfix start."
fi

mapfile -t files < <(git diff --cached --name-only --diff-filter=ACMR)
all_re='[[:space:]](-[a-zA-Z]*a[a-zA-Z]*|--all)([[:space:]]|$)'
if [[ "$cmd" =~ $all_re ]]; then
  mapfile -t -O "${#files[@]}" files < <(git diff --name-only --diff-filter=ACMR)
fi

forbidden=$(printf '%s\n' "${files[@]}" | grep -E '(^|/)(AGENTS\.md|GEMINI\.md|CONVENTIONS\.md|openai\.yaml|copilot-instructions\.md|\.cursorrules|\.windsurfrules|\.clinerules|\.aider[^/]*|\.(codex|copilot|cursor|windsurf|roo|kiro|amazonq|junie|trae|augment|gemini|opencode|continue|devin|qwen|cline)|\.tessl[^/]*|\.(claude|agents)/skills/[^/]+/\.github)(/|$)' || true)
if [ -n "$forbidden" ]; then
  deny "Commit blocked: other AI agent config is staged; keep only .agents/ and .claude/: ${forbidden//$'\n'/, }"
fi

existing=()
for f in "${files[@]}"; do
  [ -n "$f" ] && [ -f "$f" ] && existing+=("$f")
done
mapfile -t existing < <(printf '%s\n' "${existing[@]}" | sort -u | sed '/^$/d')

if [ "${#existing[@]}" -eq 0 ]; then
  echo '{}'
  exit 0
fi

biome_out=$(bunx biome check --no-errors-on-unmatched --files-ignore-unknown=true "${existing[@]}" 2>&1)
biome_status=$?

check_out=$(bun run typecheck 2>&1)
check_status=$?

if [ $biome_status -ne 0 ] || [ $check_status -ne 0 ]; then
  msg="Commit blocked: Biome or typecheck found issues."
  if [ $biome_status -ne 0 ]; then
    msg="$msg

biome check (files to be committed):
$(printf '%s' "$biome_out" | tail -n 40)

Fix formatting with \`bunx biome check --write <files>\`, \`git add\` them, and retry. The hook does not rewrite files itself."
  fi
  if [ $check_status -ne 0 ]; then
    msg="$msg

typecheck (bun run typecheck):
$(printf '%s' "$check_out" | tail -n 40)"
  fi
  deny "$msg"
fi

echo '{}'
