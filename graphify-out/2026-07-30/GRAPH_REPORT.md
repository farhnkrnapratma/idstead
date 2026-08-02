<!-- @format -->

# Graph Report - . (2026-07-30)

## Corpus Check

- cluster-only mode — file stats not available

## Summary

- 457 nodes · 684 edges · 54 communities (38 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `47ba3cc0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- lib/index.ts
- author.ts
- devDependencies
- package.json
- design-system/index.ts
- admin/+page.svelte
- supabase.ts
- svelte/elements
- compilerOptions
- dependencies
- DropdownTrigger.svelte
- validate-findings.cjs
- app.d.ts
- children
- farhnkrnapratma (GitHub Sponsor)
- .mcp.json
- useFilterSort.svelte.ts
- hooks.server.ts
- index.json/+server.ts
- eslint.config.js
- prettier.config.ts
- GTag Consent Initialization
- hooks.client.ts
- Project Configuration
- Svelte MCP Tools Guide
- datetime
- fixture
- Dependabot: bun package ecosystem (weekly updates)
- Namespace
- Path

## God Nodes (most connected - your core abstractions)

1. `fetchAuthorProfile()` - 16 edges
2. `supabase` - 12 edges
3. `compilerOptions` - 10 edges
4. `scripts` - 10 edges
5. `keywords` - 8 edges
6. `fetchCvEntries()` - 8 edges
7. `sanitizeInput()` - 8 edges
8. `loadAdminData()` - 8 edges
9. `load()` - 7 edges
10. `fetchGroupedSkills()` - 6 edges

## Surprising Connections (you probably didn't know these)

- `farhnkrnapratma (GitHub Sponsor)` --conceptually_related_to--> `www (official website project)` [INFERRED] .github/FUNDING.yml → README.md
- `cn()` --calls--> `children()` [INFERRED] src/lib/design-system/layout/ActionBar.svelte → src/lib/design-system/layout/FormSection.svelte
- `cn()` --calls--> `children()` [INFERRED] src/lib/design-system/layout/ListSection.svelte → src/lib/design-system/layout/FormSection.svelte
- `cn()` --calls--> `children()` [INFERRED] src/lib/design-system/layout/Section.svelte → src/lib/design-system/layout/FormSection.svelte
- `GET()` --calls--> `fetchAuthorProfile()` [EXTRACTED] src/routes/author/+server.ts → src/lib/author.ts

## Import Cycles

- None detected.

## Communities (54 total, 16 thin omitted)

### Community 0 - "lib/index.ts"

Cohesion: 0.06 Nodes (15): ConsentSignals, ConsentStatus, consentStore, RetentionPeriod, RetentionSettings, StreamInfo, Window, themeStore (+7 more)

### Community 1 - "author.ts"

Cohesion: 0.09 Nodes (36): AuthorProfile, ContactInfo, CvDocument, EducationItem, ExperienceItem, fetchActiveCvDocument(), fetchAuthorProfile(), fetchContactInfo() (+28 more)

### Community 2 - "devDependencies"

Cohesion: 0.05 Nodes (43): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-svelte, globals, devDependencies, eslint, eslint-config-prettier (+35 more)

### Community 3 - "package.json"

Cohesion: 0.05 Nodes (38): svelte, tailwindcss, exports, files, keywords, license, name, peerDependencies (+30 more)

### Community 5 - "admin/+page.svelte"

Cohesion: 0.07 Nodes (10): sanitizeIconClass(), handleAdminSubmit(), handleSaveAuthor(), handleSaveContact(), handleSaveCv(), handleSaveSkills(), handleSaveSocials(), handleSaveSponsorship() (+2 more)

### Community 6 - "supabase.ts"

Cohesion: 0.09 Nodes (17): supabase, isNameReserved(), normalizeName(), getS3Client(), POST(), FORBIDDEN_WORDS, getCommentDepth(), localModerate() (+9 more)

### Community 8 - "compilerOptions"

Cohesion: 0.14 Nodes (13): node, ./.svelte-kit/tsconfig.json, compilerOptions, allowJs, checkJs, forceConsistentCasingInFileNames, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 10 - "dependencies"

Cohesion: 0.15 Nodes (13): @aws-sdk/client-s3, bootstrap-icons, dependencies, @aws-sdk/client-s3, bootstrap-icons, highlight.js, marked, @sentry/sveltekit (+5 more)

### Community 12 - "validate-findings.cjs"

Cohesion: 0.36 Nodes (7): collect(), findDiscriminator(), fs, path, schemaPath, typeOf(), validate()

### Community 13 - "app.d.ts"

Cohesion: 0.25 Nodes (4): App, Platform, R2Bucket, R2Object

### Community 14 - "children"

Cohesion: 0.25 Nodes (4): cn(), children(), cn(), cn()

### Community 15 - "farhnkrnapratma (GitHub Sponsor)"

Cohesion: 0.33 Nodes (6): Ko-fi: farhnkrnapratma, Open Collective: farhnkrnapratma, farhnkrnapratma (GitHub Sponsor), Bun 1.0+ runtime (prerequisite), MIT License, www (official website project)

### Community 16 - ".mcp.json"

Cohesion: 0.33 Nodes (5): bunx, Sentry, supabase, svelte, @sveltejs/mcp

### Community 17 - "useFilterSort.svelte.ts"

Cohesion: 0.33 Nodes (4): ActiveFilterChip, FilterSortOptions, FilterSortStore, SortState

## Knowledge Gaps

- **116 isolated node(s):** `fs`, `path`, `schemaPath`, `config`, `resolvedField` (+111 more) These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?** _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?** _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `fetchAuthorProfile()` connect `author.ts` to `supabase.ts`?** _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `schemaPath` to the rest of the system?** _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/index.ts` be split into smaller, more focused modules?** _Cohesion score 0.06105457909343201 - nodes in this community are weakly interconnected._
- **Should `author.ts` be split into smaller, more focused modules?** _Cohesion score 0.08788159111933395 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?** _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
