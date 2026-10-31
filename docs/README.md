# Documentation

Documentation for Idstead, a self-hostable personal site and identity home. The project overview is the root [README.md](../README.md). Every page here is numbered, so the folders and files sort in reading order. Examples use `example.com` for the site, `admin.example.com` for the admin portal and `api.example.com` for the API, and the default resource names from `idstead.example.jsonc` (`idstead-web`, `idstead-newsletter`, and so on).

## 001 Getting started

| Page | Covers |
| --- | --- |
| [001-getting-started/](001-getting-started/README.md) | What you need, the environment variables, and what is left after setup |
| [001-setup-script.md](001-getting-started/001-setup-script.md) | `bun run setup`: the dry run, `apply`, the answers file and each step |
| [002-ai-agent.md](001-getting-started/002-ai-agent.md) | Letting an AI coding agent run the setup through the `setup-idstead` skill |
| [003-manual-setup.md](001-getting-started/003-manual-setup.md) | The same steps by hand |

## 002 Configuration

| Page | Covers |
| --- | --- |
| [001-instance.md](002-configuration/001-instance.md) | `idstead.jsonc`: domains, Cloudflare resource names, cron, and `bun run configure` |
| [002-environment.md](002-configuration/002-environment.md) | Every environment variable and binding, per app |

## 003 Architecture

[003-architecture/](003-architecture/README.md) holds eleven low-level diagrams, from the browser through Cloudflare to D1 and R2. Each one names the source files it was verified against.

## 004 Public API

| Page | Covers |
| --- | --- |
| [004-api/](004-api/README.md) | Versions and versioning policy |
| [001-v1/](004-api/001-v1/README.md) | `api.example.com/v1`: [parameters](004-api/001-v1/001-parameters.md), [errors](004-api/001-v1/002-errors.md), [blog](004-api/001-v1/003-blog.md), [author & resume](004-api/001-v1/004-author.md), [search](004-api/001-v1/005-search.md), [discovery](004-api/001-v1/006-discovery.md) |
| [002-ard.md](004-api/002-ard.md) | `example.com/api/ard` (Agent Registry Discovery, unversioned) |

## 005 Development

| Page | Covers |
| --- | --- |
| [001-local-setup.md](005-development/001-local-setup.md) | Install, environment variables, dev servers, everyday commands |
| [002-testing.md](005-development/002-testing.md) | Test suite map, the live API suite, coverage gaps |
| [003-scripts-and-tooling.md](005-development/003-scripts-and-tooling.md) | `tooling/` hooks, plugins and the setup script |

## 006 Operations

| Page | Covers |
| --- | --- |
| [001-deployment.md](006-operations/001-deployment.md) | Workers Builds, environments, bindings, migrations |
| [002-newsletter.md](006-operations/002-newsletter.md) | Subscription lifecycle, queue delivery, recovery procedures |

## 007 Security

[007-security.md](007-security.md) covers the trust boundaries, admin MFA, request integrity, data access and headers. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## 008 MDRS (Markdown syntax)

[008-mdrs/](008-mdrs/README.md) documents MDRS, the Markdown Rich Syntax every post and legal page is written in. [SHOWCASE.md](008-mdrs/SHOWCASE.md) is a draft post that uses every feature. MDRS will move to its own repository; until then its documentation lives here.

| Part | Covers |
| --- | --- |
| [001-markdown/](008-mdrs/README.md#part-1-standard-markdown) | Standard CommonMark + GFM: headings, emphasis, links, lists, tables, code, footnotes, raw HTML |
| [002-extensions/](008-mdrs/README.md#part-2-mdrs-extensions) | Frontmatter, directives, callouts, details, tabs, steps, code block options, task states, media, math, diagrams, charts, references, variables, live data, conditionals, escaping |
| [003-reference/](008-mdrs/README.md#part-3-reference) | [Compatibility](008-mdrs/003-reference/001-compatibility.md), [rendering pipeline](008-mdrs/003-reference/002-rendering-pipeline.md), [styling](008-mdrs/003-reference/003-styling.md), [roadmap](008-mdrs/003-reference/004-roadmap.md) |

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md): branching, commits and checks.
- `CLAUDE.md`: conventions for Claude Code, the coding agent this repository is set up for.

## Keeping docs accurate

- Describe what the code does now, and name the source files so the next editor can re-verify.
- Write for any instance: use `example.com` and the default resource names, never one particular site's domain or Worker names.
- Name every file and folder under `docs/` with a three-digit position and a kebab-case name (`001-overview.md`, `002-configuration/`). Each folder counts from `001` with no gaps. Only `README.md` (the folder index) and `SHOWCASE.md` are exempt. To insert a page, renumber the ones after it and update their links. `tests/docsLayout.test.ts` checks the names, the numbering and every relative link and anchor.
- Check the Mermaid diagrams with `bunx @mermaid-js/mermaid-cli@11 -i <file> -o /tmp/out.md` before committing.
- When an API route changes, update `packages/lib/src/openapi.ts`, `apps/api/src/README.md` and `docs/004-api/001-v1/` together.
