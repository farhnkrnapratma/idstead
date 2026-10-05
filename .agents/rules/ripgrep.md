---
trigger: always_on
description: Always use ripgrep (rg) instead of grep for code search and pattern matching.
---

## ripgrep (rg)

Always use `ripgrep` (`rg`) instead of standard `grep` for searching patterns, text, and regex across the codebase.

Rules:

- Use `rg` for all text, symbol, and pattern searches in the workspace. Never use `grep`, `egrep`, or `fgrep`.
- Leverage `rg` flags for speed and accuracy:
  - `-g` / `--glob` to filter file patterns (e.g. `rg "pattern" -g "*.svelte"`)
  - `-i` / `-S` for case-insensitive / smart-case searching
  - `-l` / `--files-with-matches` to only list matching files
  - `-C <N>` / `-A <N>` / `-B <N>` for context lines
  - `-F` / `--fixed-strings` for literal string matches
- Respect `.gitignore` and default ignore rules automatically provided by `rg`.
