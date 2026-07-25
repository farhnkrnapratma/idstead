<!-- @format -->

# Graph Report - . (2026-07-19)

## Corpus Check

- 37 files · ~26,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 196 nodes · 205 edges · 23 communities (19 shown, 4 thin omitted)
- Extraction: 88% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- devDependencies
- $lib/supabase
- package.json
- compilerOptions
- Universed Color Palette Screenshot
- Svelte MCP Server
- +server.ts
- scripts
- dependencies
- www (official website project)
- svelte
- Website Icon / Branding Set
- svelte
- app.d.ts
- eslint.config.js
- prettier.config.ts
- prettier (add-on)

## God Nodes (most connected - your core abstractions)

1. `scripts` - 10 edges
2. `compilerOptions` - 10 edges
3. `$lib/supabase` - 7 edges
4. `Universed Color Palette Screenshot` - 7 edges
5. `Svelte MCP Server` - 6 edges
6. `www (official website project)` - 6 edges
7. `SvelteKit HTML entry template (app.html)` - 6 edges
8. `Hero Image - Personal Profile Banner` - 6 edges
9. `Site Owner / Author Person` - 6 edges
10. `Website Icon / Branding Set` - 6 edges

## Surprising Connections (you probably didn't know these)

- `tailwindcss (add-on)` --conceptually_related_to--> `SvelteKit HTML entry template (app.html)` [INFERRED] /home/hanz/Projects/www/GEMINI.md → /home/hanz/Projects/www/src/app.html
- `SvelteKit HTML entry template (app.html)` --conceptually_related_to--> `Svelte 5 and SvelteKit documentation` [INFERRED] /home/hanz/Projects/www/src/app.html → /home/hanz/Projects/www/GEMINI.md
- `www (official website project)` --conceptually_related_to--> `SvelteKit HTML entry template (app.html)` [INFERRED] /home/hanz/Projects/www/README.md → /home/hanz/Projects/www/src/app.html
- `farhnkrnapratma (GitHub Sponsor)` --conceptually_related_to--> `www (official website project)` [INFERRED] /home/hanz/Projects/www/.github/FUNDING.yml → /home/hanz/Projects/www/README.md
- `TypeScript (project language)` --conceptually_related_to--> `www (official website project)` [EXTRACTED] /home/hanz/Projects/www/GEMINI.md → /home/hanz/Projects/www/README.md

## Import Cycles

- None detected.

## Communities (23 total, 4 thin omitted)

### Community 0 - "devDependencies"

Cohesion: 0.05 Nodes (43): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-svelte, globals, devDependencies, eslint, eslint-config-prettier (+35 more)

### Community 1 - "$lib/supabase"

Cohesion: 0.10 Nodes (10): ./$types, ./layout.css, svelte/reactivity, $lib/supabase, supabase, BlogPost, GitHubRepo, Project (+2 more)

### Community 2 - "package.json"

Cohesion: 0.11 Nodes (18): svelte, exports, files, svelte, keywords, name, peerDependencies, svelte (+10 more)

### Community 3 - "compilerOptions"

Cohesion: 0.14 Nodes (13): node, ./.svelte-kit/tsconfig.json, compilerOptions, allowJs, checkJs, forceConsistentCasingInFileNames, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 4 - "Universed Color Palette Screenshot"

Cohesion: 0.22 Nodes (13): Dark Theme Design, GitHub Handle - @farhnkrnapratma, Hero Image - Personal Profile Banner, Name Text - Farhan Kurnia Pratama, Portrait Photo - Farhan Kurnia Pratama, Website Link - fkp.my.id, Adobe Color - color.adobe.com, Color #D97566 - Terracotta/Coral (+5 more)

### Community 5 - "Svelte MCP Server"

Cohesion: 0.18 Nodes (12): MCP (add-on / Model Context Protocol), Svelte 5 and SvelteKit documentation, Svelte MCP Server, tailwindcss (add-on), MCP Tool: get-documentation, MCP Tool: list-sections, MCP Tool: playground-link, MCP Tool: svelte-autofixer (+4 more)

### Community 6 - "+server.ts"

Cohesion: 0.24 Nodes (10): ./+page.server, $lib/LinkListSection.svelte, $lib/nameValidator, isNameReserved(), normalizeName(), $lib/ShinyText.svelte, FORBIDDEN_WORDS, getCommentDepth() (+2 more)

### Community 7 - "scripts"

Cohesion: 0.20 Nodes (10): scripts, build, check, check:watch, dev, format, lint, prepack (+2 more)

### Community 8 - "dependencies"

Cohesion: 0.22 Nodes (9): bootstrap-icons, dependencies, bootstrap-icons, highlight.js, marked, @supabase/supabase-js, highlight.js, marked (+1 more)

### Community 9 - "www (official website project)"

Cohesion: 0.25 Nodes (9): bun (package manager), TypeScript (project language), Dependabot: bun package ecosystem (weekly updates), Ko-fi: farhnkrnapratma, Open Collective: farhnkrnapratma, farhnkrnapratma (GitHub Sponsor), Bun 1.0+ runtime (prerequisite), MIT License (+1 more)

### Community 10 - "svelte"

Cohesion: 0.25 Nodes (7): mcpServers, svelte, $schema, args, command, @sveltejs/mcp, -y

### Community 11 - "Website Icon / Branding Set"

Cohesion: 0.71 Nodes (7): Android Chrome App Icon 192x192, Android Chrome App Icon 512x512, Apple Touch Icon, Favicon 16x16, Favicon 32x32, Website Icon / Branding Set, Site Owner / Author Person

### Community 12 - "svelte"

Cohesion: 0.50 Nodes (3): npx, svelte, @sveltejs/mcp

## Knowledge Gaps

- **89 isolated node(s):** `$schema`, `command`, `-y`, `@sveltejs/mcp`, `npx` (+84 more) These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?** _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?** _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?** _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `command`, `-y` to the rest of the system?** _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?** _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `$lib/supabase` be split into smaller, more focused modules?** _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?** _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
