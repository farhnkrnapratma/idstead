#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
src="$repo_root/scripts/git-hooks/pre-commit"
dest="$repo_root/.git/hooks/pre-commit"

[ -f "$src" ] || exit 0

cp "$src" "$dest"
chmod +x "$dest"
