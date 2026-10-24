Use the Context7 MCP server to fetch current documentation whenever the task involves a library, framework, SDK, API, CLI tool or cloud service — even well-known ones like Svelte, SvelteKit, Tailwind CSS, Hono, Wrangler or Cloudflare Workers. This covers API syntax, configuration, version migration, library-specific debugging, setup and CLI usage. Use it even when you think you know the answer: training data may not reflect recent releases. Prefer it over web search for library docs, and do not use the `ctx7` CLI.

Do not use it for refactoring, writing scripts from scratch, debugging business logic, code review or general programming concepts. For Svelte and SvelteKit, the Svelte MCP server (`list-sections`, `get-documentation`, `svelte-autofixer`) comes first, as `CLAUDE.md` describes.

## Steps

1. Call `resolve-library-id` with the official library name (for example "SvelteKit", "Tailwind CSS", "Three.js") and what you need to look up, unless the user already gave an ID in `/org/project` format.
2. Pick the best match (ID format `/org/project`) by exact name, description relevance, code snippet count, source reputation (High or Medium preferred) and benchmark score. Use a version-specific ID (`/org/project/version`) when the version matters, matching the one in this repo's `package.json`. If the results look wrong, try another name or rephrase.
3. Call `query-docs` with that ID and a specific question about one concept. If the question spans several distinct concepts, make one call per concept, unless it is about how they interact.
4. Answer from the fetched documentation.

Make at most three calls per question, and never include secrets, credentials or proprietary code in a query. If the server is unavailable or over quota, tell the user instead of silently falling back to training data.
