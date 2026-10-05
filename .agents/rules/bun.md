---
trigger: always_on
description: Always use bun/bunx instead of npm/npx/yarn/pnpm for this project.
---

## Package manager: bun

This project uses **bun** as its package manager (`bun.lock` is the lockfile). Never use `npm`, `npx`, `yarn`, `pnpm`, or `pnpx` for any operation.

Rules:

- Use `bun install` instead of `npm install` / `yarn install`.
- Use `bun add <pkg>` instead of `npm install <pkg>`.
- Use `bun remove <pkg>` instead of `npm uninstall <pkg>`.
- Use `bun run <script>` instead of `npm run <script>`.
- Use `bunx <tool>` instead of `npx <tool>` for one-off tool invocations (e.g. `bunx commitlint`, `bunx svelte-check`).
- Never commit or reference `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`.
