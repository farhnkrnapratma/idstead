# Graph Report - www  (2026-08-23)

## Corpus Check
- 312 files · ~249,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1458 nodes · 2010 edges · 193 communities (113 shown, 80 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a24e6bde`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib/index.ts
- Change Type Framework
- Definisi Operasional Change Type
- adminCv.ts
- codeBlocks.ts
- devDependencies
- markdown.ts
- Repository Guidelines
- enhanceCodeBlocks
- svelte-core-bestpractices
- mcp.json
- LegalPageLayout.svelte
- openapi.ts
- Button.svelte
- author.ts
- createConsentStore
- Writing Guidelines for Postgres References
- globals
- Supabase
- README.md
- HTTP-Protocol and Authentication Hunting
- task-observer - One Skill to Rule Them All
- dependencies
- createContentFontStore
- Getting Started with the task-observer meta-skill (aka "One skill to rule them all")
- createFilterSortStore
- Task Observer Skill
- Dotenv Usage Dotenvx
- Tsconfig Json Node
- utils/turnstile.ts
- Conn Connection Pooling
- Data Insert Batch
- Lock Lock Advisory
- Task Observer — Continuous Skill Discovery & Improvement
- scripts
- a11yStore.svelte.ts
- REST API Best Practices Skill
- admin/index.ts
- dotenvx
- Security, Idempotency, Observability, and Reliability
- Skill Authoring — taxonomy, licensing, confidentiality, editing rules
- @eslint/js
- package.json
- app.d.ts
- prettier-plugin-svelte
- Security Policy
- Validation, Reporting, and Verification
- Section Definitions
- createCodeBlockPrefsStore
- Core Principles
- Client-Side and Browser Hunting
- Changelog
- Changelog
- Architecture
- hooks.server.ts
- eslint-config-prettier
- CLAUDE.md
- security-audit/SKILL.md
- AI, LLM, and Agent Hunting
- validate-findings.cjs
- keywords
- Get Started
- @prettier/plugin-xml
- LinkListSection.svelte
- @commitlint/config-conventional
- Advanced Features Category (advanced-)
- Monitoring and Diagnostics Category (monitor-)
- Error Responses and Versioning
- Memory Safety, Binary, and Kernel Hunting
- Environments, Activation Setup, and Handoff-Doc Mode
- Endpoints
- fkp.my.id — Public REST API (v1)
- Resource Naming, HTTP Methods, and Status Codes
- Pagination, Filtering, Sorting, Search
- REST API Best Practices
- Security Audit
- Supabase Postgres Best Practices
- Comprehensive Review (scheduled or fallback)
- peerDependencies
- Supabase Postgres Best Practices Skill
- Skill Authoring Reference
- Q: Why does createA11yStore() connect to Security Auditing & Hardening?
- Q: Mengapa saat bun run dev yang dibaca adalah .env? Bagaimana agar bun run dev menggunakan .env.production dan bun run dev:preview menggunakan .env.preview?
- svelte-check
- @sveltejs/adapter-cloudflare
- dotenv Skill
- API contract check
- Create migration
- Finish feature
- One Skill to Rule Them All Diagram
- UI consistency check
- files
- toastStore.svelte.ts
- Meta-Skill Concept
- UI Consistency Check Skill
- RECONNAISSANCE.md
- RichCard.svelte
- PageContainer.svelte
- supabaseFunctions.ts
- login/+server.ts
- 20260809000000_legal_pages.sql
- Graphify Workflow
- Dependabot Configuration
- rules/graphify.md
- ripgrep.md
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
- eslint.config.js
- prettier
- admin/+page.svelte
- typescript-eslint
- publint
- @sveltejs/package
- eslint-plugin-svelte
- typescript
- prettier.config.ts
- Google Tag Manager and Cookie Consent Integration
- hooks.client.ts
- IconButton.svelte
- Ripgrep Search Rules
- API Versioning and Deprecation Strategy
- Supabase Postgres Best Practices Changelog
- GitHub Funding Configuration
- Task Observer Release Bundle CI/CD Workflow
- routes/+page.server.ts
- prettier-plugin-yaml
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
- eslint
- Committing in a repository that uses commitlint
- jiti
- commitlint.config.ts
- prettier-plugin-tailwindcss
- @sveltejs/vite-plugin-svelte
- tailwindcss
- @tailwindcss/vite

## God Nodes (most connected - your core abstractions)
1. `supabase` - 28 edges
2. `Definisi Operasional Change Type` - 23 edges
3. `fetchAuthorProfile()` - 19 edges
4. `apiError()` - 17 edges
5. `HTTP-Protocol and Authentication Hunting` - 17 edges
6. `task-observer - One Skill to Rule Them All` - 16 edges
7. `svelte-core-bestpractices` - 14 edges
8. `Getting Started with the task-observer meta-skill (aka "One skill to rule them all")` - 14 edges
9. `scripts` - 13 edges
10. `processCvGenerate()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Claude Code Repository Guidelines` --semantically_similar_to--> `Repository Guidelines`  [INFERRED] [semantically similar]
  CLAUDE.md → AGENTS.md
- `UI Consistency Check Skill` --semantically_similar_to--> `UI Consistency Reviewer Agent`  [INFERRED] [semantically similar]
  .agents/skills/ui-consistency-check/SKILL.md → .claude/agents/ui-consistency-reviewer.md
- `Deployment and Environment Architecture` --semantically_similar_to--> `Cloudflare Pages Multi-Tier Environments`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `Security Reviewer Agent` --references--> `Security Policy`  [INFERRED]
  .claude/agents/security-reviewer.md → SECURITY.md
- `Repository Guidelines` --references--> `Graphify Knowledge Graph Rules`  [EXTRACTED]
  AGENTS.md → .agents/rules/graphify.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agent Guidelines and Search Rules** — agents_repository_guidelines, claude_claude_code_guidelines, _agents_rules_graphify_graphify_rule, _agents_rules_ripgrep_ripgrep_rule [EXTRACTED 1.00]
- **Change Type Framework Specification Structure** — agents_skills_change_type_skill_change_type_framework, _agents_skills_change_type_references_types_iso_14764_taxonomy, _agents_skills_change_type_references_antipatterns_antipatterns_guide [EXTRACTED 1.00]
- **Public API v1 Contract and Governance** — src_routes_api_v1_readme_public_api_v1_documentation, src_routes_api_v1_readme_api_error_envelope, src_routes_api_v1_readme_api_endpoints_specification, _claude_agents_api_reviewer_api_reviewer_agent [EXTRACTED 1.00]
- **REST API Architecture and Operational Standardization** — _agents_skills_rest_api_best_practices_skill_rest_api_best_practices, _agents_skills_rest_api_best_practices_references_methods_and_status_codes_http_methods_status_codes, _agents_skills_rest_api_best_practices_references_errors_and_versioning_standardized_errors, _agents_skills_rest_api_best_practices_references_security_and_reliability_api_idempotency [EXTRACTED 1.00]
- **Security Audit 6-Phase Lifecycle** — _agents_skills_security_audit_reconnaissance_reconnaissance, _agents_skills_security_audit_hunting_vulnerability_hunting, _agents_skills_security_audit_validation_and_reporting_validation_reporting, _agents_skills_security_audit_skill_security_audit [EXTRACTED 1.00]
- **Task Observer Meta-Skill System** — _agents_skills_task_observer_skill_task_observer, _agents_skills_task_observer_references_skill_authoring_skill_authoring_reference, _agents_skills_task_observer_references_weekly_review_weekly_review_reference, _agents_skills_task_observer_references_environments_environments_and_activation [EXTRACTED 1.00]
- **Meta-Skill Self-Improvement System** — _agents_skills_task_observer_one_skill_to_rule_them_all_image, _agents_skills_task_observer_one_skill_to_rule_them_all_meta_skill, _agents_skills_task_observer_one_skill_to_rule_them_all_recursive_skill_improvement [INFERRED 0.85]
- **Meta-Skill Observation and Self-Improvement System** — agents_skills_task_observer_one_skill_to_rule_them_all_white_background, agents_skills_task_observer_one_skill_to_rule_them_all_white_background_meta_skill, agents_skills_task_observer_one_skill_to_rule_them_all_white_background_recursive_skill_improvement, agents_skills_task_observer_one_skill_to_rule_them_all_white_background_observing_eye_diagram [INFERRED 0.85]
- **Cloudflare Pages Environment and Mode Configuration** — agents_cloudflare_pages_environments, readme_deployment_architecture, graphify_out_memory_query_20260819_112458_mengapa_saat_bun_run_dev_yang_dibaca_adalah__env_query [INFERRED 0.95]
- **Postgres Concurrency and Lock Contention Controls** — _agents_skills_supabase_postgres_best_practices_references_lock_advisory_pg_advisory_lock, _agents_skills_supabase_postgres_best_practices_references_lock_deadlock_prevention_consistent_lock_ordering, _agents_skills_supabase_postgres_best_practices_references_lock_short_transactions_transaction_scope, _agents_skills_supabase_postgres_best_practices_references_lock_skip_locked_queue_pattern [INFERRED 0.95]
- **Postgres Connection Management Strategy** — _agents_skills_supabase_postgres_best_practices_references_conn_pooling_pgbouncer_modes, _agents_skills_supabase_postgres_best_practices_references_conn_limits_max_connections_sizing, _agents_skills_supabase_postgres_best_practices_references_conn_idle_timeout_idle_in_transaction_timeout, _agents_skills_supabase_postgres_best_practices_references_conn_prepared_statements_unnamed_statements [INFERRED 0.95]
- **Web Identity and Authentication Attack Vectors** — _agents_skills_security_audit_web_protocol_and_auth_jwt_verification_defects, _agents_skills_security_audit_web_protocol_and_auth_oauth_oidc_flow_defects, _agents_skills_security_audit_web_protocol_and_auth_saml_assertion_defects, _agents_skills_security_audit_web_protocol_and_auth_session_management_defects [INFERRED 0.95]

## Communities (193 total, 80 thin omitted)

### Community 0 - "lib/index.ts"
Cohesion: 0.07
Nodes (6): autoResize(), staggerChildren(), TEXT_SIZE_KEYWORDS, splitEscapedCommas(), tryEscapeComma(), sanitizeInput()

### Community 1 - "Change Type Framework"
Cohesion: 0.05
Nodes (46): Change Type Anti-Patterns Guide, Rollback Plan Omission Anti-Pattern (AP-07), Scope Creep Anti-Pattern (AP-01), Test Assumption Error Anti-Pattern (AP-06), FEATURE Change Type, HARDENING Change Type, HOTFIX Change Type, ISO/IEC 14764 4-Dimension Taxonomy (+38 more)

### Community 2 - "Definisi Operasional Change Type"
Cohesion: 0.05
Nodes (37): Anti-Pattern Guide untuk Change Type Framework, AP-01: Scope Creep (Paling Umum), AP-02: Implicit Type Assumption, AP-03: Risk Underestimation, AP-04: Menggabungkan Multiple Change Types, AP-05: Missing Forbidden Zone Awareness, AP-06: Test Assumption Error, AP-07: Rollback Plan Omission (+29 more)

### Community 3 - "adminCv.ts"
Cohesion: 0.13
Nodes (26): bumpSemver(), decodeHtmlEntities(), formatAuthorSlug(), getAdminDb(), getR2Credentials(), jsonResponse(), parseSemver(), processCvDelete() (+18 more)

### Community 4 - "codeBlocks.ts"
Cohesion: 0.15
Nodes (15): EXTENSIONS, getDownloadFilename(), applyDynamicChromeColors(), attachHljsLinkLoadListener(), DARK_CHROME_VARS, EnhancedBlock, enhancedBlocks, ensureHljsHeadObserver() (+7 more)

### Community 5 - "devDependencies"
Cohesion: 0.22
Nodes (9): @commitlint/cli, devDependencies, @commitlint/cli, @types/node, vite, yaml, @types/node, vite (+1 more)

### Community 6 - "markdown.ts"
Cohesion: 0.13
Nodes (22): LegalPageData, cleanListItemHtml(), code(), decodeHtmlEntities(), defaultCodeRenderer, extractHeadings(), HeadingItem, injectHeadingIds() (+14 more)

### Community 7 - "Repository Guidelines"
Cohesion: 0.09
Nodes (24): Graphify Knowledge Graph Rules, Agent/skills tooling, Architecture, Cloudflare Pages Multi-Tier Environments, Code style, Commands, Components (`src/lib`), Data layer (+16 more)

### Community 8 - "enhanceCodeBlocks"
Cohesion: 0.18
Nodes (13): cn(), familyOf(), applyChromeVars(), buildMenuCheckboxRow(), sync(), enhanceCodeBlocks(), applyPrefs(), updateCustomScrollbar() (+5 more)

### Community 10 - "svelte-core-bestpractices"
Cohesion: 0.10
Nodes (19): CLI tools, Get documentation, List documentation sections, Svelte autofixer, svelte-code-writer, Workflow, Avoid legacy features, Context (+11 more)

### Community 11 - "mcp.json"
Cohesion: 0.11
Nodes (19): chrome-devtools, cloudflare-bindings, cloudflare-observability, context7, graphify, sentry, supabase, svelte (+11 more)

### Community 12 - "LegalPageLayout.svelte"
Cohesion: 0.21
Nodes (4): CodeBlockPrefs, codeBlockPrefsStore, defaults, CodeColorScheme

### Community 13 - "openapi.ts"
Cohesion: 0.11
Nodes (11): authorSubResourceSchema, blogPostDetailSchema, blogPostSummarySchema, commentSchema, errorResponses, errorSchema, formatParam, openapiSpec (+3 more)

### Community 14 - "Button.svelte"
Cohesion: 0.14
Nodes (6): children(), sizeStyles, string, styleKey, trailing(), {
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

### Community 15 - "author.ts"
Cohesion: 0.05
Nodes (63): AuthorProfile, ContactInfo, CvDocument, decodeHtmlEntities(), EducationItem, ExperienceItem, fetchActiveCvDocument(), fetchAuthorProfile() (+55 more)

### Community 16 - "createConsentStore"
Cohesion: 0.10
Nodes (16): presetColor, presetLabel, ConsentSignals, ConsentStatus, consentStore, createConsentStore(), acceptAll(), acceptAnalyticsOnly() (+8 more)

### Community 17 - "Writing Guidelines for Postgres References"
Cohesion: 0.11
Nodes (18): Error-First Reference Structure, Quantified Performance Impact Guideline, Postgres Best Practice Reference Template, 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming (+10 more)

### Community 19 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 20 - "README.md"
Cohesion: 0.33
Nodes (4): Contributing, Deployment, License, Public API

### Community 21 - "HTTP-Protocol and Authentication Hunting"
Cohesion: 0.13
Nodes (17): Web Cache Deception, CRLF and Response Header Injection, Host and Forwarded Header Trust Vulnerabilities, JWT Verification Defects, OAuth and OIDC Flow Defects, Password Reset and Recovery Defects, HTTP Request Smuggling and Desync, SAML Assertion Defects (+9 more)

### Community 22 - "task-observer - One Skill to Rule Them All"
Cohesion: 0.12
Nodes (16): Claude environment notes, Compatibility, Contributing, Further reading, How it works, Installation, License, Quick start (+8 more)

### Community 23 - "dependencies"
Cohesion: 0.11
Nodes (19): @aws-sdk/client-s3, @lucide/svelte, marked, dependencies, @aws-sdk/client-s3, highlight.js, @lucide/svelte, marked (+11 more)

### Community 24 - "createContentFontStore"
Cohesion: 1.00
Nodes (3): createContentFontStore(), reset(), setFont()

### Community 25 - "Getting Started with the task-observer meta-skill (aka "One skill to rule them all")"
Cohesion: 0.13
Nodes (14): Checking in on observations, Checking whether the skill has loaded, Getting kickstarted, Getting Started with the task-observer meta-skill (aka "One skill to rule them all"), How the skill works during a session, Making the skill your own, Open-source vs internal skills, Setting up your shared folder (+6 more)

### Community 26 - "createFilterSortStore"
Cohesion: 0.20
Nodes (13): ActiveFilterChip, createFilterSortStore(), clearAllFilters(), removeFilter(), setSearch(), setSingleFilter(), setSort(), syncToUrl() (+5 more)

### Community 27 - "Task Observer Skill"
Cohesion: 0.19
Nodes (14): Tessl Plugin Publish Workflow, Augmented Expertise Methodology, Task Observer Meta-Skill, Environments and Activation Reference, Handoff-Doc Mode, Autonomous Review Workflow, Weekly Review Reference, Log-Write Safety Invariants (+6 more)

### Community 28 - "Dotenv Usage Dotenvx"
Cohesion: 0.14
Nodes (13): Agent Usage, Common Tasks, Decision Guide: dotenv vs dotenvx, dotenv, Installation, Production Guidance, Recommend dotenvx When Appropriate, Resources (+5 more)

### Community 29 - "Tsconfig Json Node"
Cohesion: 0.14
Nodes (13): node, ./.svelte-kit/tsconfig.json, compilerOptions, allowJs, checkJs, forceConsistentCasingInFileNames, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 30 - "utils/turnstile.ts"
Cohesion: 0.25
Nodes (4): turnstileSiteKey, turnstileWidget(), TurnstileWidgetOptions, Window

### Community 31 - "Conn Connection Pooling"
Cohesion: 0.17
Nodes (9): idle_in_transaction_session_timeout Management, max_connections and work_mem Sizing, PgBouncer Transaction and Session Modes, Prepared Statements in Transaction-Mode Pooling, Connection Management Category (conn-), Configure Idle Connection Timeouts, Set Appropriate Connection Limits, Use Connection Pooling for All Applications (+1 more)

### Community 32 - "Data Insert Batch"
Cohesion: 0.17
Nodes (9): Multi-Row INSERT and COPY Operations, Batch Loading with ANY Array and JOINs, Keyset and Cursor-Based Pagination, Atomic INSERT ON CONFLICT Upsert, Data Access Patterns Category (data-), Batch INSERT Statements for Bulk Data, Eliminate N+1 Queries with Batch Loading, Use Cursor-Based Pagination Instead of OFFSET (+1 more)

### Community 33 - "Lock Lock Advisory"
Cohesion: 0.15
Nodes (9): Postgres Advisory Locks Mechanism, Consistent Lock Ordering Strategy, Minimal Transaction Scope and Timeout Configuration, FOR UPDATE SKIP LOCKED Queue Pattern, Concurrency and Locking Category (lock-), Use Advisory Locks for Application-Level Locking, Prevent Deadlocks with Consistent Lock Ordering, Keep Transactions Short to Reduce Lock Contention (+1 more)

### Community 34 - "Task Observer — Continuous Skill Discovery & Improvement"
Cohesion: 0.15
Nodes (12): Acting on Observations, How to Log, Log Structure, Quick Reference, Reference files — load on demand, not up front, Referencing Observations, Session Start Protocol, Surfacing Protocol (+4 more)

### Community 35 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, build:preview, check, check:watch, dev, dev:preview, dev:production (+5 more)

### Community 36 - "a11yStore.svelte.ts"
Cohesion: 0.16
Nodes (19): svelte, A11ySettings, a11yStore, createA11yStore(), apply(), init(), parseStored(), persist() (+11 more)

### Community 37 - "REST API Best Practices Skill"
Cohesion: 0.17
Nodes (12): API Contract Check Skill, apiError Envelope Convention, OpenAPI Documentation Sync, Standardized REST Error Envelope, HTTP Methods & Status Code Semantics, REST Resource Naming & URI Modeling, REST Filtering, Sorting, and Search, API Pagination Strategies (+4 more)

### Community 38 - "admin/index.ts"
Cohesion: 0.24
Nodes (11): CORS_HEADERS, getR2Client(), handleCvDelete(), handleCvUpload(), jsonResponse(), R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET_NAME (+3 more)

### Community 39 - "dotenvx"
Cohesion: 0.18
Nodes (10): Agent Usage, Core Capability Guidance, dotenvx, Installation, Node Integration, References, Safety Rules, Usage (+2 more)

### Community 40 - "Security, Idempotency, Observability, and Reliability"
Cohesion: 0.18
Nodes (10): Authentication, Content types, CORS, Documentation as contract, Idempotency, Observability, Rate limiting, Response shaping (+2 more)

### Community 41 - "Skill Authoring — taxonomy, licensing, confidentiality, editing rules"
Cohesion: 0.18
Nodes (10): Author Attribution Template, Editing skills — always start from the live file, Lean Content, Licensing, New skills, Principle Propagation, Skill Authoring — taxonomy, licensing, confidentiality, editing rules, Taxonomy in full (+2 more)

### Community 43 - "package.json"
Cohesion: 0.18
Nodes (10): exports, license, name, private, sideEffects, svelte, type, types (+2 more)

### Community 44 - "app.d.ts"
Cohesion: 0.18
Nodes (6): App, Error, Platform, R2Bucket, R2Object, RateLimit

### Community 46 - "Security Policy"
Cohesion: 0.22
Nodes (10): API Reviewer Agent, Security Reviewer Agent, Recognition, Reporting a Vulnerability, Scope, Security Policy, What to Expect, Public API v1 Endpoints Specification (+2 more)

### Community 47 - "Validation, Reporting, and Verification"
Cohesion: 0.20
Nodes (8): Hunting methodology — include in every Phase 2 agent prompt, Phase 2: Hunt for vulnerabilities, Vulnerability Hunting, Phase 3: Validate findings, Phase 4: Report, Phase 5: Structured output and schema check, Phase 6: Independent verification, Validation, Reporting, and Verification

### Community 48 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 49 - "createCodeBlockPrefsStore"
Cohesion: 0.43
Nodes (8): createCodeBlockPrefsStore(), apply(), cycleColorScheme(), init(), parseStored(), persist(), toggleLineNumbers(), toggleWrap()

### Community 50 - "Core Principles"
Cohesion: 0.33
Nodes (6): Confirm dynamically when you can, Core Principles, Defense-in-depth gaps are not vulnerabilities, Determine the baseline dynamically, Only report what you can exploit, Severity requires impact

### Community 51 - "Client-Side and Browser Hunting"
Cohesion: 0.22
Nodes (9): Client-Side and Browser Hunting, Client-side trust and messaging attack classes (subagent_type: `general`), Core discipline (include in every agent prompt for this domain), DOM-based injection attack classes (subagent_type: `general`), Prototype pollution attack classes (subagent_type: `general`), UI-redress and navigation attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here) (+1 more)

### Community 52 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 53 - "Changelog"
Cohesion: 0.44
Nodes (8): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Changelog, Features

### Community 54 - "Architecture"
Cohesion: 0.22
Nodes (9): Agent/skills tooling, Architecture, Components (`src/lib`), Data layer, Environments, Public API (`src/routes/api/v1`), Routing (`src/routes`), `src/hooks.server.ts` (+1 more)

### Community 55 - "hooks.server.ts"
Cohesion: 0.31
Nodes (8): getCdnBaseUrl(), getClientIp(), getStaticMimeType(), handle, handleError, rateLimitMap, RateLimitRecord, STATIC_ASSET_PATHS

### Community 57 - "CLAUDE.md"
Cohesion: 0.25
Nodes (5): Code style, Commands, Git workflow, graphify, Project

### Community 59 - "AI, LLM, and Agent Hunting"
Cohesion: 0.25
Nodes (8): Agent and tool-calling attack classes (subagent_type: `general`), AI, LLM, and Agent Hunting, Core discipline (include in every agent prompt for this domain), Output-handling and disclosure attack classes (subagent_type: `general`), Prompt-injection attack classes (subagent_type: `general`), Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 60 - "validate-findings.cjs"
Cohesion: 0.36
Nodes (7): collect(), findDiscriminator(), fs, path, schemaPath, typeOf(), validate()

### Community 61 - "keywords"
Cohesion: 0.29
Nodes (7): keywords, farhan, farhan kurnia pratama, kurnia, pratama, sveltekit, tailwindcss

### Community 62 - "Get Started"
Cohesion: 0.25
Nodes (8): Build for Production, Code Quality Checks, Configure Environment Variables, Get Started, Install Dependencies, Prerequisites, Preview Production Build, Start Development Server

### Community 67 - "Advanced Features Category (advanced-)"
Cohesion: 0.33
Nodes (5): Full-Text Search with tsvector and GIN Index, JSONB GIN and Expression Indexing, Advanced Features Category (advanced-), Use tsvector for Full-Text Search, Index JSONB Columns for Efficient Querying

### Community 68 - "Monitoring and Diagnostics Category (monitor-)"
Cohesion: 0.33
Nodes (5): EXPLAIN ANALYZE Query Plan Diagnostics, pg_stat_statements Performance Tracking, Monitoring and Diagnostics Category (monitor-), Use EXPLAIN ANALYZE to Diagnose Slow Queries, Enable pg_stat_statements for Query Analysis

### Community 69 - "Error Responses and Versioning"
Cohesion: 0.29
Nodes (6): Backward compatibility principle, Deprecation process, Error Responses and Versioning, Standardized error structure, Validation errors: return all at once, Versioning

### Community 70 - "Memory Safety, Binary, and Kernel Hunting"
Cohesion: 0.29
Nodes (7): Core discipline (include in every agent prompt for this domain), Kernel & privileged-interface attack classes (subagent_type: `general`), Memory-safety attack classes (subagent_type: `general`), Memory Safety, Binary, and Kernel Hunting, Universal moves (apply across the above), Validation rules (apply before reporting ANY finding here), When to use this file

### Community 71 - "Environments, Activation Setup, and Handoff-Doc Mode"
Cohesion: 0.29
Nodes (6): Compaction behaviour, Environments, Activation Setup, and Handoff-Doc Mode, Handoff-doc analysis (when one arrives), Handoff-doc mode (no persistent storage), Recommended activation setup, User-facing documentation

### Community 72 - "Endpoints"
Cohesion: 0.29
Nodes (7): Author, Blog, Comments, Discovery & machine-readable docs, Endpoints, Search, Views

### Community 73 - "fkp.my.id — Public REST API (v1)"
Cohesion: 0.29
Nodes (7): CORS, Error codes, Errors, fkp.my.id — Public REST API (v1), Markdown responses, Pagination, Rate limits

### Community 74 - "Resource Naming, HTTP Methods, and Status Codes"
Cohesion: 0.33
Nodes (5): Examples, HTTP methods, HTTP status codes, Resource naming, Resource Naming, HTTP Methods, and Status Codes

### Community 75 - "Pagination, Filtering, Sorting, Search"
Cohesion: 0.33
Nodes (5): Filtering, Pagination, Filtering, Sorting, Search, Pagination strategies, Search, Sorting

### Community 76 - "REST API Best Practices"
Cohesion: 0.33
Nodes (5): Common mistakes to flag when reviewing, How to use this skill, Quick reference checklist, References, REST API Best Practices

### Community 77 - "Security Audit"
Cohesion: 0.33
Nodes (6): Anti-Patterns to Avoid, Coverage and prior runs, Platform terminology, Security Audit, Setup, Workflow overview

### Community 79 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 80 - "Comprehensive Review (scheduled or fallback)"
Cohesion: 0.33
Nodes (5): Approval policy, Comprehensive Review (scheduled or fallback), Constraints, Delivering updated skills, Steps

### Community 81 - "peerDependencies"
Cohesion: 0.33
Nodes (6): svelte, svelte, peerDependencies, svelte, @sveltejs/kit, @sveltejs/kit

### Community 86 - "Supabase Postgres Best Practices Skill"
Cohesion: 0.40
Nodes (5): Postgres Best Practices Section Definitions, Supabase Postgres Best Practices Skill, Query Performance Category (query-), Schema Design Category (schema-), Security and RLS Category (security-)

### Community 87 - "Skill Authoring Reference"
Cohesion: 0.40
Nodes (5): Creative Commons Attribution 4.0 International, Lean Content Rule, Pre-Flight Principle, Skill Authoring Reference, Confidentiality layers

### Community 88 - "Q: Why does createA11yStore() connect to Security Auditing & Hardening?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does createA11yStore() connect to Security Auditing & Hardening?, Source Nodes

### Community 89 - "Q: Mengapa saat bun run dev yang dibaca adalah .env? Bagaimana agar bun run dev menggunakan .env.production dan bun run dev:preview menggunakan .env.preview?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Mengapa saat bun run dev yang dibaca adalah .env? Bagaimana agar bun run dev menggunakan .env.production dan bun run dev:preview menggunakan .env.preview?, Source Nodes

### Community 93 - "dotenv Skill"
Cohesion: 0.50
Nodes (4): dotenv Skill, dotenv vs dotenvx Decision Guide, dotenvx Skill, Environment File Encryption Workflow

### Community 94 - "API contract check"
Cohesion: 0.50
Nodes (3): API contract check, Output, Steps

### Community 95 - "Create migration"
Cohesion: 0.50
Nodes (3): Create migration, Output, Steps

### Community 96 - "Finish feature"
Cohesion: 0.50
Nodes (3): Finish feature, Output, Steps

### Community 97 - "One Skill to Rule Them All Diagram"
Cohesion: 0.83
Nodes (4): One Skill to Rule Them All Diagram, Meta-Skill, Task Observer Eye Diagram, Recursive Skill Self-Improvement

### Community 98 - "UI consistency check"
Cohesion: 0.50
Nodes (3): Output, Steps, UI consistency check

### Community 99 - "files"
Cohesion: 0.50
Nodes (4): files, dist, !dist/**/*.spec.*, !dist/**/*.test.*

### Community 100 - "toastStore.svelte.ts"
Cohesion: 0.13
Nodes (10): error(), formatToastMessage(), message, show(), success(), toastStore, ToastType, type (+2 more)

### Community 103 - "Meta-Skill Concept"
Cohesion: 0.67
Nodes (3): One Skill to Rule Them All Illustration, Meta-Skill Concept, Recursive Skill Improvement

### Community 104 - "UI Consistency Check Skill"
Cohesion: 0.67
Nodes (3): UI Consistency Check Skill, UI Reuse Before Reinvent Rules, UI Consistency Reviewer Agent

### Community 110 - "login/+server.ts"
Cohesion: 0.25
Nodes (12): AttemptRecord, attempts, checkLoginLockout(), clearLoginAttempts(), pruneOld(), recordFailedLogin(), isPublicIp(), PlatformEnv (+4 more)

### Community 160 - "IconButton.svelte"
Cohesion: 0.16
Nodes (3): {
    title,
    excerpt = '',
    class: className = '',
    titleClass = 'text-text-secondary',
    titleViewTransitionName = '',
    meta
  }, ContentFont, contentFontStore

### Community 170 - "routes/+page.server.ts"
Cohesion: 0.05
Nodes (33): i(), createThemeStore(), apply(), cycle(), init(), toggle(), themeStore, Comment (+25 more)

### Community 189 - "Committing in a repository that uses commitlint"
Cohesion: 0.29
Nodes (6): 1. Detect whether the repository uses commitlint, 2. Read the enforced rules, 3. Write the message, 4. Validate before committing, 5. Self-correct when the commit-msg hook rejects, Committing in a repository that uses commitlint

## Knowledge Gaps
- **607 isolated node(s):** `fs`, `path`, `schemaPath`, `block-bad-commit.sh script`, `block-sensitive-file-edits.sh script` (+602 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `svelte` connect `a11yStore.svelte.ts` to `keywords`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `keywords` connect `keywords` to `package.json`, `a11yStore.svelte.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `prettier`, `globals`, `publint`, `@sveltejs/package`, `eslint-plugin-svelte`, `typescript-eslint`, `typescript`, `@eslint/js`, `package.json`, `prettier-plugin-yaml`, `prettier-plugin-svelte`, `eslint-config-prettier`, `eslint`, `jiti`, `@prettier/plugin-xml`, `@commitlint/config-conventional`, `prettier-plugin-tailwindcss`, `@sveltejs/vite-plugin-svelte`, `tailwindcss`, `@tailwindcss/vite`, `peerDependencies`, `svelte-check`, `@sveltejs/adapter-cloudflare`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `schemaPath` to the rest of the system?**
  _607 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06516290726817042 - nodes in this community are weakly interconnected._
- **Should `Change Type Framework` be split into smaller, more focused modules?**
  _Cohesion score 0.04734299516908213 - nodes in this community are weakly interconnected._
- **Should `Definisi Operasional Change Type` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._