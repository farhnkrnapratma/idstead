# Graph Report - www  (2026-08-07)

## Corpus Check
- 237 files · ~96,290 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 898 nodes · 1195 edges · 155 communities (81 shown, 74 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `efd96318`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- author.ts
- eslint & Related
- fetchActiveCvDocument() & Related
- CLAUDE.md & Related
- openapi.ts & Related
- feedback-issue-template.md & Related
- _contributing.md & Related
- data-batch-inserts.md & Related
- .mcp.json & Related
- node & Related
- @aws-sdk/client-s3 & Related
- Anti-Patterns to Avoid & Related
- consentStore.svelte.ts
- utils/turnstile.ts
- routes/+page.svelte & Related
- admin/index.ts & Related
- Attack Classes Overview & Related
- package.json & Related
- app.d.ts & Related
- HUNTING.md & Related
- _sections.md & Related
- scripts & Related
- README.md & Related
- Checkbox.svelte & Related
- toastStore.svelte.ts
- formatters.ts & Related
- Client-Side and Browser Hunting & Related
- supabase-postgres-best-practices/CHANGELOG.md & Related
- [slug]/+page.server.ts
- AI-AND-LLM.md & Related
- validate-findings.cjs & Related
- supabase/CHANGELOG.md & Related
- svelte/elements
- tailwindcss & Related
- [slug]/+page.svelte
- Cookie Consent Default (Google Consent Mode v2) Script & Related
- Force Row Level Security for Table Owners & Related
- Core discipline (include in every agent prompt for this domain) & Related
- Authentication-protocol attack classes (subagent_type: `general`) & Related
- ConsentBanner.svelte
- supabaseFunctions.ts & Related
- conn-limits.md & Related
- supabase-postgres-best-practices/SKILL.md & Related
- svelte & Related
- SECURITY.md & Related
- hooks.server.ts & Related
- useFilterSort.svelte.ts & Related
- FUNDING.yml Sponsorship Configuration & Related
- Phase 2 Vulnerability Hunting & Related
- Supabase Agent Skills Changelog & Related
- Application-Level Advisory Locks & Related
- Query Profiling with EXPLAIN ANALYZE & Related
- api-contract-check/SKILL.md & Related
- create-migration/SKILL.md & Related
- ui-consistency-check/SKILL.md & Related
- files & Related
- Postgres Rule Section Definitions & Related
- RECONNAISSANCE.md & Related
- Cursor-Based Pagination (Keyset Pagination) & Related
- Composite Multi-Column Indexing Strategy & Related
- cn
- index.json/+server.ts & Related
- Audit Validation Rules & Related
- Bun Package Ecosystem Weekly Updates & Related
- AGENTS.md & Related
- Graphify Knowledge Graph Rules for Agents & Related
- rules/graphify.md & Related
- advanced-full-text-search.md & Related
- advanced-jsonb-indexing.md & Related
- conn-idle-timeout.md & Related
- lock-advisory.md & Related
- lock-deadlock-prevention.md & Related
- lock-short-transactions.md & Related
- lock-skip-locked.md & Related
- monitor-explain-analyze.md & Related
- monitor-pg-stat-statements.md & Related
- monitor-vacuum-analyze.md & Related
- query-composite-indexes.md & Related
- query-covering-indexes.md & Related
- query-index-types.md & Related
- query-missing-indexes.md & Related
- query-partial-indexes.md & Related
- schema-constraints.md & Related
- schema-data-types.md & Related
- Optimal PostgreSQL Data Type Selection & Related
- schema-foreign-key-indexes.md & Related
- schema-lowercase-identifiers.md & Related
- schema-partitioning.md & Related
- schema-primary-keys.md & Related
- security-privileges.md & Related
- Principle of Least Privilege & Granular RBAC & Related
- _template.md & Related
- workflows/graphify.md & Related
- block-bad-commit.sh & Related
- block-sensitive-file-edits.sh & Related
- block-supabase-admin-in-svelte.sh & Related
- check-before-stop.sh & Related
- format-on-write.sh & Related
- eslint.config.js & Related
- prettier.config.ts & Related
- hooks.client.ts & Related
- Graphify Knowledge Graph Rule
- Excessive Agency Confused Deputy
- Indirect Prompt Injection
- Prompt Injection Boundary Crossing
- Tool-Argument Injection
- Access Control Vulnerabilities
- Business Logic Vulnerabilities
- Injection Attack Class
- Wildcard Auditing Strategy
- DOM-based XSS
- postMessage Origin Trust
- Prototype Pollution Gadget Chain
- Hunting Methodology Principles
- Spatial Out-of-Bounds Read Write
- Temporal Use-After-Free
- Security Audit Workflow
- Phase 5 Structured Output Schema
- Phase 6 Independent Verification
- JWT Verification Defects
- HTTP Request Smuggling Desync
- Supabase Postgres Best Practices Changelog
- Postgres Rule Template
- Postgres Best Practices Guidelines
- Declarative and Imperative Database Schema Workflows
- Supabase CLI Commands & Discovery
- Supabase Model Context Protocol (MCP) Server Setup
- Specialized Index Selection (B-tree, GIN, GiST, BRIN, Hash)
- Lowercase Unquoted snake_case Identifier Conventions
- Personal Website Overview
- codeBlocks.ts

## God Nodes (most connected - your core abstractions)
1. `supabase` - 20 edges
2. `apiError()` - 13 edges
3. `sanitizePublicApiData()` - 12 edges
4. `handleAuthorJsonRequest()` - 11 edges
5. `scripts` - 10 edges
6. `compilerOptions` - 10 edges
7. `Client-Side and Browser Hunting` - 10 edges
8. `decodeHtmlEntities()` - 9 edges
9. `fetchAuthorProfile()` - 9 edges
10. `fetchCvEntries()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Batch INSERT Statements for Bulk Data` --semantically_similar_to--> `Eliminate N+1 Queries with Batch Loading`  [INFERRED] [semantically similar]
  .agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md → .agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md
- `Web Application Tech Stack` --references--> `Supabase Agent Skill Overview`  [INFERRED]
  README.md → .agents/skills/supabase/SKILL.md
- `Eliminate N+1 Queries with Batch Loading` --semantically_similar_to--> `Use Cursor-Based Pagination Instead of OFFSET`  [INFERRED] [semantically similar]
  .agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md → .agents/skills/supabase-postgres-best-practices/references/data-pagination.md
- `Use UPSERT for Insert-or-Update Operations` --semantically_similar_to--> `Eliminate N+1 Queries with Batch Loading`  [INFERRED] [semantically similar]
  .agents/skills/supabase-postgres-best-practices/references/data-upsert.md → .agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md
- `Use UPSERT for Insert-or-Update Operations` --conceptually_related_to--> `Idempotent Migration Constraint Guard Strategy`  [INFERRED]
  .agents/skills/supabase-postgres-best-practices/references/data-upsert.md → .agents/skills/supabase-postgres-best-practices/references/schema-constraints.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Database Access & Concurrency Optimization Patterns** — agents_skills_supabase_postgres_best_practices_references_data_n_plus_one_eliminate_n_1_queries_with_batch_loading, agents_skills_supabase_postgres_best_practices_references_data_pagination_use_cursor_based_pagination_instead_of_offset, agents_skills_supabase_postgres_best_practices_references_data_upsert_use_upsert_for_insert_or_update_operations [INFERRED 0.85]
- **Supabase RLS & Security Best Practices Architecture** — agents_skills_supabase_postgres_best_practices_references_security_rls_basics_enable_row_level_security_for_multi_tenant_data, agents_skills_supabase_postgres_best_practices_references_security_rls_performance_optimize_rls_policies_for_performance, _agents_skills_supabase_skill_security_checklist [EXTRACTED 1.00]
- **Supabase Local Development & Tooling Ecosystem** — _agents_skills_supabase_skill_supabase_cli, _agents_skills_supabase_skill_supabase_mcp_server, _agents_skills_supabase_skill_schema_management [EXTRACTED 1.00]
- **Domain-Specific Security Hunting Companions** — _agents_skills_security_audit_attack_classes_attack_classes_overview, agents_skills_security_audit_ai_and_llm_ai_llm_and_agent_hunting, agents_skills_security_audit_client_side_client_side_and_browser_hunting, _agents_skills_security_audit_memory_safety_and_binary_memory_safety_hunting, _agents_skills_security_audit_web_protocol_and_auth_web_protocol_hunting [EXTRACTED 1.00]
- **Security Audit Methodology Lifecycle** — _agents_skills_security_audit_reconnaissance_phase_1_recon, _agents_skills_security_audit_hunting_phase_2_hunting, _agents_skills_security_audit_validation_and_reporting_phase_3_validation, _agents_skills_security_audit_validation_and_reporting_phase_5_structured_output, _agents_skills_security_audit_validation_and_reporting_phase_6_independent_verification [EXTRACTED 1.00]
- **Postgres Connection Scalability and Resource Management** — agents_skills_supabase_postgres_best_practices_references_conn_idle_timeout_configure_idle_connection_timeouts, agents_skills_supabase_postgres_best_practices_references_conn_limits_set_appropriate_connection_limits, agents_skills_supabase_postgres_best_practices_references_conn_pooling_use_connection_pooling_for_all_applications, agents_skills_supabase_postgres_best_practices_references_conn_prepared_statements_use_prepared_statements_correctly_with_pooling [INFERRED 0.85]
- **Database Query Indexing & Access Path Optimization Suite** — agents_skills_supabase_postgres_best_practices_references_query_composite_indexes_composite_indexing_strategy, agents_skills_supabase_postgres_best_practices_references_query_covering_indexes_covering_index_include, agents_skills_supabase_postgres_best_practices_references_query_index_types_specialized_index_types, agents_skills_supabase_postgres_best_practices_references_query_missing_indexes_where_join_indexing, agents_skills_supabase_postgres_best_practices_references_query_partial_indexes_partial_indexing_where [EXTRACTED 1.00]
- **PostgreSQL Concurrency & Transaction Lock Management Patterns** — agents_skills_supabase_postgres_best_practices_references_lock_advisory_pg_advisory_locks, agents_skills_supabase_postgres_best_practices_references_lock_deadlock_prevention_consistent_lock_ordering, agents_skills_supabase_postgres_best_practices_references_lock_short_transactions_short_transaction_scope, agents_skills_supabase_postgres_best_practices_references_lock_skip_locked_for_update_skip_locked [EXTRACTED 1.00]
- **Database Performance Monitoring & Diagnostic System** — agents_skills_supabase_postgres_best_practices_references_monitor_explain_analyze_explain_analyze_profiling, agents_skills_supabase_postgres_best_practices_references_monitor_pg_stat_statements_pg_stat_statements_monitoring, agents_skills_supabase_postgres_best_practices_references_monitor_vacuum_analyze_vacuum_analyze_maintenance [INFERRED 0.95]
- **App.html Pre-Hydration Bootstrap Scripts** — src_app_html_dark_mode_init_script, src_app_html_consent_mode_script, src_app_html_gtm_loader_script [INFERRED 0.85]

## Communities (155 total, 74 thin omitted)

### Community 0 - "author.ts"
Cohesion: 0.06
Nodes (56): AuthorProfile, ContactInfo, CvDocument, decodeHtmlEntities(), EducationItem, ExperienceItem, fetchActiveCvDocument(), fetchAuthorProfile() (+48 more)

### Community 1 - "eslint & Related"
Cohesion: 0.04
Nodes (47): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-svelte, globals, devDependencies, eslint, eslint-config-prettier (+39 more)

### Community 3 - "fetchActiveCvDocument() & Related"
Cohesion: 0.11
Nodes (26): apiError(), AttemptRecord, attempts, checkLoginLockout(), clearLoginAttempts(), pruneOld(), recordFailedLogin(), getSupabaseAdminClient() (+18 more)

### Community 4 - "CLAUDE.md & Related"
Cohesion: 0.07
Nodes (26): Agent/skills tooling, Architecture, Code style, Commands, Components (`src/lib`), Data layer, Git workflow, graphify (+18 more)

### Community 5 - "openapi.ts & Related"
Cohesion: 0.11
Nodes (11): authorSubResourceSchema, blogPostDetailSchema, blogPostSummarySchema, commentSchema, errorResponses, errorSchema, formatParam, openapiSpec (+3 more)

### Community 6 - "feedback-issue-template.md & Related"
Cohesion: 0.12
Nodes (14): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Making and Committing Schema Changes, Option A: Declarative schemas (+6 more)

### Community 7 - "_contributing.md & Related"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 8 - "data-batch-inserts.md & Related"
Cohesion: 0.13
Nodes (11): Batch INSERT Statements for Bulk Data, ANY Array Filtering, Eliminate N+1 Queries with Batch Loading, N+1 Query Problem, Multi-Column Keyset Sorting, OFFSET Pagination Performance Degradation, Use Cursor-Based Pagination Instead of OFFSET, Check-then-Insert Race Condition (+3 more)

### Community 9 - ".mcp.json & Related"
Cohesion: 0.14
Nodes (14): bunx, npx, python, chrome-devtools, cloudflare-observability, context7, github, graphify (+6 more)

### Community 10 - "node & Related"
Cohesion: 0.14
Nodes (13): node, ./.svelte-kit/tsconfig.json, compilerOptions, allowJs, checkJs, forceConsistentCasingInFileNames, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 12 - "@aws-sdk/client-s3 & Related"
Cohesion: 0.15
Nodes (13): @aws-sdk/client-s3, bootstrap-icons, marked, dependencies, @aws-sdk/client-s3, bootstrap-icons, highlight.js, marked (+5 more)

### Community 13 - "Anti-Patterns to Avoid & Related"
Cohesion: 0.17
Nodes (12): Anti-Patterns to Avoid, Confirm dynamically when you can, Core Principles, Coverage and prior runs, Defense-in-depth gaps are not vulnerabilities, Determine the baseline dynamically, Only report what you can exploit, Platform terminology (+4 more)

### Community 14 - "consentStore.svelte.ts"
Cohesion: 0.22
Nodes (7): ConsentSignals, ConsentStatus, consentStore, RetentionPeriod, RetentionSettings, StreamInfo, Window

### Community 15 - "utils/turnstile.ts"
Cohesion: 0.18
Nodes (3): turnstileSiteKey, TurnstileWidgetOptions, Window

### Community 16 - "routes/+page.svelte & Related"
Cohesion: 0.18
Nodes (3): openShareDialog(), shareBlogPostDialog(), shareProjectDialog()

### Community 17 - "admin/index.ts & Related"
Cohesion: 0.24
Nodes (11): CORS_HEADERS, getR2Client(), handleCvDelete(), handleCvUpload(), jsonResponse(), R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET_NAME (+3 more)

### Community 18 - "Attack Classes Overview & Related"
Cohesion: 0.18
Nodes (11): Attack Classes Overview, Memory Safety Binary Kernel Hunting, HTTP Protocol and Auth Hunting, Agent and tool-calling attack classes (subagent_type: `general`), AI, LLM, and Agent Hunting, Core discipline (include in every agent prompt for this domain), Output-handling and disclosure attack classes (subagent_type: `general`), Prompt-injection attack classes (subagent_type: `general`) (+3 more)

### Community 19 - "package.json & Related"
Cohesion: 0.18
Nodes (10): exports, license, name, private, sideEffects, svelte, type, types (+2 more)

### Community 20 - "app.d.ts & Related"
Cohesion: 0.18
Nodes (6): App, Error, Platform, R2Bucket, R2Object, RateLimit

### Community 21 - "HUNTING.md & Related"
Cohesion: 0.20
Nodes (8): Hunting methodology — include in every Phase 2 agent prompt, Phase 2: Hunt for vulnerabilities, Vulnerability Hunting, Phase 3: Validate findings, Phase 4: Report, Phase 5: Structured output and schema check, Phase 6: Independent verification, Validation, Reporting, and Verification

### Community 22 - "_sections.md & Related"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 23 - "scripts & Related"
Cohesion: 0.20
Nodes (10): scripts, build, check, check:watch, dev, format, lint, prepack (+2 more)

### Community 24 - "README.md & Related"
Cohesion: 0.20
Nodes (9): Build for Production, Code Quality Checks, Configure Environment Variables, Get Started, Install Dependencies, License, Prerequisites, Preview Production Build (+1 more)

### Community 26 - "toastStore.svelte.ts"
Cohesion: 0.24
Nodes (9): error(), formatToastMessage(), message, show(), success(), toastStore, ToastType, type (+1 more)

### Community 27 - "formatters.ts & Related"
Cohesion: 0.29
Nodes (6): formatRelativeTime(), getRelativeTimeNextUpdateMs(), matchRelativeUnit(), RELATIVE_UNITS, RelativeUnit, toDate()

### Community 28 - "Client-Side and Browser Hunting & Related"
Cohesion: 0.22
Nodes (9): Client-Side and Browser Hunting, Client-side trust and messaging attack classes (subagent_type: `general`), Core discipline (include in every agent prompt for this domain), DOM-based injection attack classes (subagent_type: `general`), Prototype pollution attack classes (subagent_type: `general`), UI-redress and navigation attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here) (+1 more)

### Community 29 - "supabase-postgres-best-practices/CHANGELOG.md & Related"
Cohesion: 0.44
Nodes (8): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Changelog, Features

### Community 30 - "[slug]/+page.server.ts"
Cohesion: 0.36
Nodes (8): injectHeadingIds(), parseMarkdownAlerts(), renderMarkdown(), BlogComment, estimateReadTime(), getRelatedWindow(), load(), RelatedPost

### Community 32 - "validate-findings.cjs & Related"
Cohesion: 0.36
Nodes (7): collect(), findDiscriminator(), fs, path, schemaPath, typeOf(), validate()

### Community 33 - "supabase/CHANGELOG.md & Related"
Cohesion: 0.46
Nodes (7): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), Bug Fixes, Changelog, Features

### Community 35 - "tailwindcss & Related"
Cohesion: 0.25
Nodes (8): keywords, farhan, farhan kurnia pratama, kurnia, pratama, svelte, sveltekit, tailwindcss

### Community 36 - "[slug]/+page.svelte"
Cohesion: 0.14
Nodes (3): themeStore, Theme, ./$types

### Community 37 - "Cookie Consent Default (Google Consent Mode v2) Script & Related"
Cohesion: 0.29
Nodes (8): Cookie Consent Default (Google Consent Mode v2) Script, Blocking Dark-Mode Default Script, SvelteKit Root HTML Shell (app.html), Favicon/Manifest Links to cdn.fkp.my.id, Google Fonts Preconnect + Stylesheet, Google Tag Manager Loader (GTM-TSBRHB6V), Consent Store (fkp_cookie_consent_v2), themeStore.init() (theme store correction call)

### Community 39 - "Force Row Level Security for Table Owners & Related"
Cohesion: 0.38
Nodes (5): Force Row Level Security for Table Owners, Security Definer Functions for RLS Lookups, Supabase Security Pitfalls Checklist, Enable Row Level Security for Multi-Tenant Data, Optimize RLS Policies for Performance

### Community 40 - "Core discipline (include in every agent prompt for this domain) & Related"
Cohesion: 0.29
Nodes (7): Core discipline (include in every agent prompt for this domain), Kernel & privileged-interface attack classes (subagent_type: `general`), Memory-safety attack classes (subagent_type: `general`), Memory Safety, Binary, and Kernel Hunting, Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 41 - "Authentication-protocol attack classes (subagent_type: `general`) & Related"
Cohesion: 0.29
Nodes (7): Authentication-protocol attack classes (subagent_type: `general`), Core discipline (include in every agent prompt for this domain), HTTP-Protocol and Authentication Hunting, HTTP request-framing attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 44 - "supabaseFunctions.ts & Related"
Cohesion: 0.52
Nodes (4): getSupabaseBaseUrl(), proxyToSupabaseEdgeFunction(), POST(), POST()

### Community 45 - "conn-limits.md & Related"
Cohesion: 0.33
Nodes (3): Set Appropriate Connection Limits, Use Connection Pooling for All Applications, Use Prepared Statements Correctly with Pooling

### Community 46 - "supabase-postgres-best-practices/SKILL.md & Related"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 48 - "svelte & Related"
Cohesion: 0.33
Nodes (6): svelte, svelte, peerDependencies, svelte, @sveltejs/kit, @sveltejs/kit

### Community 49 - "SECURITY.md & Related"
Cohesion: 0.33
Nodes (5): Recognition, Reporting a Vulnerability, Scope, Security Policy, What to Expect

### Community 50 - "hooks.server.ts & Related"
Cohesion: 0.33
Nodes (4): handle, handleError, rateLimitMap, RateLimitRecord

### Community 51 - "useFilterSort.svelte.ts & Related"
Cohesion: 0.33
Nodes (4): ActiveFilterChip, FilterSortOptions, FilterSortStore, SortState

### Community 52 - "FUNDING.yml Sponsorship Configuration & Related"
Cohesion: 0.40
Nodes (5): FUNDING.yml Sponsorship Configuration, GitHub Sponsors (farhnkrnapratma), Ko-fi (farhnkrnapratma), Open Collective (farhnkrnapratma), farhnkrnapratma (project owner identity)

### Community 54 - "Phase 2 Vulnerability Hunting & Related"
Cohesion: 0.67
Nodes (4): Phase 2 Vulnerability Hunting, Phase 1 Reconnaissance, Security Audit Skill Workflow, Phase 3 Findings Validation

### Community 55 - "Supabase Agent Skills Changelog & Related"
Cohesion: 0.50
Nodes (4): Supabase Agent Skills Changelog, Supabase Core Integration Principles, Supabase Agent Skill Overview, Web Application Tech Stack

### Community 56 - "Application-Level Advisory Locks & Related"
Cohesion: 0.50
Nodes (4): Application-Level Advisory Locks, Consistent Lock Ordering Deadlock Prevention, Short Transaction Scope Strategy, Non-Blocking Queue Processing via FOR UPDATE SKIP LOCKED

### Community 57 - "Query Profiling with EXPLAIN ANALYZE & Related"
Cohesion: 0.50
Nodes (4): Query Profiling with EXPLAIN ANALYZE, Query Performance Tracking with pg_stat_statements, Table Maintenance & Statistics via VACUUM and ANALYZE, Declarative Range Table Partitioning Strategy

### Community 58 - "api-contract-check/SKILL.md & Related"
Cohesion: 0.50
Nodes (3): API contract check, Output, Steps

### Community 59 - "create-migration/SKILL.md & Related"
Cohesion: 0.50
Nodes (3): Create migration, Output, Steps

### Community 60 - "ui-consistency-check/SKILL.md & Related"
Cohesion: 0.50
Nodes (3): Output, Steps, UI consistency check

### Community 61 - "files & Related"
Cohesion: 0.50
Nodes (4): files, dist, !dist/**/*.spec.*, !dist/**/*.test.*

### Community 62 - "Postgres Rule Section Definitions & Related"
Cohesion: 0.67
Nodes (3): Postgres Rule Section Definitions, Supabase Postgres Best Practices Skill, Postgres Optimization Categories

### Community 64 - "Cursor-Based Pagination (Keyset Pagination) & Related"
Cohesion: 0.67
Nodes (3): Cursor-Based Pagination (Keyset Pagination), WHERE Clause and JOIN Column Indexing, Foreign Key Column Indexing for JOINs and Cascades

### Community 65 - "Composite Multi-Column Indexing Strategy & Related"
Cohesion: 0.67
Nodes (3): Composite Multi-Column Indexing Strategy, Covering Indexes with INCLUDE Clause, Filtered Partial Indexing Strategy

### Community 67 - "cn"
Cohesion: 0.67
Nodes (3): cn(), familyOf(), TEXT_SIZE_KEYWORDS

### Community 151 - "codeBlocks.ts"
Cohesion: 0.60
Nodes (4): enhanceCodeBlocks(), getPrettyLanguage(), LANGUAGE_NAMES, splitHighlightedHtmlLines()

## Ambiguous Edges - Review These
- `Blocking Dark-Mode Default Script` → `themeStore.init() (theme store correction call)`  [AMBIGUOUS]
  src/app.html · relation: references

## Knowledge Gaps
- **349 isolated node(s):** `fs`, `path`, `schemaPath`, `block-bad-commit.sh script`, `block-sensitive-file-edits.sh script` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **74 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Blocking Dark-Mode Default Script` and `themeStore.init() (theme store correction call)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `devDependencies` connect `eslint & Related` to `svelte & Related`, `package.json & Related`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `supabase` connect `author.ts` to `fetchActiveCvDocument() & Related`, `[slug]/+page.server.ts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `dependencies` connect `@aws-sdk/client-s3 & Related` to `package.json & Related`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `schemaPath` to the rest of the system?**
  _349 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `author.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05981012658227848 - nodes in this community are weakly interconnected._
- **Should `eslint & Related` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._