Environment variables for this repo come from [Phase](https://phase.dev), not from local `.env` files. The project is linked through `.phase.json` (app `idstead`, default environment `Development`).

## Rules

- Run every command that needs env vars through `phase run`, with the environment chosen explicitly:

    ```sh
    phase run --env dev bun run dev
    phase run --env dev bun run dev:admin
    phase run --env prod bun run build
    phase run --env dev bun run --filter @idstead/api dev
    phase run --env dev bun run test
    ```

    `--env` matches partially (`dev` → `Development`, `prod` → `Production`). Use `dev` unless the task specifically needs production values.

- Do not create, copy, or read `.env`, `.env.development`, `.env.production`, or `.dev.vars` files to get secrets, and do not pass `--env-file` to wrangler. Where README or CLAUDE.md say to copy a `.env*.example` file, use `phase run` instead.
- Use `phase run` only to start processes. Never print injected values (`echo $VAR`, `printenv`, `env`), pipe them elsewhere, or write `phase secrets export` output to a file. `phase shell` is blocked in AI mode.
- To check whether a variable exists or what kind it is, use `phase secrets list` or `phase secrets get <KEY>`. A value shown as `[REDACTED]` is for the user to read in their own terminal.
- Creating, updating, or deleting secrets changes shared state: ask first. Sealed or secret values always use `--random`; when the user supplies a value, ask them to run `phase secrets create <KEY>` themselves.
- When unsure of a command or flag, run `phase --help` or `phase <command> --help` (and `phase ai skill` for the full agent guide) instead of guessing.
- If a command fails because a variable is missing or Phase is not authenticated, report it and ask the user to fix it (`phase auth`, `phase ai enable`). Do not fall back to a local `.env` file.
