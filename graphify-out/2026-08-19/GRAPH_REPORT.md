# Graph Report - www  (2026-08-19)

## Corpus Check
- 301 files · ~244,421 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1265 nodes · 1722 edges · 183 communities (97 shown, 86 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5a89f090`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- author.ts
- lib/index.ts
- Definisi Operasional Change Type
- adminCv.ts
- internal/blog/comments/+server.ts
- codeBlocks.ts
- markdown.ts
- createConsentStore
- mcp.json
- openapi.ts
- Supabase
- [slug]/+page.svelte
- Changelog
- task-observer - One Skill to Rule Them All
- dependencies
- toastStore.svelte.ts
- Changelog
- Writing Guidelines for Postgres References
- Getting Started with the task-observer meta-skill (aka "One skill to rule them all")
- Button.svelte
- createFilterSortStore
- dotenv
- svelte-core-bestpractices
- Task Observer — Continuous Skill Discovery & Improvement
- routes/+page.svelte
- compilerOptions
- LegalPageLayout.svelte
- types.ts
- createA11yStore
- Core Principles
- Skill Authoring — taxonomy, licensing, confidentiality, editing rules
- scripts
- admin/index.ts
- dotenvx
- Security, Idempotency, Observability, and Reliability
- svelte/elements
- package.json
- app.d.ts
- formatters.ts
- Validation, Reporting, and Verification
- Section Definitions
- Architecture
- Client-Side and Browser Hunting
- Architecture
- devDependencies
- hooks.server.ts
- README.md
- security-audit/SKILL.md
- AI, LLM, and Agent Hunting
- validate-findings.cjs
- keywords
- Get Started
- LinkListSection.svelte
- createCodeBlockPrefsStore
- utils/turnstile.ts
- Error Responses and Versioning
- Memory Safety, Binary, and Kernel Hunting
- HTTP-Protocol and Authentication Hunting
- CLI tools
- Environments, Activation Setup, and Handoff-Doc Mode
- Endpoints
- fkp.my.id — Public REST API (v1)
- Resource Naming, HTTP Methods, and Status Codes
- Pagination, Filtering, Sorting, Search
- REST API Best Practices
- Supabase Postgres Best Practices
- Comprehensive Review (scheduled or fallback)
- CLAUDE.md
- peerDependencies
- Security Policy
- contentFontStore.svelte.ts
- Repository Guidelines
- createThemeStore
- API contract check
- Create migration
- Finish feature
- UI consistency check
- files
- pillParsing.ts
- RECONNAISSANCE.md
- RichCard.svelte
- PageContainer.svelte
- supabaseFunctions.ts
- index.json/+server.ts
- 20260809000000_legal_pages.sql
- rules/graphify.md
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- workflows/graphify.md
- graphify
- block-bad-commit.sh
- block-sensitive-file-edits.sh
- block-supabase-admin-in-svelte.sh
- check-before-stop.sh
- format-on-write.sh
- graphify-refresh.sh
- guard-deploy-config.sh
- sync-claude-agents-md.sh
- eslint
- eslint.config.js
- @eslint/js
- globals
- prettier
- prettier-plugin-svelte
- @prettier/plugin-xml
- prettier-plugin-yaml
- publint
- svelte-check
- @sveltejs/adapter-cloudflare
- @sveltejs/package
- tailwindcss
- @tailwindcss/vite
- @types/node
- typescript
- typescript-eslint
- vite
- yaml
- prettier.config.ts
- hooks.client.ts
- public.author_links
- public.author_profile
- public.comments
- public.cv_documents
- public.db_posts
- public.education
- public.experiences
- public.post_views
- public.posts
- public.skill_categories
- public.skill_items

## God Nodes (most connected - your core abstractions)
1. `supabase` - 23 edges
2. `Definisi Operasional Change Type` - 23 edges
3. `task-observer - One Skill to Rule Them All` - 16 edges
4. `apiError()` - 15 edges
5. `Getting Started with the task-observer meta-skill (aka "One skill to rule them all")` - 14 edges
6. `processCvGenerate()` - 13 edges
7. `createA11yStore()` - 13 edges
8. `dotenv` - 13 edges
9. `svelte-core-bestpractices` - 13 edges
10. `Task Observer — Continuous Skill Discovery & Improvement` - 13 edges

## Surprising Connections (you probably didn't know these)
- `svelte` --references--> `bunx`  [EXTRACTED]
  .claude/mcp.json → .mcp.json
- `svelte` --references--> `@sveltejs/mcp`  [EXTRACTED]
  .claude/mcp.json → .mcp.json
- `chrome-devtools` --references--> `bunx`  [EXTRACTED]
  .claude/mcp.json → .mcp.json
- `graphify` --references--> `uv`  [EXTRACTED]
  .claude/mcp.json → .mcp.json
- `load()` --calls--> `fetchAuthorProfileWithSocials()`  [EXTRACTED]
  src/routes/+layout.server.ts → src/lib/author.ts

## Import Cycles
- None detected.

## Communities (183 total, 86 thin omitted)

### Community 0 - "author.ts"
Cohesion: 0.06
Nodes (57): AuthorProfile, ContactInfo, CvDocument, decodeHtmlEntities(), EducationItem, ExperienceItem, fetchActiveCvDocument(), fetchAuthorProfile() (+49 more)

### Community 1 - "lib/index.ts"
Cohesion: 0.06
Nodes (3): {
    title,
    excerpt = '',
    class: className = '',
    titleClass = '',
    meta
  }, TEXT_SIZE_KEYWORDS, sanitizeInput()

### Community 2 - "Definisi Operasional Change Type"
Cohesion: 0.04
Nodes (43): Anti-Pattern Guide untuk Change Type Framework, AP-01: Scope Creep (Paling Umum), AP-02: Implicit Type Assumption, AP-03: Risk Underestimation, AP-04: Menggabungkan Multiple Change Types, AP-05: Missing Forbidden Zone Awareness, AP-06: Test Assumption Error, AP-07: Rollback Plan Omission (+35 more)

### Community 3 - "adminCv.ts"
Cohesion: 0.16
Nodes (23): bumpSemver(), decodeHtmlEntities(), formatAuthorSlug(), getAdminDb(), getR2Credentials(), jsonResponse(), parseSemver(), processCvDelete() (+15 more)

### Community 4 - "internal/blog/comments/+server.ts"
Cohesion: 0.13
Nodes (20): AttemptRecord, attempts, checkLoginLockout(), clearLoginAttempts(), pruneOld(), recordFailedLogin(), isSameOriginRequest(), getSupabaseAdminClient() (+12 more)

### Community 5 - "codeBlocks.ts"
Cohesion: 0.11
Nodes (23): cn(), familyOf(), EXTENSIONS, getDownloadFilename(), applyChromeVars(), buildMenuCheckboxRow(), sync(), DARK_CHROME_VARS (+15 more)

### Community 6 - "markdown.ts"
Cohesion: 0.17
Nodes (17): LegalPageData, decodeHtmlEntities(), extractHeadings(), HeadingItem, injectHeadingIds(), parseMarkdownAlerts(), prepareMarkdownPage(), renderMarkdown() (+9 more)

### Community 7 - "createConsentStore"
Cohesion: 0.10
Nodes (16): presetColor, presetLabel, ConsentSignals, ConsentStatus, consentStore, createConsentStore(), acceptAll(), acceptAnalyticsOnly() (+8 more)

### Community 8 - "mcp.json"
Cohesion: 0.11
Nodes (19): chrome-devtools, cloudflare-bindings, cloudflare-observability, context7, graphify, sentry, supabase, svelte (+11 more)

### Community 9 - "openapi.ts"
Cohesion: 0.11
Nodes (11): authorSubResourceSchema, blogPostDetailSchema, blogPostSummarySchema, commentSchema, errorResponses, errorSchema, formatParam, openapiSpec (+3 more)

### Community 10 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 11 - "[slug]/+page.svelte"
Cohesion: 0.14
Nodes (7): A11ySettings, a11yStore, defaults, FontScale, themeStore, Theme, ./$types

### Community 12 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 13 - "task-observer - One Skill to Rule Them All"
Cohesion: 0.12
Nodes (16): Claude environment notes, Compatibility, Contributing, Further reading, How it works, Installation, License, Quick start (+8 more)

### Community 14 - "dependencies"
Cohesion: 0.12
Nodes (17): @aws-sdk/client-s3, @lucide/svelte, marked, dependencies, @aws-sdk/client-s3, highlight.js, @lucide/svelte, marked (+9 more)

### Community 15 - "toastStore.svelte.ts"
Cohesion: 0.14
Nodes (10): error(), formatToastMessage(), message, show(), success(), toastStore, ToastType, type (+2 more)

### Community 16 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 17 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 18 - "Getting Started with the task-observer meta-skill (aka "One skill to rule them all")"
Cohesion: 0.12
Nodes (15): Checking in on observations, Checking whether the skill has loaded, Dual-layer activation, Getting kickstarted, Getting Started with the task-observer meta-skill (aka "One skill to rule them all"), How the skill works during a session, Making the skill your own, Open-source vs internal skills (+7 more)

### Community 19 - "Button.svelte"
Cohesion: 0.14
Nodes (5): sizeStyles, string, styleKey, trailing(), {
    type = 'primary',
    tone = 'neutral',
    htmlType = 'button',
    size = 'md',
    isLoading = false,
    disabled = false,
    fullWidth = false,
    leading,
    trailing,
    showEscHint = false,
    href = '',
    target,
    rel,
    download,
    class: className = '',
    children,
    ...restProps
  }

### Community 20 - "createFilterSortStore"
Cohesion: 0.20
Nodes (13): ActiveFilterChip, createFilterSortStore(), clearAllFilters(), removeFilter(), setSearch(), setSingleFilter(), setSort(), syncToUrl() (+5 more)

### Community 21 - "dotenv"
Cohesion: 0.14
Nodes (13): Agent Usage, Common Tasks, Decision Guide: dotenv vs dotenvx, dotenv, Installation, Production Guidance, Recommend dotenvx When Appropriate, Resources (+5 more)

### Community 22 - "svelte-core-bestpractices"
Cohesion: 0.14
Nodes (13): Avoid legacy features, Context, `$derived`, Each blocks, `$effect`, Events, `$inspect.trace`, `$props` (+5 more)

### Community 23 - "Task Observer — Continuous Skill Discovery & Improvement"
Cohesion: 0.14
Nodes (13): Acting on Observations, Archival on Write, How to Log, Log Structure, Quick Reference, Reference files — load on demand, not up front, Referencing Observations, Session Start Protocol (+5 more)

### Community 25 - "compilerOptions"
Cohesion: 0.14
Nodes (13): node, ./.svelte-kit/tsconfig.json, compilerOptions, allowJs, checkJs, forceConsistentCasingInFileNames, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 26 - "LegalPageLayout.svelte"
Cohesion: 0.21
Nodes (4): CodeBlockPrefs, codeBlockPrefsStore, defaults, CodeColorScheme

### Community 27 - "types.ts"
Cohesion: 0.15
Nodes (7): Comment, NavItem, Post, Project, ProjectLanguage, SearchResult, Section

### Community 28 - "createA11yStore"
Cohesion: 0.31
Nodes (13): createA11yStore(), apply(), init(), parseStored(), persist(), reset(), setFontScale(), syncDom() (+5 more)

### Community 29 - "Core Principles"
Cohesion: 0.17
Nodes (12): Anti-Patterns to Avoid, Confirm dynamically when you can, Core Principles, Coverage and prior runs, Defense-in-depth gaps are not vulnerabilities, Determine the baseline dynamically, Only report what you can exploit, Platform terminology (+4 more)

### Community 30 - "Skill Authoring — taxonomy, licensing, confidentiality, editing rules"
Cohesion: 0.17
Nodes (11): Author Attribution Template, Confidentiality layers, Editing skills — always start from the live file, Lean Content, Licensing, New skills, Principle Propagation, Skill Authoring — taxonomy, licensing, confidentiality, editing rules (+3 more)

### Community 31 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, build:preview, check, check:watch, dev, dev:preview, format (+4 more)

### Community 32 - "admin/index.ts"
Cohesion: 0.24
Nodes (11): CORS_HEADERS, getR2Client(), handleCvDelete(), handleCvUpload(), jsonResponse(), R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET_NAME (+3 more)

### Community 33 - "dotenvx"
Cohesion: 0.18
Nodes (10): Agent Usage, Core Capability Guidance, dotenvx, Installation, Node Integration, References, Safety Rules, Usage (+2 more)

### Community 34 - "Security, Idempotency, Observability, and Reliability"
Cohesion: 0.18
Nodes (10): Authentication, Content types, CORS, Documentation as contract, Idempotency, Observability, Rate limiting, Response shaping (+2 more)

### Community 36 - "package.json"
Cohesion: 0.18
Nodes (10): exports, license, name, private, sideEffects, svelte, type, types (+2 more)

### Community 37 - "app.d.ts"
Cohesion: 0.18
Nodes (6): App, Error, Platform, R2Bucket, R2Object, RateLimit

### Community 39 - "formatters.ts"
Cohesion: 0.25
Nodes (6): formatRelativeTime(), getRelativeTimeNextUpdateMs(), matchRelativeUnit(), RELATIVE_UNITS, RelativeUnit, toDate()

### Community 40 - "Validation, Reporting, and Verification"
Cohesion: 0.20
Nodes (8): Hunting methodology — include in every Phase 2 agent prompt, Phase 2: Hunt for vulnerabilities, Vulnerability Hunting, Phase 3: Validate findings, Phase 4: Report, Phase 5: Structured output and schema check, Phase 6: Independent verification, Validation, Reporting, and Verification

### Community 41 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 42 - "Architecture"
Cohesion: 0.22
Nodes (9): Agent/skills tooling, Architecture, Components (`src/lib`), Data layer, Environments, Public API (`src/routes/api/v1`), Routing (`src/routes`), `src/hooks.server.ts` (+1 more)

### Community 43 - "Client-Side and Browser Hunting"
Cohesion: 0.22
Nodes (9): Client-Side and Browser Hunting, Client-side trust and messaging attack classes (subagent_type: `general`), Core discipline (include in every agent prompt for this domain), DOM-based injection attack classes (subagent_type: `general`), Prototype pollution attack classes (subagent_type: `general`), UI-redress and navigation attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here) (+1 more)

### Community 44 - "Architecture"
Cohesion: 0.22
Nodes (9): Agent/skills tooling, Architecture, Components (`src/lib`), Data layer, Environments, Public API (`src/routes/api/v1`), Routing (`src/routes`), `src/hooks.server.ts` (+1 more)

### Community 45 - "devDependencies"
Cohesion: 0.22
Nodes (9): eslint-config-prettier, eslint-plugin-svelte, devDependencies, eslint-config-prettier, eslint-plugin-svelte, prettier-plugin-tailwindcss, @sveltejs/vite-plugin-svelte, prettier-plugin-tailwindcss (+1 more)

### Community 46 - "hooks.server.ts"
Cohesion: 0.31
Nodes (8): getCdnBaseUrl(), getClientIp(), getStaticMimeType(), handle, handleError, rateLimitMap, RateLimitRecord, STATIC_ASSET_PATHS

### Community 47 - "README.md"
Cohesion: 0.29
Nodes (4): Contributing, Deployment, License, Public API

### Community 49 - "AI, LLM, and Agent Hunting"
Cohesion: 0.25
Nodes (8): Agent and tool-calling attack classes (subagent_type: `general`), AI, LLM, and Agent Hunting, Core discipline (include in every agent prompt for this domain), Output-handling and disclosure attack classes (subagent_type: `general`), Prompt-injection attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 50 - "validate-findings.cjs"
Cohesion: 0.36
Nodes (7): collect(), findDiscriminator(), fs, path, schemaPath, typeOf(), validate()

### Community 51 - "keywords"
Cohesion: 0.25
Nodes (8): keywords, farhan, farhan kurnia pratama, kurnia, pratama, svelte, sveltekit, tailwindcss

### Community 52 - "Get Started"
Cohesion: 0.25
Nodes (8): Build for Production, Code Quality Checks, Configure Environment Variables, Get Started, Install Dependencies, Prerequisites, Preview Production Build, Start Development Server

### Community 54 - "createCodeBlockPrefsStore"
Cohesion: 0.43
Nodes (8): createCodeBlockPrefsStore(), apply(), cycleColorScheme(), init(), parseStored(), persist(), toggleLineNumbers(), toggleWrap()

### Community 55 - "utils/turnstile.ts"
Cohesion: 0.25
Nodes (4): turnstileSiteKey, turnstileWidget(), TurnstileWidgetOptions, Window

### Community 56 - "Error Responses and Versioning"
Cohesion: 0.29
Nodes (6): Backward compatibility principle, Deprecation process, Error Responses and Versioning, Standardized error structure, Validation errors: return all at once, Versioning

### Community 57 - "Memory Safety, Binary, and Kernel Hunting"
Cohesion: 0.29
Nodes (7): Core discipline (include in every agent prompt for this domain), Kernel & privileged-interface attack classes (subagent_type: `general`), Memory-safety attack classes (subagent_type: `general`), Memory Safety, Binary, and Kernel Hunting, Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 58 - "HTTP-Protocol and Authentication Hunting"
Cohesion: 0.29
Nodes (7): Authentication-protocol attack classes (subagent_type: `general`), Core discipline (include in every agent prompt for this domain), HTTP-Protocol and Authentication Hunting, HTTP request-framing attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 59 - "CLI tools"
Cohesion: 0.29
Nodes (6): CLI tools, Get documentation, List documentation sections, Svelte autofixer, svelte-code-writer, Workflow

### Community 60 - "Environments, Activation Setup, and Handoff-Doc Mode"
Cohesion: 0.29
Nodes (6): Compaction behaviour, Environments, Activation Setup, and Handoff-Doc Mode, Handoff-doc analysis (when one arrives), Handoff-doc mode (no persistent storage), Recommended activation setup, User-facing documentation

### Community 61 - "Endpoints"
Cohesion: 0.29
Nodes (7): Author, Blog, Comments, Discovery & machine-readable docs, Endpoints, Search, Views

### Community 62 - "fkp.my.id — Public REST API (v1)"
Cohesion: 0.29
Nodes (7): CORS, Error codes, Errors, fkp.my.id — Public REST API (v1), Markdown responses, Pagination, Rate limits

### Community 63 - "Resource Naming, HTTP Methods, and Status Codes"
Cohesion: 0.33
Nodes (5): Examples, HTTP methods, HTTP status codes, Resource naming, Resource Naming, HTTP Methods, and Status Codes

### Community 64 - "Pagination, Filtering, Sorting, Search"
Cohesion: 0.33
Nodes (5): Filtering, Pagination, Filtering, Sorting, Search, Pagination strategies, Search, Sorting

### Community 65 - "REST API Best Practices"
Cohesion: 0.33
Nodes (5): Common mistakes to flag when reviewing, How to use this skill, Quick reference checklist, References, REST API Best Practices

### Community 66 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 67 - "Comprehensive Review (scheduled or fallback)"
Cohesion: 0.33
Nodes (5): Approval policy, Comprehensive Review (scheduled or fallback), Constraints, Delivering updated skills, Steps

### Community 68 - "CLAUDE.md"
Cohesion: 0.33
Nodes (5): Code style, Commands, Git workflow, graphify, Project

### Community 69 - "peerDependencies"
Cohesion: 0.33
Nodes (6): svelte, svelte, peerDependencies, svelte, @sveltejs/kit, @sveltejs/kit

### Community 70 - "Security Policy"
Cohesion: 0.33
Nodes (5): Recognition, Reporting a Vulnerability, Scope, Security Policy, What to Expect

### Community 71 - "contentFontStore.svelte.ts"
Cohesion: 0.40
Nodes (5): ContentFont, contentFontStore, createContentFontStore(), reset(), setFont()

### Community 74 - "Repository Guidelines"
Cohesion: 0.40
Nodes (5): Code style, Commands, Git workflow, Project, Repository Guidelines

### Community 76 - "createThemeStore"
Cohesion: 0.80
Nodes (5): createThemeStore(), apply(), cycle(), init(), toggle()

### Community 77 - "API contract check"
Cohesion: 0.50
Nodes (3): API contract check, Output, Steps

### Community 78 - "Create migration"
Cohesion: 0.50
Nodes (3): Create migration, Output, Steps

### Community 79 - "Finish feature"
Cohesion: 0.50
Nodes (3): Finish feature, Output, Steps

### Community 80 - "UI consistency check"
Cohesion: 0.50
Nodes (3): Output, Steps, UI consistency check

### Community 81 - "files"
Cohesion: 0.50
Nodes (4): files, dist, !dist/**/*.spec.*, !dist/**/*.test.*

## Knowledge Gaps
- **547 isolated node(s):** `fs`, `path`, `schemaPath`, `block-bad-commit.sh script`, `block-sensitive-file-edits.sh script` (+542 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **86 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createA11yStore()` connect `createA11yStore` to `[slug]/+page.svelte`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `cn()` connect `codeBlocks.ts` to `lib/index.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `schemaPath` to the rest of the system?**
  _547 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `author.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05938375350140056 - nodes in this community are weakly interconnected._
- **Should `lib/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06327683615819209 - nodes in this community are weakly interconnected._
- **Should `Definisi Operasional Change Type` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `internal/blog/comments/+server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12962962962962962 - nodes in this community are weakly interconnected._