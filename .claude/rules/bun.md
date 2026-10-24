# Package manager: bun

This repo uses **bun** (`bun.lock` is the lockfile, the hoisted linker is set in `bunfig.toml`). Never use `npm`, `npx`, `yarn`, `pnpm` or `pnpx`.

- `bun install`, `bun add <pkg>` (in the workspace that needs it, for example `cd packages/lib && bun add <pkg>`), `bun remove <pkg>`.
- `bun run <script>` for scripts, `bunx <tool>` for one-off tools (`bunx commitlint`, `bunx prettier`, `bunx wrangler`).
- Never add or reference `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`, and never edit `bun.lock` by hand.
