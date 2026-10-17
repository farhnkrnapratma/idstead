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

existing=()
for f in "${files[@]}"; do
  [ -n "$f" ] && [ -f "$f" ] && existing+=("$f")
done
mapfile -t existing < <(printf '%s\n' "${existing[@]}" | sort -u | sed '/^$/d')

if [ "${#existing[@]}" -eq 0 ]; then
  echo '{}'
  exit 0
fi

fmt_out=$(bunx prettier --check --ignore-unknown "${existing[@]}" 2>&1)
if [ $? -ne 0 ]; then
  unformatted=$(printf '%s\n' "$fmt_out" | sed -n 's/^\[warn\] //p' | sed '/Code style issues/d')
  deny "Commit blocked: these files to be committed are not Prettier-formatted:
${unformatted:-$fmt_out}

Format only these files with \`bunx prettier --write <files>\`, \`git add\` them, and retry. The hook does not rewrite files itself."
fi

lintable=()
for f in "${existing[@]}"; do
  case "$f" in
    *.ts | *.js | *.mjs | *.cjs | *.svelte) lintable+=("$f") ;;
  esac
done

lint_status=0
lint_out=''
if [ "${#lintable[@]}" -gt 0 ]; then
  lint_out=$(bunx eslint "${lintable[@]}" 2>&1)
  lint_status=$?
fi

check_out=$(bun run check 2>&1)
check_status=$?

if [ $check_status -ne 0 ] || [ $lint_status -ne 0 ]; then
  msg="Commit blocked: check/lint found issues."
  if [ $check_status -ne 0 ]; then
    msg="$msg

check (bun run check):
$(printf '%s' "$check_out" | tail -n 40)"
  fi
  if [ $lint_status -ne 0 ]; then
    msg="$msg

lint (eslint on files to be committed):
$(printf '%s' "$lint_out" | tail -n 40)"
  fi
  deny "$msg"
fi

echo '{}'
