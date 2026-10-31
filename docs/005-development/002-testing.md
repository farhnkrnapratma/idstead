# Testing

```sh
bun run test   # bun test tests
bun run check                      # svelte-check (web, admin), tsc (api, jobs, mdrs, and tests/tooling/scripts through the root tsconfig.json)
bun run lint                       # prettier --write . && eslint . && bun run lint:deprecated
bun run lint:deprecated            # typed ESLint pass: fails on any @deprecated API
```

There is no CI, so run the first three before pushing. `lint:deprecated` uses its own config, `eslint.deprecated.config.ts`, because the rule needs type information: it builds a TypeScript program per workspace, which would make every editor lint slow if it lived in `eslint.config.ts`. The codebase uses no deprecated APIs, icons or packages; when a transitive dependency pulls in a deprecated release, pin it with `overrides` in the root `package.json`. Tests live in `tests/` at the repository root and import from `packages/lib/src` and `apps/*/src`.

## Live API suite

`tests/apiV1.test.ts` runs against a real `idstead-api` worker and is **skipped** unless `API_TEST_BASE_URL` is set:

```sh
bun run --filter @idstead/api dev          # terminal 1
API_TEST_BASE_URL=http://localhost:8787 bun test tests/apiV1.test.ts   # terminal 2
```

The suite sends about 50 requests. The rate limit is 60 per minute, so wait a minute between runs.

## What each file pins

| File | Covers |
| --- | --- |
| `apiV1.test.ts` | Live v1 contract: discovery, parameters/aliases, blog, comments, views, author/Resume byte-equality, PDF checksum headers, search, CORS, 404/405, error envelope shape |
| `apiV1Handlers.test.ts` | Offline v1 handlers: `/resume` equals `/author?field=resume`, no DB IDs, checksum rules, markdown negotiation, comment nesting |
| `apiParams.test.ts` | `parseApiParams`, aliases, conflicts, `output` vs `Accept`, boolean and number parsing |
| `postSlug.test.ts` | Post slugs and the slug regeneration plan |
| `sanitizePublicApiData.test.ts` | `sanitizePublicApiData` drops row IDs and the avatar and banner asset versions from `/v1/author` |
| `ard.test.ts`, `ardIngestion.test.ts` | ARD manifest, search, filters, facets, tokens, no lexical fallback; index ingestion and persistence |
| `mdrsConditionals.test.ts`, `mdrsResolveDefines.test.ts` | Strings, the ternary, `:::if` and `${if}` blocks (nesting, protection, errors, live-data detection); `resolveDefines` for `.md` and `.txt` exports |
| `markdown.test.ts`, `frontmatter.test.ts`, `postAssetMarkdown.test.ts` | Markdown engine output; YAML frontmatter and `:::define` validation; post images (AVIF with WebP fallback) and WebM videos |
| `mdrsDocsSnapshot.test.ts` | Snapshot of the rendered HTML for every ` ```mdrs ` example in `docs/008-mdrs/` and for `fixtures/markdown-demo.md`. After an intended engine change, review the diff and refresh it with `bun test tests/mdrsDocsSnapshot.test.ts --update-snapshots` |
| `mdrsRenderVersion.test.ts`, `postRender.test.ts`, `blogPostSave.test.ts` | `RENDER_VERSION` is bumped whenever the MDRS snapshot changes; render file paths, live-data detection and render file validation; the save stores the render next to the markdown and survives a failed render upload |
| `postRenderRefresh.test.ts` | The render refresh re-renders live, missing and outdated renders within its budget; resolvers fetch each live-data list once per render |
| `spotlightMatch.test.ts` | Spotlight search ranking, case-sensitive, whole-word and regex modes, and match highlighting |
| `editorTextEdits.test.ts` | Markdown editor helpers: selection wrapping, Tab indent, list and quote continuation, cursor position, asset markdown, and highlighting that keeps every `$` so the overlay lines up |
| `sanitizeHtml.test.ts`, `decodeHtmlEntities.test.ts` | Hostile input, and engine output surviving the allow-list; single-level entity decoding |
| `docsLayout.test.ts` | `docs/` folders are numbered `001…n` and every relative link and anchor resolves |
| `csp.test.ts` | Content-Security-Policy builder |
| `robots.test.ts` | `robots.txt` directives and preview blocking |
| `moderation.test.ts`, `inferenceQueue.test.ts` | Llama Guard moderation parsing; Workers AI concurrency limit |
| `accessAuth.test.ts` | Cloudflare Access token checks (signature, `iss`, `aud`, expiry, `type`, `ADMIN_EMAILS`) and the loopback-only dev identity |
| `secretLockout.test.ts` | Lockout counter for failed client secrets (salted hashes, shared counter, in-memory counter without the database) |
| `ipSalt.test.ts` | `ipSalt` prefers the Worker binding and never falls back to a hard-coded salt |
| `adminNoShortcuts.test.ts`, `adminEmptyStates.test.ts` | Admin UI rules |
| `newsletterQueue.test.ts`, `newsletterBroadcast.test.ts`, `unsubscribeUrl.test.ts`, `contactEmail.test.ts` | Queue message validation; broadcast claims, idempotency keys and the `PUBLIC_SITE_URL` link fallback; unsubscribe URL; contact email rendering |
| `blogBannerRoute.test.ts` | Banner object keys and CDN URLs, reserved slugs, and that banners and content are served from the CDN, not the Worker |
| `blogStorageCleanup.test.ts`, `blogPostInput.test.ts`, `postSaveClient.test.ts` | Markdown cleanup queue, post input validation, save button label |
| `r2.test.ts` | `ASSET_BUCKET` binding helpers: missing binding, copy, paginated list and batched delete, create-once put |
| `assetNaming.test.ts` | Asset file names and alt text |
| `avatarFormats.test.ts`, `imageSources.test.ts`, `identityFallback.test.ts`, `siteBannerUpload.test.ts`, `contentImageAvif.test.ts` | Avatar WebP/AVIF validation, `<picture>` sources, identity fallbacks, site banner package, content image AVIF variant |
| `resumePdf.test.ts`, `resumeVersion.test.ts`, `resumeChecksums.test.ts`, `dataExport.test.ts` | Resume PDF generation, resume version bumps, coreutils checksums and storage keys, data export |
| `openpgp.test.ts`, `wkdRoute.test.ts` | OpenPGP key parsing, detached resume signatures, key discovery (WKD hashes, keyservers) and the resume verification bundle; WKD direct-method lookup |
| `analyticsSettings.test.ts`, `analyticsTag.test.ts` | Analytics provider validation and public facts, `GET /v1/analytics`; the `%idstead.analytics%` placeholder, each provider's head snippet and CSP sources |
| `*.contract.test.ts` | One suite per port group from `tests/contracts/` (blog, author, subscribers, activity, admin posts and author, resume documents, OIDC), plus the legal page, site data, site settings and support store adapters, all on the `bun:sqlite` D1 shim |
| `d1Schema.test.ts`, `d1Activity.test.ts`, `d1AdminAuthor.test.ts`, `d1AdminPosts.test.ts`, `feedbackMigration.test.ts` | Tables the adapters query, defaults and constraints; feedback votes, the activity log, profile saves and post operations on D1; migration 0008 keeps feedback events and their operations |
| `dataStores.test.ts`, `resultCache.test.ts`, `pageDataCache.test.ts` | Store wiring from the D1 and bucket bindings; the generational read cache; the edge cache key for section page data |
| `oidcAuthorize.test.ts`, `oidcClients.test.ts`, `oidcDiscovery.test.ts`, `oidcEnabled.test.ts`, `oidcEndpoints.test.ts` | OpenID Connect authorize checks, client input, signing key and discovery, the `OIDC_ENABLED` switch, token, userinfo and revoke endpoints with lockout |
| `activityLogIp.test.ts`, `csrf.test.ts`, `writeFreeze.test.ts`, `siteOrigin.test.ts` | Client address for the activity log and that admin routes log through `logAdminActivity`; the cross-site form check; `WRITES_FROZEN`; origin parsing |
| `instanceConfig.test.ts`, `setupPlan.test.ts`, `apiReadme.test.ts`, `naming.test.ts` | `idstead.jsonc` resolution, the setup plan, the API README template, and that only the instance files name the instance |
| `adminPublicSite.test.ts`, `listFieldError.test.ts`, `readJson.test.ts`, `filterMenu.test.ts` | Admin links to the public site, list field validation, JSON response reading, filter counts |
| `avatarLookup.test.ts`, `pngEncoder.test.ts`, `postBannerMove.test.ts` | Gravatar-style avatar lookup, the indexed PNG encoder, banner moves on publish and unpublish |
| `projectLists.test.ts`, `githubProjects.test.ts`, `publishedEmail.test.ts`, `newsletterSignup.test.ts`, `copyright.test.ts`, `mailMetadata.test.ts` | Homepage project order, GitHub fetching, the published contact email, when the newsletter signup shows, the copyright line, email dates |
| `shortcuts.test.ts`, `tocRail.test.ts`, `tocScroll.test.ts`, `serviceStatus.test.ts`, `typography.test.ts`, `entities.test.ts` | Keyboard shortcuts and key conflicts, the table of contents rail and scroll sync, service status labels, fonts and OpenType features, the shared entity decoder |
| `a11ySettings.test.ts`, `focusHighlight.test.ts`, `frameScheduler.test.ts`, `calendarWeekColumns.test.ts`, `codeScrollbar.test.ts`, `deviceClass.test.ts`, `qrSvg.test.ts`, `skipLink.test.ts` | UI helpers: accessibility settings, focus, frame scheduling, calendar, code block scrollbar, device class, QR SVG, one skip link per page |

`tests/fixtures/` holds the binary and Markdown fixtures (AVIF images, OpenPGP keys, `markdown-demo.md`).

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
bunx @mermaid-js/mermaid-cli@11 -i docs/003-architecture/<file>.md -o /tmp/out.md
```
