# Documentation

Developer documentation for example.com. The project overview stays in the root [README.md](../README.md). Every page here is numbered, so the folders and files sort in reading order.

## 001 Architecture

[001-architecture/](001-architecture/README.md) holds eleven low-level diagrams, from the browser through Cloudflare to Supabase. Each one names the source files it was verified against.

## 002 MDRS (Markdown syntax)

[002-mdrs/](002-mdrs/README.md) documents MDRS, the Markdown Rich Syntax every post and legal page is written in. [SHOWCASE.md](002-mdrs/SHOWCASE.md) is a draft post that uses every feature.

| Part | Covers |
| --- | --- |
| [001-markdown/](002-mdrs/README.md#part-1-standard-markdown) | Standard CommonMark + GFM: headings, emphasis, links, lists, tables, code, footnotes, raw HTML |
| [002-extensions/](002-mdrs/README.md#part-2-mdrs-extensions) | Frontmatter, directives, callouts, details, tabs, steps, code block options, task states, media, math, diagrams, charts, references, variables, live data, escaping |
| [003-reference/](002-mdrs/README.md#part-3-reference) | [Compatibility](002-mdrs/003-reference/001-compatibility.md), [rendering pipeline](002-mdrs/003-reference/002-rendering-pipeline.md), [styling](002-mdrs/003-reference/003-styling.md), [roadmap](002-mdrs/003-reference/004-roadmap.md) |

## 003 Public API

| Page | Covers |
| --- | --- |
| [003-api/](003-api/README.md) | Versions and versioning policy |
| [001-v1/](003-api/001-v1/README.md) | `api.example.com/v1`: [parameters](003-api/001-v1/001-parameters.md), [errors](003-api/001-v1/002-errors.md), [blog](003-api/001-v1/003-blog.md), [author & CV](003-api/001-v1/004-author.md), [search](003-api/001-v1/005-search.md), [discovery](003-api/001-v1/006-discovery.md) |
| [002-ard.md](003-api/002-ard.md) | `example.com/api/ard` (Agent Registry Discovery, unversioned) |

## 004 Development

| Page | Covers |
| --- | --- |
| [001-local-setup.md](004-development/001-local-setup.md) | Install, Phase, dev servers, everyday commands |
| [002-environment.md](004-development/002-environment.md) | Every environment variable and binding, per app |
| [003-testing.md](004-development/003-testing.md) | Test suite map, the live API suite, coverage gaps |
| [004-scripts-and-tooling.md](004-development/004-scripts-and-tooling.md) | `scripts/` operations, `tooling/` hooks and plugins |

## 005 Operations

| Page | Covers |
| --- | --- |
| [001-deployment.md](005-operations/001-deployment.md) | Workers Builds, environments, bindings, migrations |
| [002-newsletter.md](005-operations/002-newsletter.md) | Subscription lifecycle, queue delivery, recovery procedures |

## 006 Security

[006-security.md](006-security.md) covers the trust boundaries, admin MFA, request integrity, data access and headers. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md): branching, commits and checks.
- `CLAUDE.md` / `AGENTS.md`: conventions for coding agents.

## Keeping docs accurate

- Describe what the code does now, and name the source files so the next editor can re-verify.
- Name every file and folder under `docs/` with a three-digit position and a kebab-case name (`001-overview.md`, `002-mdrs/`). Each folder counts from `001` with no gaps. Only `README.md` (the folder index) and `SHOWCASE.md` are exempt. To insert a page, renumber the ones after it and update their links. `tests/docsLayout.test.ts` checks the names, the numbering and every relative link and anchor.
- Check the Mermaid diagrams with `bunx @mermaid-js/mermaid-cli@11 -i <file> -o /tmp/out.md` before committing.
- When an API route changes, update `packages/lib/src/openapi.ts`, `apps/api/src/README.md` and `docs/003-api/001-v1/` together.
