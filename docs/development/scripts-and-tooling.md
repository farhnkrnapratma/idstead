# Scripts and Tooling

## `scripts/`: operational commands

Every script defaults to a **dry run**, and every one acts on the database chosen by the Phase environment. Read the dry-run output before you apply anything to Production.

| Script | Usage | What it does |
| --- | --- | --- |
| `migrate-markdown-syntax.ts` | `bun scripts/migrate-markdown-syntax.ts [dry-run\|apply\|verify] [--dir=PATH] [--show=SLUG_OR_PATH] [--origin=https://production-origin]` | Converts stored post and legal Markdown from the legacy syntax to the current one, using `packages/lib/src/legacyMarkdown.ts`. Working files and `manifest.json` go to `--dir` (default `.local/markdown-syntax-migration`). `apply` requires `--origin`. `verify` re-checks a finished migration. |
| `regenerate-post-slugs.ts` | `bun scripts/regenerate-post-slugs.ts [dry-run\|apply]` | Recomputes post slugs with the current slug rules. Needs `PUBLIC_SUPABASE_URL` and the service-role key. |
| `backfill-image-formats.ts` | `bun scripts/backfill-image-formats.ts [--apply]` | Fetches existing WebP/PNG blog banners and avatars from R2, encodes AVIF variants, uploads them, and updates the database. Needs Supabase service-role and `R2_*` credentials. |

Run them through Phase so they get their variables:

```sh
phase run --env dev bun scripts/regenerate-post-slugs.ts            # dry run
phase run --env prod bun scripts/regenerate-post-slugs.ts apply     # real run
```

## `tooling/`

| Path | Purpose |
| --- | --- |
| `tooling/git-hooks/pre-commit` | Runs TruffleHog (`--results=verified --fail`) on staged files and **blocks** the commit on a verified secret. If `trufflehog` is not installed it prints a warning and lets the commit through. |
| `tooling/git-hooks/install.sh` | Copies the hook into `.git/hooks/pre-commit`. The root `prepare` script runs it during `bun install`. |
| `tooling/vite/webp-wasm-plugin.ts` | Vite plugin that provides `virtual:banner-webp-wasm`, the WebP decoder WASM used by server-side banner and content-image validation. It is inlined as base64 or imported as a module, depending on the build. |

## Claude Code hooks (`.claude/`)

- `.claude/hooks/block-bad-commit.sh` runs on `git commit` issued by an agent:
    - It refuses commits on `main`.
    - It runs `bun run fmt` and refuses the commit if that rewrote staged files that were not re-added.
    - It then runs `bun run check` and `bun run lint` and blocks the commit on failure.
- Commit messages follow Conventional Commits, enforced by commitlint. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
