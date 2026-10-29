# Contributing

Read [docs/](docs/README.md) for the architecture and setup, and [CLAUDE.md](CLAUDE.md) for code conventions. Set up locally with [docs/005-development/001-local-setup.md](docs/005-development/001-local-setup.md).

## Branches

This repo uses [git-flow-next](https://git-flow.sh/) with the classic preset. The config lives in `.git/config`. On a fresh clone, run:

```sh
git-flow init --preset=classic --defaults --main main
```

| Branch | From | Merges into | Notes |
| --- | --- | --- | --- |
| `main` | – | – | Production. Every push deploys every Worker. Never commit to it directly. |
| `develop` | `main` | – | Integration branch |
| `feature/<name>`, `bugfix/<name>` | `develop` | `develop` | `git-flow feature start <name>` / `finish` |
| `release/<name>` | `develop` | `main` (tagged) and `develop` |  |
| `hotfix/<name>` | `main` | `main` (tagged) and `develop` |  |

## Commits

- **Sign off** every commit with `git commit -s`, including git-flow finish operations.
- **Message format:** [Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint (`@commitlint/config-conventional`). Validate a message before committing:

    ```sh
    printf '%s' "docs: add v1 API reference" | bunx commitlint
    ```

## Before you push

There is no CI pipeline. These local runs are the only gate before Workers Builds deploys:

```sh
bun run test
bun run check
bun run lint
```

## Rules of thumb

- Use `bun`/`bunx` only.
- **No comments in code.** Prefer clear names.
- **Prefer Tailwind utilities** over hand-written CSS.
- **Reuse the shared components** in `packages/lib`.
- Never hardcode content (name, bio, links, resume, …). It comes from Supabase.
- **API changes:**
    - Breaking changes go under a new version (`/v2`).
    - Update `packages/lib/src/openapi.ts`, `apps/api/src/README.md` and `docs/004-api/001-v1/` together.
- **Database:** every `UPDATE`/`DELETE` in a function needs a `WHERE` clause.
- **Docs:** when behaviour changes, update the matching page in `docs/`.

## Security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
