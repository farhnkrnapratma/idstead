# Documentation

Developer documentation for fkp.my.id. The project overview and the Markdown syntax reference stay in the root [README.md](../README.md).

## Architecture

[architecture/](architecture/README.md) holds ten low-level diagrams, from the browser through Cloudflare to Supabase. Each one names the source files it was verified against.

## Public API

| Page | Covers |
| --- | --- |
| [api/](api/README.md) | Versions and versioning policy |
| [api/v1/](api/v1/README.md) | `api.fkp.my.id/v1`: [parameters](api/v1/parameters.md), [errors](api/v1/errors.md), [blog](api/v1/blog.md), [author & CV](api/v1/author.md), [search](api/v1/search.md), [discovery](api/v1/discovery.md) |
| [api/ard.md](api/ard.md) | `fkp.my.id/api/ard` (Agent Registry Discovery, unversioned) |

## Development

| Page | Covers |
| --- | --- |
| [development/local-setup.md](development/local-setup.md) | Install, Phase, dev servers, everyday commands |
| [development/environment.md](development/environment.md) | Every environment variable and binding, per app |
| [development/testing.md](development/testing.md) | Test suite map, the live API suite, coverage gaps |
| [development/scripts-and-tooling.md](development/scripts-and-tooling.md) | `scripts/` operations, `tooling/` hooks and plugins |

## Operations

| Page | Covers |
| --- | --- |
| [operations/deployment.md](operations/deployment.md) | Workers Builds, environments, bindings, migrations |
| [operations/newsletter.md](operations/newsletter.md) | Subscription lifecycle, queue delivery, recovery procedures |

## Security

[security.md](security.md) covers the trust boundaries, admin MFA, request integrity, data access and headers. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md): branching, commits and checks.
- `CLAUDE.md` / `AGENTS.md`: conventions for coding agents.

## Keeping docs accurate

- Describe what the code does now, and name the source files so the next editor can re-verify.
- Check the Mermaid diagrams with `bunx @mermaid-js/mermaid-cli@11 -i <file> -o /tmp/out.md` before committing.
- When an API route changes, update `packages/lib/src/openapi.ts`, `apps/api/src/README.md` and `docs/api/v1/` together.
