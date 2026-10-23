# Scripts and Tooling

## One-off scripts

The one-off migration and archive scripts (`migrate-markdown-syntax.ts`, `regenerate-post-slugs.ts`, `migrate-cdn-layout.ts`, `export-site-data.ts`) were removed after the move to D1 on 2026-10-23; they are in the git history. The admin portal's **Export all data** produces the archive zip, including `administration/subscribers.json`.

## `tooling/`

| Path | Purpose |
| --- | --- |
| `tooling/git-hooks/pre-commit` | Runs TruffleHog (`--results=verified --fail`) on staged files and **blocks** the commit on a verified secret. If `trufflehog` is not installed it prints a warning and lets the commit through. |
| `tooling/git-hooks/commit-msg` | Runs `bunx --no-install commitlint --edit` on the commit message and **blocks** a message that breaks the Conventional Commits rules in `commitlint.config.ts`. |
| `tooling/git-hooks/install.sh` | Copies `pre-commit` and `commit-msg` into `.git/hooks/`. The root `prepare` script runs it during `bun install`. |
| `tooling/lib-usage.ts` | Prints which apps reach each file in `packages/lib/src`, directly or through other lib files, grouped as `web-only`, `admin-only`, `shared: …`, `only tests` or `unused`. Named imports from the `index.ts` barrel count toward the file that defines them. Run `bun tooling/lib-usage.ts` (`--json` for machine-readable output) before moving lib code into a package or an app. |
| `tooling/configure.ts` | `bun run configure` renders each `apps/*/wrangler.jsonc` from its `wrangler.template.jsonc` and `idstead.jsonc`; `--check` (part of `bun run check`) fails when a rendered file is out of date. See [instance configuration](../002-configuration/001-instance.md). |
| `tooling/setup.ts`, `tooling/setup/plan.ts` | `bun run setup [dry-run\|apply]` sets up an instance; the pure planning helpers in `plan.ts` are covered by `tests/setupPlan.test.ts`. See [the setup script](../001-getting-started/001-setup-script.md). |
| `tooling/vite/webp-wasm-plugin.ts` | Vite plugin that provides `virtual:banner-webp-wasm`, the WebP decoder WASM used by server-side banner and content-image validation. It is inlined as base64 or imported as a module, depending on the build. |

## Import boundaries

`eslint.config.ts` enforces these import boundaries with `@typescript-eslint/no-restricted-imports` (type-only imports stay allowed):

- **Browser code never imports server modules.** `.svelte` and `.svelte.ts` files, plus `packages/lib/src/{components,layout,article,stores,utils}`, fail lint when they import a path containing `server/` (`#lib/server/*`, `$lib/server/*`, `../server/*`).
- **The MDRS engine is standalone.** Files under `packages/mdrs/core/` fail lint when they import `@supabase/*`, `#lib`, `@idstead/*`, `$app/*`, `$lib` or `svelte`. Live data reaches the engine through injected resolvers (`mdrsResolvers` in `packages/lib/src/server/mdrsData.ts` on the server, `createMdrsResolvers` in `packages/lib/src/mdrsResolvers.ts` for the admin preview).
- **The design system depends only on the domain.** Files under `packages/ui/` fail lint when they import `#lib`, `@idstead/lib`, `@mdrs/core`, `@supabase/*` or a `server/` path.
- **The MDRS browser layer and the editor stay out of lib.** Files under `packages/mdrs/dom/` may import only `@idstead/ui`, `@idstead/domain` and `@mdrs/core`; files under `packages/mdrs/editor/` must not import `#lib`, `@idstead/lib`, `@supabase/*` or a `server/` path.
- **The domain is pure.** Files under `packages/domain/` fail lint when they import `#lib`, any `@idstead/*` package, `$app/*`, `$lib`, `svelte` or `@supabase/*`.
- **The data layer is D1 only.** Files under `packages/data/` may import only `@idstead/domain`, and only `packages/lib/src/server/data.ts` may import its adapter factories (`createD1*`); everything else builds stores with `dataStores()`.
- **Supabase is the auth provider only.** `@supabase/*` may be imported only by the auth modules: `packages/lib/src/supabase.ts`, `packages/lib/src/server/{supabaseAuth,supabaseAdmin,supabaseUser,adminAuth,blogPostAuth}.ts` and the admin account settings (core `no-restricted-imports`, so type imports count too).

## Claude Code hooks (`.claude/`)

`.claude/settings.json` wires these hooks:

- `.claude/hooks/block-bad-commit.sh` runs before every `git commit` issued by an agent:
    - It refuses commits on `main`.
    - It runs `bunx prettier --check` on the files to be committed (staged files, plus modified tracked files with `-a`/`--all`) and blocks the commit if any is unformatted. It never rewrites files; format them with `bunx prettier --write <files>`, re-add them and retry.
    - It runs `bunx eslint` on the `.ts`, `.js`, `.mjs`, `.cjs` and `.svelte` files among them, then `bun run check`, and blocks the commit if either fails.
- `.claude/hooks/check-before-stop.sh` runs when the agent stops. It runs `bun run fmt:check` and `bun run check` in parallel and, if both pass, `bunx eslint .`, then reports any failure back to the agent as a system message. It does not block.
- Commit messages follow Conventional Commits, enforced by commitlint through the `commit-msg` hook above. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
