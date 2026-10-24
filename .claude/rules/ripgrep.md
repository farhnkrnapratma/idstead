# Search with ripgrep

Use `rg` for every text, symbol and pattern search in the shell. Never use `grep`, `egrep` or `fgrep`.

- Filter with `-g` (`rg "pattern" -g "*.svelte"`), list files with `-l`, add context with `-C`/`-A`/`-B`, match literals with `-F`, and use `-S` for smart case.
- `rg` respects `.gitignore`. Add `--hidden` to search dot-directories such as `.well-known`, `.claude` or `.github`.
- For questions about how the code fits together, run `graphify query` first (see the graphify section of `CLAUDE.md`), then `rg` for the exact lines.
