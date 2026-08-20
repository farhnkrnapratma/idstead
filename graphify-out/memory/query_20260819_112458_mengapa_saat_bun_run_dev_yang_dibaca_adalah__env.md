---
type: "query"
date: "2026-08-19T11:24:58.309289+00:00"
question: "Mengapa saat bun run dev yang dibaca adalah .env? Bagaimana agar bun run dev menggunakan .env.production dan bun run dev:preview menggunakan .env.preview?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["vite.config.ts", "package.json"]
---

# Q: Mengapa saat bun run dev yang dibaca adalah .env? Bagaimana agar bun run dev menggunakan .env.production dan bun run dev:preview menggunakan .env.preview?

## Answer

Expanded from original query via vocab: [config, dev, development, dotenv, env, environment, environments, mode, preview, production, vite]. Vite dev runs in development mode by default, loading .env and .env.development. To load .env.production on dev, configure package.json scripts with vite dev --mode production and dev:preview with vite dev --mode preview.

## Outcome

- Signal: useful

## Source Nodes

- vite.config.ts
- package.json