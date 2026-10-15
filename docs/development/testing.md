# Testing

```sh
phase run --env dev bun run test   # bun test tests
bun run check                      # svelte-check (web, admin), tsc (api, jobs)
bun run lint                       # prettier --write . && eslint .
```

There is no CI, so run all three before pushing. Tests live in `tests/` at the repository root and import from `packages/lib/src` and `apps/*/src`.

## Live API suite

`tests/apiV1.test.ts` runs against a real `fkp-api` worker and is **skipped** unless `API_TEST_BASE_URL` is set:

```sh
phase run --env dev bun run --filter @fkp/api dev          # terminal 1
API_TEST_BASE_URL=http://localhost:8787 phase run --env dev bun test tests/apiV1.test.ts   # terminal 2
```

The suite sends about 50 requests. The rate limit is 60 per minute, so wait a minute between runs.

## What each file pins

| File | Covers |
| --- | --- |
| `apiV1.test.ts` | Live v1 contract: discovery, parameters/aliases, blog, comments, views, author/CV byte-equality, PDF checksum headers, search, CORS, 404/405, error envelope shape |
| `apiV1Handlers.test.ts` | Offline v1 handlers: `/cv` equals `/author?field=cv`, no DB IDs, checksum rules, markdown negotiation, comment nesting |
| `apiParams.test.ts` | `parseApiParams`, aliases, conflicts, `output` vs `Accept`, boolean and number parsing |
| `postLookup.test.ts` | Post slugs, slug regeneration plan, `findPost()` (ID / prefix / slug) |
| `ard.test.ts`, `ardIngestion.test.ts` | ARD manifest, search, filters, facets, tokens, no lexical fallback; index ingestion and migration privacy |
| `markdown.test.ts`, `legacyMarkdown.test.ts` | Markdown engine output; legacy syntax migration |
| `sanitizeHtml.test.ts` | Hostile input, and engine output surviving the allow-list |
| `csp.test.ts` | Content-Security-Policy builder |
| `robots.test.ts` | `robots.txt` directives and preview blocking |
| `moderation.test.ts` | Llama Guard moderation parsing |
| `adminAuthState.test.ts` | MFA/passkey session rules (`requiresAdminMfa`) |
| `safeRedirect.test.ts` | Admin login `redirectTo` safety |
| `adminNoShortcuts.test.ts`, `admin-empty-states.test.ts` | Admin UI rules |
| `safeupdate.test.ts` | Every `UPDATE`/`DELETE` in migrations has a `WHERE` (PostgREST `safeupdate`) |
| `page-feedback-delete-migration.test.ts`, `blogTranslationRemoval.test.ts` | Specific migrations |
| `newsletterQueue.test.ts`, `unsubscribeUrl.test.ts`, `contactEmail.test.ts` | Queue message validation, unsubscribe URL, contact email rendering |
| `blogBannerRoute.test.ts`, `blogStorageCleanup.test.ts`, `blogPostInput.test.ts`, `postSaveClient.test.ts` | Banner routes, Markdown cleanup queue, post input validation, save button label |
| `avatarFormats.test.ts`, `imageSources.test.ts`, `identityFallback.test.ts`, `siteBannerUpload.test.ts` | Avatar WebP/AVIF validation, `<picture>` sources, identity fallbacks, site banner (the last two are in the working tree as of 2026-10-15) |
| `cvPdf.test.ts`, `author.test.ts`, `dataExport.test.ts` | CV PDF generation, author loading, data export |
| `a11ySettings.test.ts`, `focusHighlight.test.ts`, `frameScheduler.test.ts`, `calendarWeekColumns.test.ts`, `analyticsTag.test.ts` | UI helpers |

## Gaps

No test covers these:

- the web OpenAPI mirror, `llms.txt`, agent skills or `api-catalog`;
- the rate limiter;
- OpenAPI-versus-handler consistency;
- the jobs worker's `queue()`/`scheduled()` handlers.

When you change one of them, verify by hand, for example with `curl` against `wrangler dev`.

## Diagrams

The Mermaid diagrams in `docs/` render with:

```sh
bunx @mermaid-js/mermaid-cli@11 -i docs/architecture/<file>.md -o /tmp/out.md
```
