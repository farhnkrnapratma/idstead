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
- Use `phase run` only to start processes. Never print injected values (`echo $VAR`, `printenv`, `env`), pipe them elsewhere, or write `phase secrets export` output to a file, unless the user has explicitly allowed it as described below. `phase shell` is blocked in AI mode.
- To check whether a variable exists or what kind it is, use `phase secrets list` or `phase secrets get <KEY>`. A value shown as `[REDACTED]` is for the user to read in their own terminal, unless the user has explicitly allowed you to read it.
- Reading values needs the user's explicit permission in the current conversation, naming the keys and environments (or "all keys" of an environment) and the purpose. Ask for it when a task needs a value, for example to check whether two environments hold the same secret; never assume earlier or general approval covers a new read. With permission:
    - Expose as little as the task needs. To compare values, print SHA-256 digests (`phase run --env <env> -- sh -c 'printf %s "$KEY" | sha256sum'`) instead of the values; print a value itself only when the user asks to see it.
    - Read only the keys and environments that were named, and only through `phase run` (`phase secrets get` and `list` still redact in AI mode).
    - Never write a value or its digest to a file, a commit, a memory note, a tool call other than the shell, or any service.
- Creating, updating, or deleting secrets changes shared state: ask first. Sealed or secret values always use `--random`; when the user supplies a value, ask them to run `phase secrets create <KEY>` themselves.
- When unsure of a command or flag, run `phase --help` or `phase <command> --help` (and `phase ai skill` for the full agent guide) instead of guessing.
- If a command fails because a variable is missing or Phase is not authenticated, report it and ask the user to fix it (`phase auth`, `phase ai enable`). Do not fall back to a local `.env` file.
