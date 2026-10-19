# Scripts and Tooling

## `scripts/`: operational commands

Every script defaults to a **dry run**, and every one acts on the database chosen by the Phase environment. Read the dry-run output before you apply anything to Production.

| Script | Usage | What it does |
| --- | --- | --- |
| `migrate-markdown-syntax.ts` | `bun scripts/migrate-markdown-syntax.ts [dry-run\|apply\|verify] [--dir=PATH] [--show=SLUG_OR_PATH] [--origin=https://production-origin]` | Converts stored post and legal Markdown from the legacy syntax to the current one, using `packages/mdrs/src/legacy.ts`. Working files and `manifest.json` go to `--dir` (default `.local/markdown-syntax-migration`). `apply` requires `--origin`. `verify` re-checks a finished migration. |
| `regenerate-post-slugs.ts` | `bun scripts/regenerate-post-slugs.ts [dry-run\|apply]` | Recomputes post slugs with the current slug rules. Needs `PUBLIC_SUPABASE_URL` and the service-role key. |
| `migrate-cdn-layout.ts` | `bun scripts/migrate-cdn-layout.ts [dry-run\|apply]` | Moves the active CV from the bucket root into `cv/` with a versioned filename and its checksum files, updates `db_documents`, and deletes obsolete root PDFs and `blog/content/` or `blog/banners/` objects of deleted posts. It runs outside Workers, so it talks to R2 through the S3 API (`@aws-sdk/client-s3`, a root devDependency) and needs `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, plus `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `PUBLIC_CDN_BASE_URL`. |

Run them through Phase so they get their variables:

```sh
phase run --env dev bun scripts/regenerate-post-slugs.ts            # dry run
phase run --env prod bun scripts/regenerate-post-slugs.ts apply     # real run
```

## `tooling/`

| Path | Purpose |
| --- | --- |
| `tooling/git-hooks/pre-commit` | Runs TruffleHog (`--results=verified --fail`) on staged files and **blocks** the commit on a verified secret. If `trufflehog` is not installed it prints a warning and lets the commit through. |
| `tooling/git-hooks/commit-msg` | Runs `bunx --no-install commitlint --edit` on the commit message and **blocks** a message that breaks the Conventional Commits rules in `commitlint.config.ts`. |
| `tooling/git-hooks/install.sh` | Copies `pre-commit` and `commit-msg` into `.git/hooks/`. The root `prepare` script runs it during `bun install`. |
| `tooling/lib-usage.ts` | Prints which apps reach each file in `packages/lib/src`, directly or through other lib files, grouped as `web-only`, `admin-only`, `shared: …`, `only tests` or `unused`. Named imports from the `index.ts` barrel count toward the file that defines them. Run `bun tooling/lib-usage.ts` (`--json` for machine-readable output) before moving lib code into a package or an app. |
| `tooling/vite/webp-wasm-plugin.ts` | Vite plugin that provides `virtual:banner-webp-wasm`, the WebP decoder WASM used by server-side banner and content-image validation. It is inlined as base64 or imported as a module, depending on the build. |

## Import boundaries

`eslint.config.ts` enforces these import boundaries with `@typescript-eslint/no-restricted-imports` (type-only imports stay allowed):

- **Browser code never imports server modules.** `.svelte` and `.svelte.ts` files, plus `packages/lib/src/{components,layout,article,stores,utils}`, fail lint when they import a path containing `server/` (`#lib/server/*`, `$lib/server/*`, `../server/*`).
- **The MDRS engine is standalone.** Files under `packages/mdrs/` fail lint when they import `@supabase/*`, `#lib`, `@fkp/*`, `$app/*`, `$lib` or `svelte`. Live data reaches the engine through injected resolvers (`createMdrsResolvers` in `packages/lib/src/mdrsResolvers.ts`).
- **The design system depends only on the domain.** Files under `packages/ui/` fail lint when they import `#lib`, `@fkp/lib`, `@fkp/mdrs`, `@supabase/*` or a `server/` path.
- **The MDRS browser layer and the editor stay out of lib.** Files under `packages/mdrs-ui/` may import only `@fkp/ui`, `@fkp/domain` and `@fkp/mdrs`; files under `packages/editor/` must not import `#lib`, `@fkp/lib`, `@supabase/*` or a `server/` path.
- **The domain is pure.** Files under `packages/domain/` fail lint when they import `#lib`, any `@fkp/*` package, `$app/*`, `$lib`, `svelte` or `@supabase/*`.

## Claude Code hooks (`.claude/`)

`.claude/settings.json` wires these hooks:

- `.claude/hooks/block-bad-commit.sh` runs before every `git commit` issued by an agent:
    - It refuses commits on `main`.
    - It runs `bunx prettier --check` on the files to be committed (staged files, plus modified tracked files with `-a`/`--all`) and blocks the commit if any is unformatted. It never rewrites files; format them with `bunx prettier --write <files>`, re-add them and retry.
    - It runs `bunx eslint` on the `.ts`, `.js`, `.mjs`, `.cjs` and `.svelte` files among them, then `bun run check`, and blocks the commit if either fails.
- `.claude/hooks/check-before-stop.sh` runs when the agent stops. It runs `bun run fmt:check` and `bun run check` in parallel and, if both pass, `bunx eslint .`, then reports any failure back to the agent as a system message. It does not block.
- Commit messages follow Conventional Commits, enforced by commitlint through the `commit-msg` hook above. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
