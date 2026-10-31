# Architecture

Low-level diagrams of how a request travels from the browser through the Cloudflare Workers to D1, R2, Cloudflare Access and the external services. Each file covers one flow. Each file ends with a **Source** list of the code it was verified against. Re-check those files when you edit a diagram.

| # | File | Covers |
| --- | --- | --- |
| 1 | [Component map](001-component-map.md) | Workers, bindings, D1, R2, Cloudflare Access, external services |
| 2 | [Web request pipeline](002-web-middleware-pipeline.md) | `apps/web/src/hooks.server.ts`, step by step |
| 3 | [Page render](003-page-render.md) | Data loading for `/`, `/blog`, `/blog/[slug]` |
| 4 | [Public write endpoints](004-public-write-endpoints.md) | Comments, views, subscribe, contact, feedback |
| 5 | [Public API worker](005-public-api.md) | Hono middleware and handler flow (endpoint reference lives in [docs/api](../004-api/README.md)) |
| 6 | [Admin sign-in](006-admin-sign-in.md) | Cloudflare Access, `accessIdentity`, `verifyAdminRequest` |
| 7 | [Publish and newsletter](007-publish-post.md) | Idempotent post save, queue, jobs consumer, Resend |
| 8 | [Image pipeline](008-asset-pipeline.md) | Encode, validate, R2 keys, serving, cleanup |
| 9 | [Database schema](009-database-schema.md) | Live tables, foreign keys, functions, cron |
| 10 | [Endpoint reference](010-endpoint-reference.md) | Every route on every host, with its guard |
| 11 | [Resume documents](011-resume-documents.md) | Resume versioning (major/minor), `resume/` files, checksums, GPG signature |
| 12 | [Identity provider](012-identity-provider.md) | WebFinger, avatar by email hash, Sign in with Idstead (OpenID Connect) |
| 13 | [Analytics and consent](013-analytics-and-consent.md) | Provider setting, head snippet, CSP, cookie banner, `api.v1.analytics` |

Last verified against the code and the live database on **2026-10-15**.

## Editing

- Diagrams are Mermaid. They render on GitHub, in VS Code with a Mermaid extension, and on [mermaid.live](https://mermaid.live).
- Validate syntax before committing:

    ```sh
    bunx @mermaid-js/mermaid-cli@11 -i docs/003-architecture/002-web-middleware-pipeline.md -o /tmp/out.md
    ```

- Describe only what the code does. If a detail cannot be confirmed, leave it out rather than guess.
- To add a flow, create `014-<name>.md` with the same layout (scope line, diagram, notes, Source), then add a row above.
